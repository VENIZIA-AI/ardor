import React from 'react';

import { useLocaleState } from 'ra-core';

import type { DefaultRestDataProvider } from '@/providers/rest-data';
import { CoreBindings, HeaderConstants } from '@venizia/ardor-kernel';
import { useInjectable } from '@venizia/ardor-react';

export interface IUseRequestHeaderLocaleOptions {
  /** The header the locale is sent in. Default `x-locale`. */
  key?: string;
}

export const useRequestHeaderLocale = (opts?: IUseRequestHeaderLocaleOptions) => {
  const key = opts?.key?.length ? opts.key : HeaderConstants.X_LOCALE;

  const [locale] = useLocaleState();

  const defaultRestDataProvider = useInjectable<DefaultRestDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });

  React.useEffect(() => {
    defaultRestDataProvider.getNetworkService().setHeaders({ headers: { [key]: locale } });

    return () => {};
  }, [defaultRestDataProvider, key, locale]);
};
