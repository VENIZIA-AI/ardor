import type { CoreBindings } from '@venizia/ardor-kernel';

import type { II18nProviderOptions } from './types';

declare module '@venizia/ardor-kernel' {
  interface ICoreOptionTypes {
    [CoreBindings.I18N_PROVIDER_OPTIONS]: II18nProviderOptions;
  }
}
