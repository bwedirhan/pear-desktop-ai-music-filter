/**
 * An external theme is a folder under `<userData>/themes`:
 *
 *   my-theme/
 *     theme.json    manifest (name, palette, presets, css files)
 *     style.css     optional styles, named by the manifest
 *     theme.js      optional script, named by the manifest
 *
 * The folder name is the theme id. Palette entries are emitted verbatim as
 * `--pear-theme-<key>` CSS custom properties, so a value can be any CSS value
 * (colour, font, length, ...)
 */

export type ThemePalette = Record<string, string>;

/** Named palettes a theme offers, keyed by the name the user picks. */
export type ThemePresets = Record<string, ThemePalette>;

export type ThemeManifest = {
  name?: string;
  description?: string;
  author?: string;
  palette?: ThemePalette;
  /** Alternates the user can switch to, layered over `palette`. */
  presets?: ThemePresets;
  /** CSS file(s) relative to the theme folder, applied in order. */
  css?: string | string[];
  /**
   * JS file relative to the theme folder, run when the theme is applied.
   * Its hash is what the user consents to, so this must be declared rather
   * than auto-discovered.
   */
  js?: string;
};

export type PearTheme = {
  id: string;
  name: string;
  description?: string;
  author?: string;
  /**
   * Absent when the manifest declares no `palette` at all. Such a theme has no
   * own values for Default to fall back on, so it offers its first preset in its
   * place; an explicit, even empty, `"palette": {}` keeps Default.
   */
  palette?: ThemePalette;
  presets?: ThemePresets;
  /** Concatenated contents of the manifest's css files. */
  css: string;
  js?: ThemeJs;
};

/** A theme's script, with the hash consent is pinned to. */
export type ThemeJs = {
  source: string;
  hash: string;
};

/** The API handed to a theme's `mount`. */
export type ThemeContext = {
  id: string;
  palette: ThemePalette;
  applyPalette: (palette: ThemePalette) => void;
};

/**
 * A theme's script may `module.exports` (or `export default`, transpiled by
 * the reader) an object with these hooks. `mount` may return a cleanup
 * function, which runs before `unmount` when the theme is replaced.
 */
export type ThemeHooks = {
  mount?: (context: ThemeContext) => (() => void) | void;
  unmount?: () => void;
};

export const isPalette = (value: unknown): value is ThemePalette =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');

export const isCssList = (value: unknown): value is string | string[] =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));

export const isPresets = (value: unknown): value is ThemePresets =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(isPalette);

export const parseManifest = (raw: string): ThemeManifest | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const manifest = parsed as ThemeManifest;
  if (manifest.palette !== undefined && !isPalette(manifest.palette)) {
    return null;
  }

  if (manifest.presets !== undefined && !isPresets(manifest.presets)) {
    return null;
  }

  if (manifest.css !== undefined && !isCssList(manifest.css)) {
    return null;
  }

  if (manifest.js !== undefined && typeof manifest.js !== 'string') {
    return null;
  }

  return manifest;
};

/** Selection meaning "the palette the user edited", not a preset of the theme. */
export const CUSTOM_PRESET = 'custom';

/**
 * The preset a stored pick resolves to. `picked` is the config entry as it is:
 * a preset name, `custom`, '' for Default, or undefined when the user never
 * chose for this theme.
 *
 * A theme whose manifest declares no `palette` has no values to fall back on,
 * so with nothing picked its first preset stands in for Default - the picker and
 * the menu offer that preset instead of Default. An explicit `"palette": {}`
 * still counts as a palette, so it keeps Default. A '' pick counts as nothing
 * picked: there is no Default to pick for such a theme in the first place.
 */
export const defaultPreset = (
  palette: ThemePalette | undefined,
  presets: ThemePresets | undefined,
  picked: string | undefined,
): string | undefined => {
  if (picked || palette) return picked;
  const [first] = Object.keys(presets ?? {});
  return first || undefined;
};

/** `scrollbar-width` reads as `Scrollbar Width`, for a key or a preset name. */
export const keyLabel = (key: string) =>
  key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * The values a selection layers on top of a theme's own palette: a preset's
 * entries, the user's custom palette for `custom`, or nothing for `''` and for a
 * name the theme does not define. `picked` is the stored pick as it is, which
 * `defaultPreset` resolves - a theme with no `palette` declared falls to its
 * first preset until the user picks something.
 */
export const presetPalette = (
  palette: ThemePalette | undefined,
  presets: ThemePresets | undefined,
  picked: string | undefined,
  custom: ThemePalette,
): ThemePalette => {
  const resolved = defaultPreset(palette, presets, picked);
  return resolved === CUSTOM_PRESET
    ? custom
    : (resolved && presets?.[resolved]) || {};
};

/** The layer a selection applies wins over the theme's own palette values. */
export const resolvePalette = (
  palette: ThemePalette | undefined,
  overrides: ThemePalette,
): ThemePalette => ({ ...palette, ...overrides });

/**
 * Normalizes the `peard:get-themes` response. A config stored before the
 * theme keys existed omits them, so nothing may be assumed present here.
 */
export const normalizeThemeState = (
  payload: Partial<ThemeState>,
): ThemeState => ({
  themes: payload.themes ?? [],
  selected: payload.selected ?? '',
  overrides: payload.overrides ?? {},
});

export type ThemeState = {
  themes: PearTheme[];
  /** Selected theme id, or '' for no theme. */
  selected: string;
  /**
   * What each theme layers over its own palette right now, keyed by theme id:
   * the values of its selected preset, or the user's custom palette.
   */
  overrides: Record<string, Record<string, string>>;
};

/**
 * Emits the palette as `--pear-theme-<key>` custom properties. Values are
 * passed through verbatim, so any CSS value works.
 */
export const paletteToCss = (palette: ThemePalette) =>
  `:root {\n${Object.entries(palette)
    .map(([key, value]) => `  --pear-theme-${key}: ${value};`)
    .join('\n')}\n}`;
