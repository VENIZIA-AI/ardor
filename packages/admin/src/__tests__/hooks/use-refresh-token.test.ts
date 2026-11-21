import { describe, test, expect, beforeAll, afterAll, afterEach, mock, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { AuthContext } from 'ra-core';
import React, { type ReactNode } from 'react';

import type { IAuthProvider } from '@/common';
import { useRefreshToken } from '@/hooks/use-refresh-token';
import { RejectionUtility } from '@venizia/dev-configs/testing';

interface ICreateMockAuthProviderOptions {
  readonly refreshToken?: () => Promise<boolean>;
}

interface ICreateWrapperOptions {
  readonly authProvider?: IAuthProvider;
  readonly queryClient: QueryClient;
}

const createMockAuthProvider = ({
  refreshToken = mock((): Promise<boolean> => {
    return Promise.resolve(true);
  }),
}: ICreateMockAuthProviderOptions): IAuthProvider => {
  const authProvider: IAuthProvider = {
    login: mock((): Promise<void> => {
      return Promise.resolve();
    }),
    logout: mock((): Promise<void> => {
      return Promise.resolve();
    }),
    checkAuth: mock((): Promise<void> => {
      return Promise.resolve();
    }),
    checkError: mock((): Promise<void> => {
      return Promise.resolve();
    }),
    getPermissions: mock((): Promise<unknown> => {
      return Promise.resolve([]);
    }),
    getRoles: mock((): Promise<Set<string>> => {
      return Promise.resolve(new Set<string>());
    }),
    refreshToken,
  };

  return authProvider;
};

const createWrapper = ({
  authProvider,
  queryClient,
}: ICreateWrapperOptions): (({
  children,
}: {
  readonly children: ReactNode;
}) => React.ReactElement) => {
  return ({ children }: { readonly children: ReactNode }): React.ReactElement => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthContext.Provider, { value: authProvider }, children),
    );
  };
};

describe('useRefreshToken', () => {
  beforeAll(() => {});

  afterAll(() => {});

  afterEach(() => {});

  test('calls authProvider.refreshToken and resolves with its result', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const refreshTokenMock = mock((): Promise<boolean> => {
      return Promise.resolve(true);
    });
    const authProvider = createMockAuthProvider({
      refreshToken: refreshTokenMock,
    });
    const wrapper = createWrapper({
      authProvider,
      queryClient,
    });

    const { result } = renderHook(
      () => {
        return useRefreshToken();
      },
      { wrapper },
    );

    let resolvedResult: unknown;
    await act(async (): Promise<void> => {
      const result2 = await result.current();
      resolvedResult = result2;
    });

    expect(refreshTokenMock).toHaveBeenCalledTimes(1);
    expect(resolvedResult).toBe(true);
  });

  test('invalidates the cached canAccess answers after a refresh, and nothing else', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const canAccessKey = ['auth', 'canAccess', { resource: 'orders', action: 'list' }];
    queryClient.setQueryData(canAccessKey, true);
    queryClient.setQueryData(['orders', 'getList'], [{ id: 1 }]);
    const authProvider = createMockAuthProvider({
      refreshToken: mock((): Promise<boolean> => {
        return Promise.resolve(true);
      }),
    });
    const wrapper = createWrapper({
      authProvider,
      queryClient,
    });

    const { result } = renderHook(
      () => {
        return useRefreshToken();
      },
      { wrapper },
    );

    await act(async (): Promise<void> => {
      await result.current();
    });

    expect(queryClient.getQueryState(canAccessKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['orders', 'getList'])?.isInvalidated).toBe(false);
  });

  test('does not invalidate anything when the refresh rejects', async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = spyOn(queryClient, 'invalidateQueries');
    const authProvider = createMockAuthProvider({
      refreshToken: mock((): Promise<boolean> => {
        return Promise.reject(new Error('refresh failed'));
      }),
    });
    const wrapper = createWrapper({
      authProvider,
      queryClient,
    });

    const { result } = renderHook(
      () => {
        return useRefreshToken();
      },
      { wrapper },
    );

    let rejection: unknown;
    await act(async (): Promise<void> => {
      const result3 = await RejectionUtility.rejectionOf({ task: result.current() });
      rejection = result3;
    });

    expect(rejection).toMatchObject({ message: 'refresh failed' });
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  test('resolves false and touches nothing when auth provider is missing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const invalidateQueriesSpy = spyOn(queryClient, 'invalidateQueries');
    const wrapper = createWrapper({
      authProvider: undefined,
      queryClient,
    });

    const { result } = renderHook(
      () => {
        return useRefreshToken();
      },
      { wrapper },
    );

    let resolvedResult: unknown;
    await act(async (): Promise<void> => {
      const result2 = await result.current();
      resolvedResult = result2;
    });

    expect(resolvedResult).toBe(false);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
