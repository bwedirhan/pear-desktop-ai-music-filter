import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { backend } from './backend';
import { renderer } from './renderer';
import style from './styles.css?inline';

export interface SettingsUIConfig {
  enabled: boolean;
  /** Adds the settings entry to YTM's sidebar; the menu entry works regardless. */
  showButton: boolean;
}

export default createPlugin({
  name: () => t('settings-ui.name'),
  description: () => t('settings-ui.description'),
  restartNeeded: false,
  essential: true,
  config: {
    enabled: true,
    showButton: true,
  } as SettingsUIConfig,
  settings: [
    {
      type: 'switch',
      key: 'showButton',
      label: () => t('settings-ui.settings.show-button'),
      description: () => t('settings-ui.settings.show-button-description'),
    },
  ],
  stylesheets: [style],
  backend,
  renderer,
});
