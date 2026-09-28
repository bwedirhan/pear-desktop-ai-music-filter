import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { backend } from './backend';
import { renderer } from './renderer';
import style from './style.css?inline';

export type SearchCommandsConfig = {
  enabled: boolean;
};

export default createPlugin({
  name: () => t('plugins.search-commands.name'),
  description: () => t('plugins.search-commands.description'),
  restartNeeded: false,
  config: {
    enabled: true,
  } as SearchCommandsConfig,
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
