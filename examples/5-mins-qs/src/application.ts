import 'reflect-metadata';

import {
  BaseArdorApplication,
  CoreBindings,
  datasource,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  type IApplicationInfo,
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

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'quickstart', version: '0.0.0', description: 'ARDOR 5-minute quickstart' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: '/api',
      noAuthPaths: ['/auth/login'],
    });
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({
      paths: { signIn: '/auth/login' },
      endpoints: { afterLogin: '/products' },
    });
    this.bind({ key: CoreBindings.I18N_PROVIDER_OPTIONS }).toValue({
      i18nSources: {
        en: {
          ...englishMessages,
          quickstart: { title: 'Products', expensive: 'Expensive products (>= 5,000)' },
        },
      },
      listLanguages: [{ locale: 'en', name: 'English' }],
    });

    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(DefaultRestDataProvider);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);
    this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toProvider(DefaultI18nProvider);
  }
}
