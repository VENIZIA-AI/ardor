import {
  configuration,
  CoreBindings,
  type IRestDataProviderOptions,
  provide,
  RuntimeConfig,
  type TAuthProviderOptions,
} from '@venizia/ardor';

// An application without sign-in binds two options. BaseArdorApplication binds the providers.
@configuration()
export class AdminConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    // No sign-in: no request carries an Authorization header. The API is `/api` (the image's nginx
    // forwards it to API_UPSTREAM) unless VITE_API_URL says otherwise: set in .env in dev, or written to
    // config.js when the container starts, so one built image serves every environment.
    const url = RuntimeConfig.get({
      key: 'VITE_API_URL',
      buildTimeEnv: import.meta.env,
      defaultValue: '/api',
    });

    return { url, noAuth: { regex: /./ } };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: false };
  }
}
