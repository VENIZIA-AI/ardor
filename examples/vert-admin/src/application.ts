import 'reflect-metadata';

import {
  api,
  type BaseArdorApplication as TArdorApplication,
  BaseArdorApplication,
  BaseService,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultNetworkRequestService,
  DefaultRestDataProvider,
  englishMessages,
  type IApplicationInfo,
  type IDataProvider,
  inject,
  LocalStorageKeys,
  type IRestDataProviderOptions,
  type ISendParams,
  provide,
  RequestMethods,
  RequestTypes,
  service,
} from '@venizia/ardor';

// IGNIS `examples/vert` mounts its authentication component at /auth and a CRUD controller at
// /configurations (see examples/vert/src/components/platform.component.ts and
// src/controllers/configuration.controller.ts in the IGNIS repository).
export class VertPaths {
  static readonly SIGN_IN = '/auth/sign-in';
  static readonly WHO_AM_I = '/auth/who-am-i';
  static readonly REFRESH_TOKEN = '/auth/token/refresh';
  static readonly CONFIGURATIONS = 'configurations';
}

export interface IWhoAmI {
  userId: number;
  roles: string[];
}

@service()
export class IdentityService extends BaseService {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    protected dataProvider: IDataProvider,
  ) {
    super({ scope: IdentityService.name });
  }

  @api()
  async whoAmI(): Promise<IWhoAmI> {
    const params: ISendParams = { method: RequestMethods.GET };
    const response = await this.dataProvider.send<IWhoAmI>({
      resource: VertPaths.WHO_AM_I,
      params,
    });
    return response.data;
  }
}

// The refresh is a hook of the network service, so a 401 is recovered where it is seen. The refresh
// endpoint is excluded from recovery by `refreshTokenPath`, so a 401 from it surfaces and
// `onAuthFailure` runs.
class VertNetworkService extends DefaultNetworkRequestService {
  protected override async refreshToken(): Promise<boolean> {
    const { data } = await this.doRequest<{ token: string }>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: [VertPaths.REFRESH_TOKEN],
      headers: this.getRequestHeader({ resource: VertPaths.REFRESH_TOKEN }),
    });

    // IGNIS re-issues the token from the caller's valid one; the next request reads this one.
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: data.token, type: 'Bearer' }),
    );
    return true;
  }
}

// `createNetworkService` is the one place the data provider's service is built.
class VertRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new VertNetworkService({
      name: 'vert-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      authRecovery: this.restDataProviderOptions.authRecovery,
    });
  }
}

declare module '@venizia/ardor-admin' {
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

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'vert-admin', version: '0.0.0', description: 'ARDOR admin over IGNIS vert' };
  }

  bindContext(): void {}
}
