import { languageResources } from 'virtual:i18n';

import { t } from '@/i18n';
import { startingPages } from '@/providers/extracted-data';
import { Platform } from '@/types/plugins';

import { bridge, pickFiles } from '../state';

import type {
  ActionField,
  SelectField,
  SettingOption,
  SettingsGroup,
  SwitchField,
  TextField,
} from '@/types/settings';

export type AppSectionId =
  | 'general'
  | 'appearance'
  | 'window'
  | 'advanced'
  | 'plugins'
  | 'about';

export interface AppSection {
  id: AppSectionId;
  /** Icon id resolved to an inline SVG in the renderer. */
  icon: string;
  label: () => string;
  sub: () => string;
  groups: SettingsGroup[];
}

/** Label for an option living in the app's native menu, reused verbatim. */
const menuLabel = (path: string) => () =>
  t(`main.menu.options.submenu.${path}`);

const DESKTOP = Platform.Windows | Platform.macOS;

interface FieldExtras {
  description?: () => string;
  restartNeeded?: boolean;
  platform?: Platform;
}

const toggle = (
  key: string,
  label: () => string,
  extras: FieldExtras = {},
): SwitchField => ({ type: 'switch', key, label, ...extras });

const text = (
  key: string,
  label: () => string,
  extras: FieldExtras & { placeholder?: () => string } = {},
): TextField => ({ type: 'text', key, label, ...extras });

const select = (
  key: string,
  label: () => string,
  options: SettingOption[] | (() => Promise<SettingOption[]>),
  extras: FieldExtras & { variant?: SelectField['variant'] } = {},
): SelectField => ({ type: 'select', key, label, options, ...extras });

const action = (
  key: string,
  label: () => string,
  buttonLabel: () => string,
  onClick: ActionField['onClick'],
  extras: FieldExtras = {},
): ActionField => ({
  type: 'action',
  key,
  label,
  buttonLabel,
  onClick,
  ...extras,
});

/** Options whose value is only read when the app (re)starts. */
const AT_STARTUP = { restartNeeded: true } satisfies FieldExtras;

const buildLanguageOptions = async (): Promise<SettingOption[]> => {
  const langResources = await languageResources();
  return Object.keys(langResources)
    .map((lang) => {
      const meta = langResources[lang].translation.language;
      return {
        value: lang,
        label: () => `${meta?.name ?? lang} (${meta?.['local-name'] ?? lang})`,
      };
    })
    .sort((a, b) => a.label().localeCompare(b.label()));
};

const buildThemeOptions = async (): Promise<SettingOption[]> => {
  const { themes } = await bridge.themes();
  return [
    {
      value: '',
      label: menuLabel('visual-tweaks.submenu.theme.submenu.no-theme'),
    },
    ...themes.map((theme) => ({ value: theme.id, label: () => theme.name })),
  ];
};

export const buildAppSections = (): AppSection[] => {
  const startingPageOptions: SettingOption[] = [
    { value: '', label: menuLabel('starting-page.unset') },
    ...Object.keys(startingPages).map((name) => ({
      value: name,
      label: () => name,
    })),
  ];

  return [
    {
      id: 'general',
      icon: 'settings',
      label: () => t('settings-ui.sections.general.label'),
      sub: () => t('settings-ui.sections.general.sub'),
      groups: [
        {
          title: () => t('settings-ui.groups.updates-session'),
          fields: [
            toggle('options.autoUpdates', menuLabel('auto-update')),
            toggle('options.resumeOnStart', menuLabel('resume-on-start'), {
              restartNeeded: true,
            }),
          ],
        },
        {
          title: () => t('settings-ui.groups.startup-language'),
          fields: [
            select(
              'options.startingPage',
              menuLabel('starting-page.label'),
              startingPageOptions,
              { variant: 'dropdown', ...AT_STARTUP },
            ),
            select(
              'options.language',
              menuLabel('language.label'),
              buildLanguageOptions,
              {
                variant: 'dropdown',
                // The bundled language list cant change, and the field is
                // YouTube's own language, so it syncs instead of refreshing.
                refreshable: false,
                languageSync: true,
                ...AT_STARTUP,
              },
            ),
          ],
        },
        {
          title: menuLabel('shared-links.label'),
          fields: [
            toggle(
              'options.stripMusicFromSharedLinks',
              menuLabel('shared-links.submenu.strip-music'),
            ),
            toggle(
              'options.stripSIFromSharedLinks',
              menuLabel('shared-links.submenu.strip-si'),
            ),
          ],
        },
      ],
    },
    {
      id: 'appearance',
      icon: 'palette',
      label: () => t('settings-ui.sections.appearance.label'),
      sub: () => t('settings-ui.sections.appearance.sub'),
      groups: [
        {
          title: () => t('settings-ui.groups.interface'),
          fields: [
            toggle(
              'options.removeUpgradeButton',
              menuLabel('visual-tweaks.submenu.remove-upgrade-button'),
              AT_STARTUP,
            ),
            toggle(
              'options.useYtmIcons',
              menuLabel('visual-tweaks.submenu.use-ytm-icons'),
            ),
            select(
              'options.likeButtons',
              menuLabel('visual-tweaks.submenu.like-buttons.label'),
              [
                {
                  value: '',
                  label: menuLabel(
                    'visual-tweaks.submenu.like-buttons.default',
                  ),
                },
                {
                  value: 'force',
                  label: menuLabel(
                    'visual-tweaks.submenu.like-buttons.force-show',
                  ),
                },
                {
                  value: 'hide',
                  label: menuLabel('visual-tweaks.submenu.like-buttons.hide'),
                },
              ],
              AT_STARTUP,
            ),
            toggle(
              'options.swapLikeButtonsOrder',
              menuLabel('visual-tweaks.submenu.like-buttons.swap'),
              AT_STARTUP,
            ),
          ],
        },
        {
          title: () => t('settings-ui.groups.window-title'),
          fields: [
            text(
              'options.customWindowTitle',
              menuLabel('visual-tweaks.submenu.custom-window-title.label'),
              {
                ...AT_STARTUP,
                placeholder: menuLabel(
                  'visual-tweaks.submenu.custom-window-title.prompt.placeholder',
                ),
              },
            ),
          ],
        },
        {
          title: menuLabel('visual-tweaks.submenu.theme.label'),
          fields: [
            select(
              'options.theme',
              menuLabel('visual-tweaks.submenu.theme.label'),
              buildThemeOptions,
              { variant: 'dropdown' },
            ),
            {
              type: 'custom',
              key: 'options.themeOverrides',
              label: menuLabel(
                'visual-tweaks.submenu.theme.submenu.colors.label',
              ),
              component: 'settings-ui.themePalette',
            },
            action(
              '__theme-import',
              menuLabel('visual-tweaks.submenu.theme.submenu.import-css-file'),
              () => t('settings-ui.choose-files'),
              async () => {
                const paths = await pickFiles([
                  { name: 'CSS Files', extensions: ['css'] },
                ]);
                if (paths.length) await bridge.importThemeCss(paths);
              },
            ),
            action(
              '__theme-folder',
              menuLabel(
                'visual-tweaks.submenu.theme.submenu.open-themes-folder',
              ),
              menuLabel(
                'visual-tweaks.submenu.theme.submenu.open-themes-folder',
              ),
              () => bridge.openThemesFolder(),
            ),
          ],
        },
      ],
    },
    {
      id: 'window',
      icon: 'window',
      label: () => t('settings-ui.sections.window.label'),
      sub: () => t('settings-ui.sections.window.sub'),
      groups: [
        {
          title: () => t('settings-ui.groups.window'),
          fields: [
            toggle('options.alwaysOnTop', menuLabel('always-on-top')),
            toggle('options.hideMenu', menuLabel('hide-menu.label'), {
              ...AT_STARTUP,
              platform: Platform.Windows | Platform.Linux,
            }),
          ],
        },
        {
          title: () => t('settings-ui.groups.system'),
          fields: [
            toggle('options.startAtLogin', menuLabel('start-at-login'), {
              platform: DESKTOP,
            }),
            toggle(
              'options.forceSmtc',
              menuLabel('advanced-options.submenu.force-smtc'),
              { ...AT_STARTUP, platform: Platform.Windows },
            ),
          ],
        },
        {
          title: menuLabel('tray.label'),
          fields: [
            select(
              'options.__trayMode',
              menuLabel('tray.label'),
              [
                {
                  value: 'off',
                  label: menuLabel('tray.submenu.disabled'),
                },
                {
                  value: 'show',
                  label: menuLabel('tray.submenu.enabled-and-show-app'),
                },
                {
                  value: 'hide',
                  label: menuLabel('tray.submenu.enabled-and-hide-app'),
                },
              ],
              AT_STARTUP,
            ),
            toggle(
              'options.trayClickPlayPause',
              menuLabel('tray.submenu.play-pause-on-click'),
            ),
            toggle(
              'options.trayMoveToCurrentDesktop',
              menuLabel('tray.submenu.move-to-current-desktop'),
            ),
            toggle(
              'options.trayForceWhiteIcons',
              menuLabel('tray.submenu.force-white-icons'),
            ),
          ],
        },
      ],
    },
    {
      id: 'advanced',
      icon: 'tune',
      label: () => t('settings-ui.sections.advanced.label'),
      sub: () => t('settings-ui.sections.advanced.sub'),
      groups: [
        {
          title: () => t('settings-ui.groups.network'),
          fields: [
            text(
              'options.proxy',
              menuLabel('advanced-options.submenu.set-proxy.label'),
              {
                ...AT_STARTUP,
                placeholder: menuLabel(
                  'advanced-options.submenu.set-proxy.prompt.placeholder',
                ),
              },
            ),
            toggle(
              'options.overrideUserAgent',
              menuLabel('advanced-options.submenu.override-user-agent'),
              AT_STARTUP,
            ),
          ],
        },
        {
          title: () => t('settings-ui.groups.performance'),
          fields: [
            toggle(
              'options.disableHardwareAcceleration',
              menuLabel(
                'advanced-options.submenu.disable-hardware-acceleration',
              ),
              AT_STARTUP,
            ),
            toggle(
              'options.autoResetAppCache',
              menuLabel('advanced-options.submenu.auto-reset-app-cache'),
              AT_STARTUP,
            ),
          ],
        },
        {
          title: () => t('settings-ui.groups.configuration'),
          fields: [
            toggle(
              'options.restartOnConfigChanges',
              menuLabel('advanced-options.submenu.restart-on-config-changes'),
            ),
            action(
              '__toggle-devtools',
              menuLabel('advanced-options.submenu.toggle-dev-tools'),
              menuLabel('advanced-options.submenu.toggle-dev-tools'),
              () => bridge.toggleDevTools(),
            ),
            action(
              '__edit-config',
              menuLabel('advanced-options.submenu.edit-config-json'),
              menuLabel('advanced-options.submenu.edit-config-json'),
              () => bridge.configEdit(),
            ),
          ],
        },
      ],
    },
    {
      id: 'plugins',
      icon: 'puzzle',
      label: () => t('settings-ui.sections.plugins.label'),
      sub: () => t('settings-ui.sections.plugins.sub'),
      groups: [],
    },
    {
      id: 'about',
      icon: 'info',
      label: () => t('settings-ui.sections.about.label'),
      sub: () => t('settings-ui.sections.about.sub'),
      groups: [],
    },
  ];
};
