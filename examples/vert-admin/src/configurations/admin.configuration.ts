import {
  configuration,
  CoreBindings,
  englishMessages,
  type II18nProviderOptions,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';

import { VertPaths } from '@/constants/vert-paths';

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'vert.configurations': unknown;
    'vert.signedInAs': unknown;
  }
}

// The options of the framework providers. BaseArdorApplication binds the providers, each a SINGLETON
// built on first use: react-admin, the auth provider and every hook share one data provider - its
// token, headers and single 401 refresh.
@configuration()
export class AdminConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: '/v1/api',
      noAuth: { paths: [VertPaths.SIGN_IN] },
      authRecovery: { refreshTokenPath: VertPaths.REFRESH_TOKEN },
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return {
      use: true,
      paths: {
        signIn: VertPaths.SIGN_IN,
        checkAuth: VertPaths.WHO_AM_I,
        afterLogin: '/configurations',
      },
    };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions(): II18nProviderOptions {
    return {
      i18nSources: {
        en: {
          ...englishMessages,
          vert: { configurations: 'Configurations', signedInAs: 'Signed in as user %{userId}' },
        },
      },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }
}
