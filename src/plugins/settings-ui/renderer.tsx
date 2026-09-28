import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';

import { t } from '@/i18n';
import { createRenderer } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { SettingsModal } from './components/SettingsModal';
import { ThemePaletteField } from './components/ThemePalette';
import { ThemePresetField } from './components/ThemePreset';
import {
  listenStorePush,
  listenThemesPush,
  refreshStore,
  refreshThemes,
  setIpc,
  unlistenStorePush,
  unlistenThemesPush,
} from './state';

const [open, setOpen] = createSignal(false);
const [closing, setClosing] = createSignal(false);

/** Lets other plugins — the `/settings` search command — open the modal. */
export const openSettings = () => {
  setOpen(true);
};

const GUIDE_SELECTORS = ['#guide-renderer', '#mini-guide-renderer'];
const ITEMS_SELECTOR = 'ytmusic-guide-section-renderer[is-primary] > #items';

/**
 * YTM's own sidebar entry, driven by the inner `guideEntryRenderer` payload.
 * Without a `navigationEndpoint` its built-in tap handler does nothing.
 */
type GuideEntryRendererElement = HTMLElement & {
  isCollapsed: boolean;
  data: {
    isPrimary: boolean;
    icon: { iconType: string };
    formattedTitle: { runs: { text: string }[] };
  };
};

let modalHost: HTMLElement | undefined;
let modalDispose: (() => void) | undefined;
let started = false;

const injectButton = (guide: HTMLElement) => {
  const items = guide.querySelector(ITEMS_SELECTOR);
  if (!items || !started) return;

  const host = document.createElement(
    'ytmusic-guide-entry-renderer',
  ) as GuideEntryRendererElement;
  host.classList.add('pear-settings-btn');
  host.isCollapsed = guide.id.startsWith('mini-');
  host.data = {
    isPrimary: true,
    icon: { iconType: 'SETTINGS_MATERIAL' },
    formattedTitle: { runs: [{ text: t('settings-ui.title') }] },
  };
  host.addEventListener('tap', () => setOpen(true));
  items.appendChild(host);
};

/** Play the exit animation, then unmount. */
const closeModal = () => {
  setClosing(true);
  // ponytail: mirrors the .sui-modal exit animation duration in styles.css
  setTimeout(() => {
    setOpen(false);
    setClosing(false);
  }, 220);
};

const mountModal = () => {
  if (modalDispose) return;

  modalHost = document.createElement('div');
  modalHost.id = 'ytmd-sui-root';
  document.body.appendChild(modalHost);

  modalDispose = render(
    () => (
      <Show when={open()}>
        <SettingsModal closing={closing()} onClose={closeModal} />
      </Show>
    ),
    modalHost,
  );
};

const teardownUi = () => {
  started = false;

  unlistenStorePush();
  unlistenThemesPush();

  modalDispose?.();
  modalDispose = undefined;
  modalHost?.remove();
  modalHost = undefined;

  document
    .querySelectorAll('.pear-settings-btn')
    .forEach((host) => host.remove());

  setOpen(false);
  setClosing(false);
};

export const renderer = createRenderer({
  components: {
    themePalette: ThemePaletteField,
    themePreset: ThemePresetField,
  },

  async start(ctx) {
    started = true;
    setIpc(ctx.ipc);
    await refreshStore();
    await refreshThemes();
    listenStorePush();
    listenThemesPush();

    mountModal();

    for (const selector of GUIDE_SELECTORS) {
      // Only one of the two guides is on the page, so the other one's wait
      // always ends in a timeout; `injectButton` also drops a late resolve.
      waitForElement<HTMLElement>(selector).then(injectButton, () => {});
    }
  },

  stop: teardownUi,
});

const hot = (
  import.meta as ImportMeta & {
    hot?: { dispose: (cb: () => void) => void };
  }
).hot;
hot?.dispose(teardownUi);
