import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { onRendererLoad, onRendererUnload } from './renderer';

export type SkipSilencesPluginConfig = {
  enabled: boolean;
  onlySkipBeginning: boolean;
};

export default createPlugin({
  name: () => t('plugins.skip-silences.name'),
  description: () => t('plugins.skip-silences.description'),
  restartNeeded: true,
  config: {
    enabled: false,
    onlySkipBeginning: false,
  } as SkipSilencesPluginConfig,
  settings: [
    {
      type: 'switch',
      key: 'onlySkipBeginning',
      label: () => t('plugins.skip-silences.settings.only-skip-beginning'),
      restartNeeded: true,
    },
  ],
  renderer: {
    start: onRendererLoad,
    stop: onRendererUnload,
  },
});
