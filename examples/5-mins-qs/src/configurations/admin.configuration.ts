import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  inject,
  provide,
} from '@venizia/ardor';

// The message keys this application adds, made known to `useTranslate`.
declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides {
    'quickstart.title': unknown;
    'quickstart.expensive': unknown;
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
  restDataProviderOptions() {
    return { url: '/api', noAuthPaths: ['/auth/sign-in'] };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions() {
    // The sign-in path and body default to IGNIS's auth controller: POST /auth/sign-in.
    return { paths: { afterLogin: '/products' } };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: {
        en: {
          ...englishMessages,
          quickstart: { title: 'Products', expensive: 'Expensive products (>= 5,000)' },
        },
      },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
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
