import React from 'react';

import type { Store } from '@reduxjs/toolkit';
import type { Container } from '@venizia/ignis-inversion';
import { CoreAdmin, CustomRoutes, type I18nProvider, Resource } from 'ra-core';
import { Provider as ReduxProvider } from 'react-redux';
import { Route } from 'react-router-dom';

import { Logger } from '@venizia/ardor-kernel';
import { type TFeature, Features } from '@/features/feature';
import { ApplicationContext } from '@venizia/ardor-react';
import type { IApplication } from '../common/types';
import {
  hasPendingFeatureMessages,
  loadFeatureMessages,
  resolveApplicationProviders,
} from './resolve';

const Wrapper: React.FC<{
  applicationName?: string;
  container: Container;
  reduxStore: Store;
  suspense: React.ReactNode;
  enableDebug?: boolean;
  children: React.ReactNode;
}> = ({
  applicationName = 'ArdorApplication',
  container,
  reduxStore,
  suspense,
  enableDebug = false,
  children,
}) => {
  return (
    <ApplicationContext.Provider
      value={{
        container,
        logger: Logger.getInstance({ scope: applicationName, enableDebug }),
      }}
    >
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
      isReady: !hasPendingFeatureMessages({ features, i18nProvider }),
    };
  });

  React.useEffect(() => {
    if (state.isReady) {
      return () => {};
    }

    let isLive = true;

    loadFeatureMessages({ features, i18nProvider }).then(
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

export const ArdorApplication: React.FC<IApplication> = (props: IApplication) => {
  const {
    container,
    reduxStore,
    suspense,
    enableDebug = false,
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
    return resolveApplicationProviders({ container });
  }, [container]);

  const adminProps = { ...providers, ...reactAdminProps };

  const isMessagesReady = useFeatureMessagesReady({
    features,
    i18nProvider: providers.i18nProvider,
  });

  if (!isMessagesReady) {
    return (
      <Wrapper
        container={container}
        reduxStore={reduxStore}
        suspense={suspense}
        enableDebug={enableDebug}
      >
        {suspense}
      </Wrapper>
    );
  }

  return (
    <Wrapper
      container={container}
      reduxStore={reduxStore}
      suspense={suspense}
      enableDebug={enableDebug}
    >
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
