import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Container } from '@venizia/ignis-inversion';
import { CoreBindings, DefaultAuthService } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@venizia/ardor-react';

import { useRoles } from '@/hooks/use-roles';

class Roles {
  static readonly ADMIN = 'admin';
  static readonly EDITOR = 'editor';
  static readonly VIEWER = 'viewer';
}

const TOKEN = { value: 'tok', type: 'Bearer' };

const createWrapper = (opts: { container: Container }) => {
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(
      ApplicationContext.Provider,
      { value: { container: opts.container, logger: null } },
      children,
    );
};

const bindService = (opts: { service: DefaultAuthService }) => {
  const container = new Container();
  container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(opts.service);

  return container;
};

const listenerCount = (opts: { service: DefaultAuthService }): number => {
  const listeners = Reflect.get(opts.service, 'listeners');

  return listeners instanceof Set ? listeners.size : -1;
};

describe('useRoles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('returns the roles of the signed-in user', () => {
    const service = new DefaultAuthService();
    service.saveAuth({ userId: 1, token: TOKEN, roles: [Roles.ADMIN, Roles.EDITOR] });

    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper({ container: bindService({ service }) }),
    });

    expect(result.current).toEqual(new Set([Roles.ADMIN, Roles.EDITOR]));
  });

  test('re-renders with the new roles when the session saves other roles', () => {
    const service = new DefaultAuthService();
    service.saveAuth({ userId: 1, token: TOKEN, roles: [Roles.ADMIN] });

    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper({ container: bindService({ service }) }),
    });
    expect(result.current).toEqual(new Set([Roles.ADMIN]));

    act(() => {
      service.saveAuth({ userId: 2, token: TOKEN, roles: [Roles.VIEWER] });
    });

    expect(result.current).toEqual(new Set([Roles.VIEWER]));
  });

  test('is empty before a sign-in, and after cleanUp', () => {
    const service = new DefaultAuthService();

    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper({ container: bindService({ service }) }),
    });
    expect(result.current.size).toBe(0);

    act(() => {
      service.saveAuth({ userId: 1, token: TOKEN, roles: [Roles.ADMIN] });
    });
    expect(result.current).toEqual(new Set([Roles.ADMIN]));

    act(() => {
      service.cleanUp();
    });
    expect(result.current.size).toBe(0);
  });

  test('keeps the same set while the roles do not change', () => {
    const service = new DefaultAuthService();
    service.saveAuth({ userId: 1, token: TOKEN, roles: [Roles.ADMIN, Roles.EDITOR] });

    const { result, rerender } = renderHook(() => useRoles(), {
      wrapper: createWrapper({ container: bindService({ service }) }),
    });
    const first = result.current;

    rerender();
    act(() => {
      service.saveAuth({ userId: 1, token: TOKEN, roles: [Roles.EDITOR, Roles.ADMIN] });
    });

    expect(result.current).toBe(first);
  });

  test('stops listening to the session on unmount', () => {
    const service = new DefaultAuthService();
    const { unmount } = renderHook(() => useRoles(), {
      wrapper: createWrapper({ container: bindService({ service }) }),
    });

    expect(listenerCount({ service })).toBe(1);

    unmount();

    expect(listenerCount({ service })).toBe(0);
  });

  test('is empty when no auth service is bound', () => {
    const { result } = renderHook(() => useRoles(), {
      wrapper: createWrapper({ container: new Container() }),
    });

    expect(result.current.size).toBe(0);
  });
});
