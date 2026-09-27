import os from 'node:os';

import {
  app,
  BrowserWindow,
  dialog,
  shell,
  type OpenDialogOptions,
} from 'electron';
import electronUpdater from 'electron-updater';

import * as config from '@/config';
import { t } from '@/i18n';
import { restart } from '@/providers/app-controls';
import { setYouTubeLanguage, youtubeLanguage } from '@/providers/language-sync';
import { applyOptionEffects } from '@/providers/option-effects';
import {
  createThemeFromCssFiles,
  notifyThemesChanged,
  openThemesFolder,
  resetThemePalette,
  selectTheme,
  setThemePaletteValue,
  themesForRenderer,
} from '@/themes/main';
import { createBackend } from '@/utils';

import type { SettingsUIConfig } from './index';

/** Subset of chromium's GPUInfo that the debug info cares about. */
interface GpuInfo {
  auxAttributes?: {
    driverVersion?: string;
    glRenderer?: string;
    glVendor?: string;
    softwareRendering?: boolean;
  };
  gpuDevice?: {
    active?: boolean;
    deviceId?: number;
    deviceString?: string;
    driverVendor?: string;
    driverVersion?: string;
    vendorId?: number;
    vendorString?: string;
  }[];
}

/** Vendor ids, for when chromium has no name for the card. */
const GPU_VENDORS: Record<number, string> = {
  0x1002: 'AMD',
  0x1022: 'AMD',
  0x106b: 'Apple',
  0x10de: 'NVIDIA',
  0x13b5: 'ARM',
  0x5143: 'Qualcomm',
  0x8086: 'Intel',
};

/**
 * A readable GPU name. `complete` gives chromium's renderer string, which is
 * what chrome://gpu shows; the bus ids are the fallback when it does not.
 */
const describeGpu = (info: GpuInfo) => {
  const devices = info.gpuDevice ?? [];
  const device = devices.find((entry) => entry.active) ?? devices[0];

  const named = [device?.vendorString, device?.deviceString]
    .filter(Boolean)
    .join(' ');
  const ids = [
    GPU_VENDORS[device?.vendorId ?? 0] ?? 'GPU',
    device?.deviceId ? `0x${device.deviceId.toString(16)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    renderer:
      info.auxAttributes?.glRenderer ||
      named ||
      (device ? ids : '') ||
      (info.auxAttributes?.softwareRendering
        ? 'software rendering'
        : undefined),
    vendor: info.auxAttributes?.glVendor ?? device?.driverVendor,
    driver: device?.driverVersion || info.auxAttributes?.driverVersion,
  };
};

const CHANNELS = [
  'ytmd-sui:load-store',
  'ytmd-sui:option-set',
  'ytmd-sui:plugin-toggle',
  'ytmd-sui:pick-path',
  'ytmd-sui:pick-paths',
  'ytmd-sui:config-edit',
  'ytmd-sui:toggle-devtools',
  'ytmd-sui:restart',
  'ytmd-sui:app-meta',
  'ytmd-sui:open-external',
  'ytmd-sui:check-updates',
  'ytmd-sui:themes',
  'ytmd-sui:theme-color-set',
  'ytmd-sui:theme-colors-reset',
  'ytmd-sui:import-theme-css',
  'ytmd-sui:open-themes-folder',
  'ytmd-sui:language-from-youtube',
  'ytmd-sui:language-to-youtube',
];

export const backend = createBackend<
  { unwatch: (() => void) | undefined },
  SettingsUIConfig
>({
  unwatch: undefined as (() => void) | undefined,

  start(ctx) {
    const { ipc, window } = ctx;

    ipc.handle('ytmd-sui:load-store', () => config.getStore());

    // Returns false when the write was refused (declining a theme's script),
    // so the caller can re-read the store instead of keeping its optimistic value.
    ipc.handle(
      'ytmd-sui:option-set',
      async (key: string, value: unknown): Promise<boolean> => {
        if (typeof key !== 'string' || !key) return false;

        if (key === 'options.theme') {
          if (typeof value !== 'string') return false;
          if (!(await selectTheme(value, window))) return false;
          notifyThemesChanged(window);
          return true;
        }

        config.set(key, value);
        applyOptionEffects(key, value, window);
        return true;
      },
    );

    ipc.handle('ytmd-sui:plugin-toggle', (id: string, enabled: boolean) => {
      if (typeof id !== 'string' || !id || typeof enabled !== 'boolean') return;
      if (enabled) config.plugins.enable(id);
      else config.plugins.disable(id);
    });

    ipc.handle(
      'ytmd-sui:pick-path',
      async (options: OpenDialogOptions): Promise<string | undefined> => {
        const result = await dialog.showOpenDialog(window, options);
        return result.canceled ? undefined : result.filePaths[0];
      },
    );

    ipc.handle(
      'ytmd-sui:pick-paths',
      async (options: OpenDialogOptions): Promise<string[]> => {
        const result = await dialog.showOpenDialog(window, options);
        return result.canceled ? [] : result.filePaths;
      },
    );

    ipc.handle('ytmd-sui:config-edit', () => config.edit());
    ipc.handle('ytmd-sui:toggle-devtools', () =>
      window.webContents.toggleDevTools(),
    );
    ipc.handle('ytmd-sui:restart', () => restart());
    ipc.handle('ytmd-sui:app-meta', async () => {
      const metrics = app.getAppMetrics();
      const workingSet = (of: string[]) =>
        metrics
          .filter((metric) => of.includes(metric.type))
          .reduce((total, metric) => total + metric.memory.workingSetSize, 0);

      // Kilobytes, as Electron reports them. The Browser entry is the app's own
      // node process; whatever is left after the known helpers is the chromium
      // renderers, whatever Electron happens to call them.
      const main =
        workingSet(['Browser']) || Math.round(process.memoryUsage().rss / 1024);
      const gpuMemory = workingSet(['GPU']);
      const other = workingSet([
        'Utility',
        'Zygote',
        'Sandbox helper',
        'Pepper Plugin',
        'Pepper Plugin Broker',
        'Unknown',
      ]);
      const total = metrics.reduce(
        (sum, metric) => sum + metric.memory.workingSetSize,
        0,
      );
      const renderers = Math.max(0, total - main - gpuMemory - other);

      const cpus = os.cpus();

      let gpu: GpuInfo = {};
      try {
        // Rejects when the GPU is entirely disabled, so keep whatever we have:
        // the feature status still says whether that is the case.
        gpu = (await app.getGPUInfo('complete')) as GpuInfo;
      } catch {}

      return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        osVersion: `${os.type()} ${os.release()}`,
        versions: {
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
        },
        cpu: {
          model: cpus[0]?.model.trim() ?? 'unknown',
          threads: cpus.length,
        },
        gpu: {
          ...describeGpu(gpu),
          features: { ...app.getGPUFeatureStatus() },
        },
        memory: { main, renderers, gpu: gpuMemory, other },
      };
    });

    ipc.handle('ytmd-sui:open-external', async (url: string) => {
      try {
        const { protocol } = new URL(url);
        if (protocol === 'https:' || protocol === 'http:') {
          await shell.openExternal(url);
        }
      } catch {}
    });

    ipc.handle('ytmd-sui:check-updates', () =>
      electronUpdater.autoUpdater.checkForUpdatesAndNotify(),
    );

    // Themes: the same state the renderer applies, plus the edits the native
    // menu's theme submenu offers.
    ipc.handle('ytmd-sui:themes', () => ({
      themes: themesForRenderer(),
      selected: config.get('options.theme'),
      overrides: config.getThemeOverrides(),
    }));

    ipc.handle(
      'ytmd-sui:theme-color-set',
      (themeId: string, key: string, value: string) => {
        if (!themeId || !key || typeof value !== 'string') return;
        setThemePaletteValue(themeId, key, value);
        notifyThemesChanged(window);
      },
    );

    ipc.handle('ytmd-sui:theme-colors-reset', (themeId: string) => {
      if (!themeId) return;
      resetThemePalette(themeId);
      notifyThemesChanged(window);
    });

    ipc.handle('ytmd-sui:import-theme-css', async (paths: string[]) => {
      const id = createThemeFromCssFiles(Array.isArray(paths) ? paths : []);
      if (!id) return;

      // Imported themes carry no script, so there is nothing to consent to.
      config.set('options.theme', id);
      notifyThemesChanged(window);

      // The native menu lists themes too; rebuild it outside this handler.
      const { refreshMenu } = await import('@/menu');
      await refreshMenu(window);
    });

    ipc.handle('ytmd-sui:open-themes-folder', () => openThemesFolder());

    // The menu's Language > Sync entries, so the modal can offer them too.
    ipc.handle('ytmd-sui:language-from-youtube', async () => {
      const language = await youtubeLanguage(window);

      if (!language) {
        dialog.showMessageBoxSync(window, {
          title: t(
            'main.menu.options.submenu.language.submenu.sync.failure.dialog.title',
          ),
          message: t(
            'main.menu.options.submenu.language.submenu.sync.failure.dialog.message',
          ),
        });
      }

      return language;
    });

    ipc.handle('ytmd-sui:language-to-youtube', () =>
      setYouTubeLanguage(window, config.get('options.language') ?? 'en'),
    );

    this.unwatch = config.watch(() => {
      const store = config.getStore();
      // Broadcast to every window: the injected modal lives in the main
      // window, but the standalone tray settings window is a separate
      // BrowserWindow that must also stay in sync.
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('ytmd-sui:store-changed', store);
        }
      }
    });
  },

  stop(ctx) {
    this.unwatch?.();
    this.unwatch = undefined;

    for (const channel of CHANNELS) ctx.ipc.removeHandler(channel);
  },
});
