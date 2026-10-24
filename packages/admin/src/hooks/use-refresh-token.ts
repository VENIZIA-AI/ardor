import React from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthProvider } from 'ra-core';

import { Logger } from '@venizia/ardor-kernel';
import type { IAuthProvider } from '@/common';

const logger = Logger.getInstance({ scope: 'useRefreshToken' });

export const useRefreshToken = (): TRefreshToken => {
  const authProvider = useAuthProvider<IAuthProvider>();

  const queryClient = useQueryClient();

  const refreshToken = React.useCallback(() => {
    if (!authProvider) {
      return Promise.resolve(false);
    }

    return authProvider.refreshToken().then(isRefreshed => {
      queryClient
        .invalidateQueries({ queryKey: ['auth', 'getPermissions'] })
        .catch((error: unknown) => {
          logger.error('[refreshToken] Failed to invalidate permissions cache | error: %s', error);
        });
      return isRefreshed;
    });
  }, [authProvider, queryClient]);

  return refreshToken;
};

/** `true` when the session was refreshed, `false` when there is no auth provider or no refresh to make. */
type TRefreshToken = () => Promise<boolean>;
