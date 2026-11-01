import React from 'react';

import type { Container } from '@venizia/ignis-inversion';

import type { ILogger } from '@venizia/ignis-helpers/core';

export interface IApplicationContextValue {
  container: Container | null;
  logger: ILogger | null;
}

export const ApplicationContext = React.createContext<IApplicationContextValue>({
  container: null,
  logger: null,
});
