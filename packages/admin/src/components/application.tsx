import React from 'react';

import type { Store } from '@reduxjs/toolkit';
import { type ILogger, LoggerFactory } from '@venizia/ignis-helpers/core';
import type { Container } from '@venizia/ignis-inversion';
import { QueryClient } from '@tanstack/react-query';
import { CoreAdmin, CustomRoutes, type I18nProvider, Resource } from 'ra-core';
import { Provider as ReduxProvider } from 'react-redux';
import { Route } from 'react-router-dom';

import { type TFeature, Features } from '@/features/feature';
import { CoreBindings, type DefaultAuthService } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@venizia/ardor-react';
import type { IApplication } from '../common/types';
import { ApplicationProviders } from './resolve';

const Wrapper: React.FC<{
  applicationName?: string;
  container: Container;
  reduxStore: Store;
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

  return (
    <ApplicationContext.Provider value={{ container, logger: applicationLogger }}>
      <ReduxProvider store={reduxStore}>
        <React.Suspense fallback={suspense}>{children}</React.Suspense>
      </ReduxProvider>
    </ApplicationContext.Provider>
  );
};

/**
 * The i18n provider is built with the initial locale's eager messages only; when a feature loads
 * that locale lazily, `changeLocale()` to the same locale loads it before react-admin renders. A
 * failed load, such as a key two features define, is thrown from render for an error boundary.
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

/**
 * The application shell. It resolves the data, auth and i18n providers from `container`, mounts the
 * `resources` and `routes` of the application and of each feature inside react-admin, and wraps it
 * all in `ApplicationContext.Provider` (`container`, `logger`), the Redux provider and `Suspense`.
 * While a feature's lazy messages for the current locale load, it renders `suspense` instead of
 * react-admin; a failed load is thrown from render. Remaining props go to react-admin's `CoreAdmin`.
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

  // The cache is owned here, so it can be emptied when the session ends by any route (a sign-out
  // button empties it itself; a failed refresh, or code that calls `cleanUp`, does not).
  const queryClient = React.useMemo(() => {
    return reactAdminProps.queryClient ?? new QueryClient();
  }, [reactAdminProps.queryClient]);

  React.useEffect(() => {
    const authService = container.get<DefaultAuthService>({
      key: CoreBindings.DEFAULT_AUTH_SERVICE,
      isOptional: true,
    });

    return authService?.subscribe({
      listener: () => {
        if (!authService.getAuth()?.value) {
          // After the redirect to the sign-in page, as react-admin's own sign-out does.
          setTimeout(() => queryClient.clear(), 0);
        }
      },
    });
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
            return <Route key={route.id ?? route.path} {...route} />;
          })}
        </CustomRoutes>
      </CoreAdmin>
    </Wrapper>
  );
};
