import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { backend } from './backend';
import { defaultSearchCommandsConfig } from './config';
import { renderer } from './renderer';
import style from './style.css?inline';

export default createPlugin({
  name: () => t('plugins.search-commands.name'),
  description: () => t('plugins.search-commands.description'),
  restartNeeded: false,
  config: defaultSearchCommandsConfig,
  settings: [
    {
      type: 'switch',
      key: 'openShortcut',
      label: () => t('plugins.search-commands.settings.open-shortcut'),
      description: () =>
        t('plugins.search-commands.settings.open-shortcut-description'),
    },
    {
      type: 'text',
      key: 'openKeybind',
      label: () => t('plugins.search-commands.settings.open-keybind'),
      description: () =>
        t('plugins.search-commands.settings.open-keybind-description'),
      placeholder: () => defaultSearchCommandsConfig.openKeybind,
    },
  ],
  stylesheets: [style],
  backend,
  renderer,
});

export { registerCommand } from './commands';
export type {
  Command,
  CommandArg,
  CommandContext,
  CommandRow,
} from './commands';
export type { SearchCommandsConfig } from './config';
