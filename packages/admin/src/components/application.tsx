import React from 'react';

import type { Store } from '@reduxjs/toolkit';
import { type ILogger, LoggerFactory } from '@venizia/ignis-helpers/core';
import type { Container } from '@venizia/ignis-inversion';
import { QueryClient } from '@tanstack/react-query';
import {
  Authenticated,
  CanAccess,
  CoreAdmin,
  CustomRoutes,
  type I18nProvider,
  Resource,
} from 'ra-core';
import { Provider as ReduxProvider } from 'react-redux';
import { Outlet, Route } from 'react-router-dom';

import { type TArdorRoute, type TFeature, Features } from '@/features/feature';
import { getError } from '@venizia/ignis-inversion';
import { CoreBindings, type DefaultAuthService } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@venizia/ardor-react';
import type { IApplication } from '../common/types';
import { ApplicationProviders } from './resolve';

const Wrapper: React.FC<{
  applicationName?: string;
  container: Container;
  reduxStore?: Store;
  suspense: React.ReactNode;
  logger?: ILogger;
  children: React.ReactNode;
}> = ({
  applicationName = 'ArdorApplication',
  container,
  reduxStore,
  suspense,
  logger,
  children,
}) => {
  // The one the application passed, else a console logger named after it: built once, not per render.
  const applicationLogger = React.useMemo(() => {
    return logger ?? LoggerFactory.getLogger([applicationName]);
  }, [logger, applicationName]);

  const content = <React.Suspense fallback={suspense}>{children}</React.Suspense>;

  return (
    <ApplicationContext.Provider value={{ container, logger: applicationLogger }}>
      {reduxStore ? <ReduxProvider store={reduxStore}>{content}</ReduxProvider> : content}
    </ApplicationContext.Provider>
  );
};

/**
 * A route as react-router reads it. With `access`, the page is wrapped in sign-in and permission
 * checks: a custom route has neither in react-admin.
 */
const renderRoute = (opts: { route: TArdorRoute }) => {
  const { access, ...routeProps } = opts.route;
  const key = routeProps.id ?? routeProps.path;

  if (!access) {
    return <Route key={key} {...routeProps} />;
  }

  const { Component, element, ...rest } = routeProps;
  const page = element ?? (Component ? <Component /> : <Outlet />);

  return (
    <Route
      key={key}
      {...rest}
      element={
        <Authenticated>
          <CanAccess resource={access.resource} action={access.action}>
            {page}
          </CanAccess>
        </Authenticated>
      }
    />
  );
};

/**
 * A route with `access` is open when nothing can answer it: react-admin treats a missing auth provider as
 * everyone signed in, and a provider with no `canAccess` allows every page. Failing at mount keeps the route closed.
 */
const assertAccessRoutesCanBeChecked = (opts: {
  routes: Array<TArdorRoute>;
  authProvider?: { canAccess?: unknown };
}): void => {
  const { routes, authProvider } = opts;

  for (const route of routes) {
    if (!route.access) {
      continue;
    }

    const name = route.path ?? route.id;

    if (!authProvider) {
      throw getError({
        message: `[ArdorApplication] The route '${name}' has access, but sign-in is off, so nobody is asked who may open it | Turn sign-in on, or remove access from the route`,
      });
    }

    if (!authProvider.canAccess) {
      throw getError({
        message: `[ArdorApplication] The route '${name}' has access, but no permission provider is bound, so every signed-in user would pass | Bind CoreBindings.PERMISSION_PROVIDER (RolePermissionProvider, or your own), or remove access from the route`,
      });
    }
  }
};

/**
 * The i18n provider is built with the initial locale's eager messages only; when a feature loads
 * that locale lazily, `changeLocale()` to the same locale loads it before react-admin renders. A
 * failed load of a custom i18n provider is thrown from render for an error boundary.
 */
const useFeatureMessagesReady = (opts: {
  features: Array<TFeature>;
  i18nProvider: I18nProvider;
}): boolean => {
  const { features, i18nProvider } = opts;

  const [state, setState] = React.useState<{ isReady: boolean; error?: unknown }>(() => {
    return {
      isReady: !Features.hasPendingMessages({ features, i18nProvider }),
    };
  });

  React.useEffect(() => {
    if (state.isReady) {
      return () => {};
    }

    let isLive = true;

    Features.loadMessages({ features, i18nProvider }).then(
      () => {
        if (isLive) {
          setState({ isReady: true });
        }
      },
      (error: unknown) => {
        if (isLive) {
          setState({ isReady: false, error });
        }
      },
    );

    return () => {
      isLive = false;
    };
  }, [features, i18nProvider, state.isReady]);

  if (state.error) {
    throw state.error;
  }

  return state.isReady;
};

/** Who the stored session belongs to: the user id as text, `''` when the session names none, `undefined` without a session. */
const readSessionUser = (opts: { authService: DefaultAuthService }): string | undefined => {
  const { authService } = opts;

  if (!authService.getAuth()?.value) {
    return undefined;
  }

  return String(authService.getUser().userId ?? '');
};

/**
 * The application shell. It resolves the data, auth and i18n providers from `container`, mounts the
 * `resources` and `routes` of the application and of each feature inside react-admin, and wraps it
 * all in `ApplicationContext.Provider` (`container`, `logger`), the Redux provider (only when
 * `reduxStore` is passed) and `Suspense`. While a feature's lazy messages for the current locale
 * load, it renders `suspense` instead of react-admin; a failed load is thrown from render. Remaining
 * props go to react-admin's `CoreAdmin`.
 */
export const ArdorApplication: React.FC<IApplication> = (props: IApplication) => {
  const {
    container,
    reduxStore,
    suspense,
    logger,
    resources,
    routes,
    features: selected,
    ...reactAdminProps
  } = props;

  // The list the shell passed, else every feature the application bound.
  const features = React.useMemo(() => {
    return selected ?? Features.read({ container });
  }, [container, selected]);

  // The application's own resources and routes, then each feature's it bound in `features()`.
  const mounted = React.useMemo(() => {
    return Features.mount({ features, resources, routes });
  }, [features, resources, routes]);

  // Resolved once per container: the props below are a new object on every render.
  const providers = React.useMemo(() => {
    return ApplicationProviders.resolve({ container });
  }, [container]);

  assertAccessRoutesCanBeChecked({ routes: mounted.routes, authProvider: providers.authProvider });

  // The cache is owned here, so it can be emptied when the session ends by any route (a sign-out
  // button empties it itself; a failed refresh, or code that calls `cleanUp`, does not) and when
  // another user signs in over the first, which also ends the answers of `canAccess` of the first.
  const queryClient = React.useMemo(() => {
    return reactAdminProps.queryClient ?? new QueryClient();
  }, [reactAdminProps.queryClient]);

  React.useEffect(() => {
    const authService = container.get<DefaultAuthService>({
      key: CoreBindings.DEFAULT_AUTH_SERVICE,
      isOptional: true,
    });

    if (!authService) {
      return undefined;
    }

    // `resetQueries`, not `clear`: a page that is open holds its query, and only a reset tells it to drop its data.
    const resetCache = () => {
      queryClient.resetQueries().catch((error: unknown) => {
        LoggerFactory.getLogger(['ArdorApplication']).error(
          '[resetCache] failed | error: %o',
          error,
        );
      });
    };

    // The user the cache belongs to: `undefined` when no session was announced since the last clear.
    let cachedUser = readSessionUser({ authService });

    const stop = authService.subscribe({
      listener: () => {
        const user = readSessionUser({ authService });

        if (user === undefined) {
          // After the redirect to the sign-in page, as react-admin's own sign-out does.
          setTimeout(() => {
            // Not when the next user signed in meanwhile: that sign-in judged the cache itself.
            if (readSessionUser({ authService }) === undefined) {
              resetCache();
              cachedUser = undefined;
            }
          }, 0);

          return;
        }

        if (cachedUser !== undefined && cachedUser !== user) {
          resetCache();
        }

        cachedUser = user;
      },
    });

    return stop;
  }, [container, queryClient]);

  const adminProps = { ...providers, ...reactAdminProps, queryClient };

  const isMessagesReady = useFeatureMessagesReady({
    features,
    i18nProvider: providers.i18nProvider,
  });

  if (!isMessagesReady) {
    return (
      <Wrapper container={container} reduxStore={reduxStore} suspense={suspense} logger={logger}>
        {suspense}
      </Wrapper>
    );
  }

  return (
    <Wrapper container={container} reduxStore={reduxStore} suspense={suspense} logger={logger}>
      <CoreAdmin {...adminProps}>
        {mounted.resources.map((resource) => {
          return <Resource key={resource.name} {...resource} />;
        })}

        <CustomRoutes>
          {mounted.routes.map((route) => {
            return renderRoute({ route });
          })}
        </CustomRoutes>
      </CoreAdmin>
    </Wrapper>
  );
};
