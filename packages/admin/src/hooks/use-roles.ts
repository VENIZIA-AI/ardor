import React from 'react';

import { CoreBindings, type DefaultAuthService } from '@venizia/ardor-kernel';
import { useApplicationContainer } from '@venizia/ardor-react';

const NO_ROLES: ReadonlySet<string> = new Set<string>();

const noopUnsubscribe = () => {};

const isSameSet = (opts: { left: ReadonlySet<string>; right: ReadonlySet<string> }): boolean => {
  const { left, right } = opts;

  return left.size === right.size && [...left].every((role) => right.has(role));
};

/**
 * The roles of the signed-in user, as the auth service keeps them (`DefaultAuthService.getRoles`).
 * It re-renders when the session changes, in this tab or in another, and returns the same set while
 * the roles stay the same. It is empty when nobody is signed in, or when no auth service is bound.
 * Roles are read at sign-in: a token refresh keeps them. They are data in the browser, so use them
 * to show or hide interface, never to decide what a user may do.
 *
 * @example
 * ```tsx
 * import { Ardor } from '@venizia/ardor';
 *
 * export const AdminOnly = (props: { children: React.ReactNode }) => {
 *   const roles = Ardor.useRoles();
 *
 *   return roles.has('admin') ? props.children : null;
 * };
 * ```
 *
 * @useWhen a component needs the roles of the signed-in user and must update when the session changes
 * @insteadOf reading roles from the token or storage by hand
 */
export const useRoles = (): ReadonlySet<string> => {
  const container = useApplicationContainer();
  const authService = React.useMemo(() => {
    return container.get<DefaultAuthService | undefined>({
      key: CoreBindings.DEFAULT_AUTH_SERVICE,
      isOptional: true,
    });
  }, [container]);

  const subscribe = React.useCallback(
    (onChange: () => void) => {
      return authService ? authService.subscribe({ listener: onChange }) : noopUnsubscribe;
    },
    [authService],
  );

  const lastRoles = React.useRef<ReadonlySet<string>>(NO_ROLES);

  const getSnapshot = React.useCallback((): ReadonlySet<string> => {
    const roles = authService ? authService.getRoles() : NO_ROLES;

    if (!isSameSet({ left: lastRoles.current, right: roles })) {
      lastRoles.current = roles;
    }

    return lastRoles.current;
  }, [authService]);

  return React.useSyncExternalStore(subscribe, getSnapshot, () => NO_ROLES);
};
