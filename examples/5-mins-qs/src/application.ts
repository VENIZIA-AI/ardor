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
  type ISendParams,
  RequestMethods,
} from '@venizia/ardor';
import { inject } from '@venizia/ignis-inversion';

export interface IProduct {
  id: number;
  name: string;
  price: number;
}

// A service: one class per resource, bound under `services.ProductApi` by `this.service(...)`.
export class ProductApi extends BaseApiService {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    protected dataProvider: IDataProvider,
  ) {
    super({ scope: ProductApi.name, resource: 'products' });
  }

  @api()
  async findExpensive(opts: { minimumPrice: number }): Promise<IProduct[]> {
    const params: ISendParams = { method: RequestMethods.GET, query: { filter: { limit: 100 } } };
    const response = await this.dataProvider.send<IProduct[]>({ resource: this.resource, params });
    return response.data.filter((product) => product.price >= opts.minimumPrice);
  }
}

// The keys this application binds, made known to `useInjectable` and `useTranslate`. The
// injectable keys are derived from `bindingList()`, so the type follows the registration.
declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides extends Record<
    keyof ReturnType<Application['bindingList']>,
    unknown
  > {}
}

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

  // Literal keys survive a minifier; `this.service(ProductApi)` would key on `ProductApi.name`,
  // which a production build rewrites.
  override bindingList() {
    return { 'services.ProductApi': ProductApi };
  }
}
