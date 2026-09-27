import { deepmergeCustom } from 'deepmerge-ts';
import { createSignal } from 'solid-js';

import type { defaultConfig } from '@/config/defaults';
import type { ThemePalette, ThemeState } from '@/themes/types';
import type { RendererContext } from '@/types/contexts';
import type { RestartRequirement } from '@/types/restart';

export type StoreShape = typeof defaultConfig;
export type PluginConfigMap = Record<
  string,
  Record<string, unknown> & { enabled?: boolean }
>;

export interface AppMeta {
  name: string;
  version: string;
  platform: string;
  arch: string;
  osVersion: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  cpu: {
    model: string;
    threads: number;
  };
  gpu: {
    renderer?: string;
    vendor?: string;
    driver?: string;
    /** From app.getGPUFeatureStatus(), e.g. `{ gpu_compositing: 'enabled' }`. */
    features: Record<string, string>;
  };
  /** Working set in kilobytes, per process group. */
  memory: {
    main: number;
    renderers: number;
    gpu: number;
    other: number;
  };
}

// ---- reactive config snapshot (seeded + pushed from the backend) ----
const [store, setStore] = createSignal<StoreShape | null>(null);
export { store };

// ---- IPC bridge (wired in the renderer's start()) ----
type Ipc = RendererContext<{ enabled: boolean }>['ipc'];
let ipc: Ipc | null = null;
export const setIpc = (value: Ipc) => {
  ipc = value;
};

export const bridge = {
  loadStore: () => ipc!.invoke('ytmd-sui:load-store') as Promise<StoreShape>,
  /** Resolves false when the write was refused (e.g. theme consent denied). */
  optionSet: (key: string, value: unknown) =>
    ipc!.invoke('ytmd-sui:option-set', key, value) as Promise<boolean>,
  pluginToggle: (id: string, enabled: boolean) =>
    ipc!.invoke('ytmd-sui:plugin-toggle', id, enabled),
  // Plugin field writes ride the app's existing per-plugin config channel.
  pluginSet: (id: string, partial: object) =>
    ipc!.invoke('peard:set-config', id, partial),
  restartSessionOpen: () => ipc!.invoke('ytmd-sui:restart-session-open'),
  restartSessionClose: (changes: RestartRequirement[]) =>
    ipc!.invoke('ytmd-sui:restart-session-close', changes),
  pickPath: (options: object) =>
    ipc!.invoke('ytmd-sui:pick-path', options) as Promise<string | undefined>,
  pickPaths: (options: object) =>
    ipc!.invoke('ytmd-sui:pick-paths', options) as Promise<string[]>,
  configEdit: () => ipc!.invoke('ytmd-sui:config-edit'),
  toggleDevTools: () => ipc!.invoke('ytmd-sui:toggle-devtools'),
  restart: () => ipc!.invoke('ytmd-sui:restart'),
  appMeta: () => ipc!.invoke('ytmd-sui:app-meta') as Promise<AppMeta>,
  openExternal: (url: string) => ipc!.invoke('ytmd-sui:open-external', url),
  checkUpdates: () => ipc!.invoke('ytmd-sui:check-updates'),
  themes: () => ipc!.invoke('ytmd-sui:themes') as Promise<ThemeState>,
  setThemeColor: (themeId: string, key: string, value: string) =>
    ipc!.invoke('ytmd-sui:theme-color-set', themeId, key, value),
  resetThemeColors: (themeId: string) =>
    ipc!.invoke('ytmd-sui:theme-colors-reset', themeId),
  importThemeCss: (paths: string[]) =>
    ipc!.invoke('ytmd-sui:import-theme-css', paths),
  openThemesFolder: () => ipc!.invoke('ytmd-sui:open-themes-folder'),
  /** YouTube's UI language as an app language, or undefined when we dont ship it. */
  languageFromYouTube: () =>
    ipc!.invoke('ytmd-sui:language-from-youtube') as Promise<
      string | undefined
    >,
  languageToYouTube: () => ipc!.invoke('ytmd-sui:language-to-youtube'),
};

export const refreshStore = async () => {
  setStore(await bridge.loadStore());
};

export const listenStorePush = () => {
  ipc!.on('ytmd-sui:store-changed', (next: StoreShape) => {
    setStore(next);
  });
};

// ---- theme list (loaded at start, refreshed when the backend says so) ----
const [themes, setThemes] = createSignal<ThemeState>();

export const refreshThemes = async () => {
  try {
    setThemes(await bridge.themes());
  } catch {
    // Keep the list we have; the modal then just shows no palette.
  }
};

export const listenThemesPush = () => {
  ipc!.on('peard:themes-changed', () => {
    refreshThemes();
  });
};

/** Palette variables of the selected theme; empty when it has none. */
export const themePalette = (): ThemePalette => {
  const id = store()?.options.theme ?? '';
  return themes()?.themes.find((theme) => theme.id === id)?.palette ?? {};
};

// ---- widget sizes ----
/** Remembered for the session: closing the modal unmounts all of it. */
export interface SettingsLayout {
  width?: number;
  height?: number;
  sidebarWidth?: number;
}

const [layout, setLayout] = createSignal<SettingsLayout>({});
export { layout };

export const patchLayout = (patch: SettingsLayout) =>
  setLayout((current) => ({ ...current, ...patch }));

// ---- value helpers ----

export const getByPath = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );

/** Writes `value` at a dotted path, creating the intermediate objects. */
const setByPath = <T extends object>(
  root: T,
  path: string,
  value: unknown,
): T => {
  const keys = path.split('.');
  let node = root as Record<string, unknown>;

  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }

  node[keys[keys.length - 1]] = value;
  return root;
};

/** Optimistically patch a dotted path in the local store signal. */
export const patchLocal = (path: string, value: unknown) => {
  const current = store();
  if (!current) return;
  setStore(setByPath(structuredClone(current), path, value));
};

/** Build a nested partial object from a dotted key + value. */
export const nestPartial = (path: string, value: unknown): object =>
  setByPath({}, path, value);

// Arrays are replaced, matching how the backend merges a plugin's stored
// config over its defaults.
const deepmerge = deepmergeCustom({ mergeArrays: false });

// ---- app option get/set (with the tray composite special case) ----

const TRAY_KEY = 'options.__trayMode';

export const getAppValue = (snapshot: StoreShape, key: string): unknown => {
  if (key === TRAY_KEY) {
    if (!snapshot.options.tray) return 'off';
    return snapshot.options.appVisible ? 'show' : 'hide';
  }
  return getByPath(snapshot, key);
};

export const setAppValue = async (key: string, value: unknown) => {
  if (key === TRAY_KEY) {
    const tray = value !== 'off';
    const appVisible = value !== 'hide';
    patchLocal('options.tray', tray);
    patchLocal('options.appVisible', appVisible);
    await bridge.optionSet('options.tray', tray);
    await bridge.optionSet('options.appVisible', appVisible);
    return;
  }

  patchLocal(key, value);
  // A refused write leaves the optimistic patch in place, so re-read.
  if ((await bridge.optionSet(key, value)) === false) await refreshStore();
};

// ---- plugin config get/set ----

export const getPluginConfig = (
  snapshot: StoreShape,
  id: string,
  defaults: Record<string, unknown>,
): Record<string, unknown> => {
  const stored = (snapshot.plugins as PluginConfigMap)[id];
  return deepmerge(defaults, stored ?? {}) as Record<string, unknown>;
};

const pendingPluginWrites = new Map<
  string,
  { timeout: ReturnType<typeof setTimeout>; write: () => Promise<unknown> }
>();
const PLUGIN_SLIDER_DEBOUNCE_MS = 200;

export const setPluginValue = (id: string, key: string, value: unknown) => {
  patchLocal(`plugins.${id}.${key}`, value);
  bridge.pluginSet(id, nestPartial(key, value));
};

/** Update a slider immediately, then persist its final value after dragging. */
export const setPluginSliderValue = (
  id: string,
  key: string,
  value: unknown,
) => {
  patchLocal(`plugins.${id}.${key}`, value);

  const writeKey = `${id}:${key}`;
  const pending = pendingPluginWrites.get(writeKey);
  if (pending) clearTimeout(pending.timeout);

  const write = () => bridge.pluginSet(id, nestPartial(key, value));

  pendingPluginWrites.set(writeKey, {
    timeout: setTimeout(() => {
      pendingPluginWrites.delete(writeKey);
      write();
    }, PLUGIN_SLIDER_DEBOUNCE_MS),
    write,
  });
};

/** Persist slider values that are still waiting for their debounce timer. */
export const flushPendingPluginSliderWrites = async () => {
  const pending = [...pendingPluginWrites.values()];
  pendingPluginWrites.clear();

  for (const item of pending) clearTimeout(item.timeout);
  await Promise.all(pending.map((item) => item.write()));
};

// ---- native dialog helpers (for `action` fields) ----

export const pickDirectory = (): Promise<string | undefined> =>
  bridge.pickPath({ properties: ['openDirectory', 'createDirectory'] });

export const pickFile = (
  filters?: { name: string; extensions: string[] }[],
): Promise<string | undefined> =>
  bridge.pickPath({ properties: ['openFile'], filters });

export const pickFiles = (
  filters?: { name: string; extensions: string[] }[],
): Promise<string[]> =>
  bridge.pickPaths({ properties: ['openFile', 'multiSelections'], filters });
