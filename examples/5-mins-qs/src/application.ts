import 'reflect-metadata';

import {
  type BaseArdorApplication as TArdorApplication,
  BaseArdorApplication,
  configuration,
  CoreBindings,
  datasource,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  type IApplicationInfo,
  inject,
  provide,
  readAuthTokenFromStorage,
  repository,
  RepositoryTypes,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface IProduct {
  id: number;
  name: string;
  price: number;
}

// Declared, never listed: the application discovers both classes at start(). A relative baseUrl
// resolves against the page, and Vite proxies `/api` to the stub API.
@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: '/api', authTokenResolver: readAuthTokenFromStorage });
  }
}

// One class per resource, in the IGNIS filter vocabulary. `@repository` injects the datasource, and
// `count` reads the total from `Content-Range`.
@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class ProductRepository extends HttpRepository<IProduct> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }

  countExpensive(opts: { minimumPrice: number }) {
    return this.count({ where: { price: { gte: opts.minimumPrice } } });
  }
}

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
    return { url: '/api', noAuthPaths: ['/auth/login'] };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions() {
    return { paths: { signIn: '/auth/login' }, endpoints: { afterLogin: '/products' } };
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
      listLanguages: [{ locale: 'en', name: 'English' }],
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

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'quickstart', version: '0.0.0', description: 'ARDOR 5-minute quickstart' };
  }

  bindContext(): void {}
}
