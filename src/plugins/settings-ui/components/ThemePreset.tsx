import { t } from '@/i18n';
import { CUSTOM_PRESET, keyLabel } from '@/themes/types';

import { Dropdown } from './Controls';

import {
  bridge,
  patchLocal,
  store,
  themePreset,
  themePresetNames,
  themePresetOptions,
} from '../state';

import type { CustomFieldContext } from '@/types/settings';

const themeLabel = (key: string) =>
  `main.menu.options.submenu.visual-tweaks.submenu.theme.submenu.${key}`;

/**
 * Preset picker for the selected theme: the theme's own palette (Default), the
 * presets it ships, then the palette the user edited themselves. A theme that
 * ships no palette has no Default to offer, so its first preset takes its place.
 * Changing a colour in **Colors** picks Custom, so this reflects that too.
 */
export const ThemePresetField = (_props: { ctx: CustomFieldContext }) => {
  const choosePreset = async (preset: string) => {
    const themeId = store()?.options.theme ?? '';
    if (!themeId) return;

    patchLocal('options.themePresets', {
      ...themePresetNames(),
      [themeId]: preset,
    });
    await bridge.setThemePreset(themeId, preset);
  };

  return (
    // The field hides its framework label: the pick reads better on the theme
    // select's line, in the same column the palette's own labels use.
    <div class="sui-palette__row">
      <span class="sui-palette__key">
        {t('settings-ui.fields.theme-preset')}
      </span>
      <Dropdown
        onChange={(value) => choosePreset(String(value))}
        options={themePresetOptions().map((value) => ({
          value,
          label: () =>
            value === ''
              ? t(themeLabel('presets.default'))
              : value === CUSTOM_PRESET
                ? t(themeLabel('presets.custom'))
                : keyLabel(value),
        }))}
        value={themePreset()}
      />
    </div>
  );
};
