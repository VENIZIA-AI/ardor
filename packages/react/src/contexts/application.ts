import React from 'react';

import type { Container } from '@venizia/ignis-inversion';

import type { ILogger } from '@venizia/ignis-helpers/core';

/** What `ApplicationContext` carries; both are `null` outside a provider. */
export interface IApplicationContextValue {
  /** The application's container. */
  container: Container | null;
  /** The application's logger. */
  logger: ILogger | null;
}

/** Read through `useApplicationContext` and `useApplicationLogger`; the default value holds `null`s. */
export const ApplicationContext = React.createContext<IApplicationContextValue>({
  container: null,
  logger: null,
});
