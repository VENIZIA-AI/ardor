import {
  configuration,
  CoreBindings,
  englishMessages,
  type II18nProviderOptions,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';

// The message keys this application adds, made known to `useTranslate`.
declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'quickstart.title': unknown;
    'quickstart.expensive': unknown;
  }
}

// The options of the framework providers. BaseArdorApplication binds the providers, each a SINGLETON
// built on first use: react-admin, the auth provider and every hook share one data provider - its
// token, headers and single 401 refresh.
@configuration()
export class AdminConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: '/api', noAuth: { paths: ['/auth/sign-in'] } };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    // The sign-in path and body default to IGNIS's auth controller: POST /auth/sign-in.
    return { use: true, paths: { afterLogin: '/products' } };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions(): II18nProviderOptions {
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
}
