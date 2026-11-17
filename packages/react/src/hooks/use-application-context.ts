import React from 'react';

import { getError } from '@venizia/ignis-inversion';

import { ApplicationContext } from '../contexts/application';

/** The application's `Container`. Throws when there is no `ApplicationContext` provider above. */
export const useApplicationContext = () => {
  const context = React.useContext(ApplicationContext);

  if (!context?.container) {
    throw getError({
      message: '[useApplicationContext] must be used within a ApplicationContextProvider',
    });
  }

  return context.container;
};

/** The application's logger. Throws when there is no `ApplicationContext` provider above. */
export const useApplicationLogger = () => {
  const context = React.useContext(ApplicationContext);

  if (!context?.logger) {
    throw getError({
      message: '[useApplicationLogger] must be used within a ApplicationContextProvider',
    });
  }

  return context.logger;
};
