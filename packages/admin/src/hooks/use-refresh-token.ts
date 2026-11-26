import React from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthProvider } from 'ra-core';

import { LoggerFactory } from '@venizia/ignis-helpers/core';
import type { IAuthProvider } from '@/common';

const logger = LoggerFactory.getLogger(['useRefreshToken']);

/**
 * Returns a function that refreshes the session through the auth provider's `refreshToken` and, once
 * that resolves, invalidates the cached `canAccess` answers (react-admin's `useCanAccess`, key
 * `['auth', 'canAccess', ...]`), so every permission check runs again with the new token. It rejects when `refreshToken` rejects.
 */
export const useRefreshToken = (): TRefreshToken => {
  const authProvider = useAuthProvider<IAuthProvider>();

  const queryClient = useQueryClient();

  const refreshToken = React.useCallback(() => {
    if (!authProvider) {
      return Promise.resolve(false);
    }

    return authProvider.refreshToken().then((isRefreshed) => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'canAccess'] }).catch((error: unknown) => {
        logger.error('[refreshToken] Failed to invalidate the canAccess cache | error: %s', error);
      });

      return isRefreshed;
    });
  }, [authProvider, queryClient]);

  return refreshToken;
};

/** `true` when the session was refreshed, `false` when there is no auth provider or no refresh to make. */
type TRefreshToken = () => Promise<boolean>;
