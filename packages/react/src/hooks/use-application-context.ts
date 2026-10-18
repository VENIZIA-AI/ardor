import React from 'react';

import { getError } from '@venizia/ignis-inversion';

import { ApplicationContext } from '../contexts/application';

export const useApplicationContext = () => {
  const context = React.useContext(ApplicationContext);

  if (!context?.container) {
    throw getError({
      message: '[useApplicationContext] must be used within a ApplicationContextProvider',
    });
  }

  return context.container;
};

export const useApplicationLogger = () => {
  const context = React.useContext(ApplicationContext);

  if (!context?.logger) {
    throw getError({
      message: '[useApplicationLogger] must be used within a ApplicationContextProvider',
    });
  }

  return context.logger;
};
