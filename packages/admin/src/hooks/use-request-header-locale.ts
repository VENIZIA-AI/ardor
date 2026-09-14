import React from 'react';

import { useLocaleState } from 'ra-core';

import { DefaultRestDataProvider } from '@/providers/rest-data';
import { CoreBindings, HeaderConsts } from '@venizia/ardor-kernel';
import { useInjectable } from '@venizia/ardor-react';

export const useRequestHeaderLocale = (params?: { key?: string }) => {
  const key = params?.key?.length ? params.key : HeaderConsts.X_LOCALE;

  const [locale] = useLocaleState();

  const defaultRestDataProvider = useInjectable<DefaultRestDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });

  React.useEffect(() => {
    defaultRestDataProvider.getNetworkService().setHeaders({ [key]: locale });

    return () => {};
  }, [defaultRestDataProvider, key, locale]);
};
