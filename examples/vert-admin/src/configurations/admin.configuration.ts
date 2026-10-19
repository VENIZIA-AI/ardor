import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  englishMessages,
  inject,
  type IRestDataProviderOptions,
  provide,
} from '@venizia/ardor';

import { VertPaths } from '@/constants/vert-paths';
import { VertRestDataProvider } from '@/providers/vert-rest-data.provider';

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'vert.configurations': unknown;
    'vert.signedInAs': unknown;
  }
}

// Every framework binding, declared. start() binds each @provide method under its key, SINGLETON,
// built on first use: react-admin, the auth provider and every hook share one data provider - its
// token, headers and single 401 refresh.
@configuration()
export class AdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: '/api',
      noAuthPaths: [VertPaths.SIGN_IN],
      authRecovery: { refreshTokenPath: VertPaths.REFRESH_TOKEN },
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions() {
    return {
      paths: {
        signIn: VertPaths.SIGN_IN,
        checkAuth: VertPaths.WHO_AM_I,
        afterLogin: '/configurations',
      },
    };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
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

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(VertRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
  authService() {
    return this.application.instantiate(DefaultAuthService);
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
  authProvider() {
    return this.application.instantiate(DefaultAuthProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.application.instantiate(DefaultI18nProvider).value(this.application);
  }
}
