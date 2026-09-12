import 'reflect-metadata';

import {
  api,
  BaseApiService,
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  type IApplicationInfo,
  type IDataProvider,
  type IRestDataProviderOptions,
  type ISendParams,
  RequestMethods,
} from '@venizia/ardor';
import { inject } from '@venizia/ignis-inversion';

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

export class IdentityApi extends BaseApiService {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    protected dataProvider: IDataProvider,
  ) {
    super({ scope: IdentityApi.name, resource: 'auth' });
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

  // The refresh endpoint is excluded from recovery by `refreshTokenPath`, so a 401 here surfaces.
  @api()
  async refresh(): Promise<void> {
    const params: ISendParams = { method: RequestMethods.POST };
    await this.dataProvider.send({ resource: VertPaths.REFRESH_TOKEN, params });
  }
}

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides extends Record<
    keyof ReturnType<Application['bindingList']>,
    unknown
  > {}
}

declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides {
    'vert.configurations': unknown;
    'vert.signedInAs': unknown;
  }
}

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'vert-admin', version: '0.0.0', description: 'ARDOR admin over IGNIS vert' };
  }

  bindContext(): void {
    const restOptions: IRestDataProviderOptions = {
      url: '/api',
      noAuthPaths: [VertPaths.SIGN_IN],
      authRecovery: {
        refreshTokenPath: VertPaths.REFRESH_TOKEN,
        refreshToken: () => this.get<IdentityApi>({ key: 'services.IdentityApi' }).refresh(),
      },
    };

    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue(restOptions);
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({
      paths: { signIn: VertPaths.SIGN_IN, checkAuth: VertPaths.WHO_AM_I },
      endpoints: { afterLogin: '/configurations' },
    });
    this.bind({ key: CoreBindings.I18N_PROVIDER_OPTIONS }).toValue({
      i18nSources: {
        en: {
          ...englishMessages,
          vert: { configurations: 'Configurations', signedInAs: 'Signed in as user %{userId}' },
        },
      },
      listLanguages: [{ locale: 'en', name: 'English' }],
    });

    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(DefaultRestDataProvider);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);
    this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toProvider(DefaultI18nProvider);
  }

  override bindingList() {
    return { 'services.IdentityApi': IdentityApi };
  }
}
