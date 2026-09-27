import { For, Show } from 'solid-js';

import { t } from '@/i18n';

import { bridge, patchLocal, store, themePalette } from '../state';

import type { ThemePalette } from '@/themes/types';
import type { CustomFieldContext } from '@/types/settings';

/** `scrollbar-width` reads as `Scrollbar Width`. */
const keyLabel = (key: string) =>
  key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * Editor for the selected theme's palette: one text input per palette key,
 * defaulting to the theme's own value until the user overrides it.
 */
export const ThemePaletteField = (_props: { ctx: CustomFieldContext }) => {
  const selectedId = () => store()?.options.theme ?? '';

  const palette = themePalette;
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
              <span class="sui-palette__key">{keyLabel(key)}</span>
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
