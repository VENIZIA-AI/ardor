import { HTTP } from '@venizia/ignis-helpers/common';
import React from 'react';

import { useLocaleState } from 'ra-core';

import { CoreBindings } from '@venizia/ardor-kernel';
import { useProvider } from '@venizia/ardor-react';

/** The header `useRequestHeaderLocale` sends the locale in. */
export interface IUseRequestHeaderLocaleOptions {
  /**
   * The header the locale is sent in.
   * @default 'x-locale'
   */
  key?: string;
}

/**
 * Keeps the current react-admin locale in a header of the default REST data provider's network
 * service, re-set on each locale change. `opts.key` defaults to `x-locale`; an empty key falls back to it.
 *
 * @useWhen requests to the API must carry the current locale in a header
 * @insteadOf a header set by hand on each request
 */
export const useRequestHeaderLocale = (opts?: IUseRequestHeaderLocaleOptions) => {
  const key = opts?.key?.length ? opts.key : HTTP.Headers.LOCALE;

  const [locale] = useLocaleState();

  const dataProvider = useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });

  React.useEffect(() => {
    dataProvider.getNetworkService().setHeaders({ headers: { [key]: locale } });
  }, [dataProvider, key, locale]);
};
