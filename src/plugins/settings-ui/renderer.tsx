import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';

import { createRenderer } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { ThemePaletteField } from './components/ThemePalette';
import { listenStorePush, refreshStore, setIpc } from './state';

const [open, setOpen] = createSignal(false);

const GUIDE_SELECTORS = ['#guide-renderer', '#mini-guide-renderer'];
const ITEMS_SELECTOR = 'ytmusic-guide-section-renderer[is-primary] > #items';

/** Injected buttons, kept so they can be unmounted with the plugin. */
const injected: { host: HTMLElement; dispose: () => void }[] = [];
let modalHost: HTMLElement | undefined;
let modalDispose: (() => void) | undefined;

const injectButton = (guide: HTMLElement) => {
  const items = guide.querySelector(ITEMS_SELECTOR);
  if (!items) return;

  const host = document.createElement('div');
  host.classList.add('ytmd-sui-entry-host');
  host.classList.add(guide.id.startsWith('mini-') ? 'mini' : 'normal');
  items.appendChild(host);

  const dispose = render(
    () => <SettingsButton onClick={() => setOpen(true)} />,
    host,
  );
  injected.push({ host, dispose });
};

const mountModal = () => {
  if (modalDispose) return;

  modalHost = document.createElement('div');
  modalHost.id = 'ytmd-sui-root';
  document.body.appendChild(modalHost);

  modalDispose = render(
    () => (
      <Show when={open()}>
        <SettingsModal onClose={() => setOpen(false)} />
      </Show>
    ),
    modalHost,
  );
};

const teardownUi = () => {
  modalDispose?.();
  modalDispose = undefined;
  modalHost?.remove();
  modalHost = undefined;

  for (const { host, dispose } of injected.splice(0)) {
    dispose();
    host.remove();
  }

  setOpen(false);
};

export const renderer = createRenderer({
  components: { themePalette: ThemePaletteField },

  async start(ctx) {
    setIpc(ctx.ipc);
    await refreshStore();
    listenStorePush();

    mountModal();

    for (const selector of GUIDE_SELECTORS) {
      waitForElement<HTMLElement>(selector).then(injectButton);
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
