import React from 'react';

import { type Store } from '@reduxjs/toolkit';
import type { Container } from '@venizia/ignis-inversion';
import { CoreAdmin, CustomRoutes, type I18nProvider, Resource } from 'ra-core';
import { Provider as ReduxProvider } from 'react-redux';
import { Route } from 'react-router-dom';

import { CoreBindings, Logger } from '@venizia/ardor-kernel';
import { type IAuthProvider, type IDataProvider } from '@/common';
import { type IFeature, mountFeatures, readFeatures } from '@/features/feature';
import { FeatureMessages } from '@/features/messages';
import { ApplicationContext } from '@venizia/ardor-react';
import { type IApplication } from '../common/types';

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
        registry: container,
        logger: Logger.getInstance({ scope: applicationName, enableDebug }),
      }}>
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
  features: Array<IFeature>;
  i18nProvider: I18nProvider;
}): boolean => {
  const { features, i18nProvider } = opts;

  const [state, setState] = React.useState<{ isReady: boolean; error?: unknown }>(() => {
    return {
      isReady: !FeatureMessages.hasLoader({ features, locale: i18nProvider.getLocale() }),
    };
  });

  React.useEffect(() => {
    if (state.isReady) {
      return;
    }

    let isLive = true;

    Promise.resolve(i18nProvider.changeLocale(i18nProvider.getLocale())).then(
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
  }, [i18nProvider, state.isReady]);

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
    customRoutes,
    ...raProps
  } = props;

  const { routes } = customRoutes ?? {};

  const features = React.useMemo(() => {
    return readFeatures({ container });
  }, [container]);

  // The application's own resources and routes, then each feature's it bound in `features()`.
  const mounted = React.useMemo(() => {
    return mountFeatures({ features, resources, routes });
  }, [features, resources, routes]);

  const adminProps = React.useMemo(() => {
    const dataProvider = container.get<IDataProvider>({
      key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
    });
    const authProvider = container.get<IAuthProvider>({
      key: CoreBindings.DEFAULT_AUTH_PROVIDER,
    });
    const i18nProvider = container.get<I18nProvider>({
      key: CoreBindings.DEFAULT_I18N_PROVIDER,
    });

    return { dataProvider, authProvider, i18nProvider, ...raProps };
  }, [container, raProps]);

  const isMessagesReady = useFeatureMessagesReady({
    features,
    i18nProvider: adminProps.i18nProvider,
  });

  if (!isMessagesReady) {
    return (
      <Wrapper
        container={container}
        reduxStore={reduxStore}
        suspense={suspense}
        enableDebug={enableDebug}>
        {suspense}
      </Wrapper>
    );
  }

  return (
    <Wrapper
      container={container}
      reduxStore={reduxStore}
      suspense={suspense}
      enableDebug={enableDebug}>
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
