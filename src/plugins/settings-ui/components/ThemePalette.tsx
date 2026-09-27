import { createResource, For, Show } from 'solid-js';

import { t } from '@/i18n';

import { bridge, patchLocal, store } from '../state';

import type { ThemePalette } from '@/themes/types';
import type { CustomFieldContext } from '@/types/settings';

/**
 * Editor for the selected theme's palette: one text input per palette key,
 * defaulting to the theme's own value until the user overrides it.
 */
export const ThemePaletteField = (_props: { ctx: CustomFieldContext }) => {
  const selectedId = () => store()?.options.theme ?? '';

  // Re-read the theme list when the selection changes: an imported theme only
  // shows up after the backend has written it.
  const [themes] = createResource(selectedId, () => bridge.themes());

  const selected = () => themes()?.themes.find((th) => th.id === selectedId());
  const palette = () => selected()?.palette ?? {};
  const keys = () => Object.keys(palette());

  // Read overrides from the store so local edits show up immediately.
  const overrides = (): Record<string, ThemePalette> =>
    (store()?.options.themeOverrides as Record<string, ThemePalette>) ?? {};
  const valueOf = (key: string) =>
    overrides()[selectedId()]?.[key] ?? palette()[key] ?? '';

  const setValue = async (key: string, value: string) => {
    const themeId = selectedId();
    patchLocal('options.themeOverrides', {
      ...overrides(),
      [themeId]: { ...overrides()[themeId], [key]: value },
    });
    await bridge.setThemeColor(themeId, key, value);
  };

  const reset = async () => {
    const themeId = selectedId();
    const next = { ...overrides() };
    delete next[themeId];
    patchLocal('options.themeOverrides', next);
    await bridge.resetThemeColors(themeId);
  };

  return (
    <Show when={keys().length > 0}>
      <div class="sui-palette">
        <For each={keys()}>
          {(key) => (
            <label class="sui-palette__row">
              <span class="sui-palette__key">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </span>
              <input
                class="sui-text"
                onChange={(e) => setValue(key, e.currentTarget.value)}
                type="text"
                value={valueOf(key)}
              />
              <span
                class="sui-palette__swatch"
                style={{ background: valueOf(key) }}
              />
            </label>
          )}
        </For>
        <button class="sui-outlinedbtn" onClick={reset} type="button">
          {t(
            'main.menu.options.submenu.visual-tweaks.submenu.theme.submenu.reset-colors',
          )}
        </button>
      </div>
    </Show>
  );
};
