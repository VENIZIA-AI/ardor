import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  inject,
  provide,
} from '@venizia/ardor';

// The two providers an application without sign-in needs. start() binds each @provide method under its
// key; the auth provider stays unbound, so every page is public.
@configuration()
export class AdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    // No sign-in: no request carries an Authorization header.
    return { url: '/api', noAuthPathRegex: /./ };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: { en: englishMessages },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.application.instantiate(DefaultI18nProvider).value(this.application);
  }
}
