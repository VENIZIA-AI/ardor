import React from 'react';

import type { Container } from '@venizia/ignis-inversion';

import type { Logger } from '@venizia/ardor-kernel';

export interface IApplicationContextValue {
  container: Container | null;
  logger: Logger | null;
}

export const ApplicationContext = React.createContext<IApplicationContextValue>({
  container: null,
  logger: null,
});
