# @venizia/ardor

Frontend application framework for the VENIZIA family - one entry point over
[`@venizia/ardor-kernel`](https://www.npmjs.com/package/@venizia/ardor-kernel),
[`@venizia/ardor-react`](https://www.npmjs.com/package/@venizia/ardor-react) and
[`@venizia/ardor-admin`](https://www.npmjs.com/package/@venizia/ardor-admin).

IGNIS is the backend framework; ARDOR is its frontend sibling and a consumer of it - inversion of
control comes from `@venizia/ignis-inversion`, and the data layer speaks the query vocabulary of
`@venizia/ignis-filter`.

```bash
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter reflect-metadata
```

## Quick start

```typescript
import 'reflect-metadata';

import {
  type BaseArdorApplication as TArdorApplication,
  BaseArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  type IApplicationInfo,
  inject,
  provide,
} from '@venizia/ardor';

// Every framework binding, declared: start() binds each @provide method under its key, SINGLETON.
@configuration()
export class SellerConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return {
      url: import.meta.env.VITE_API_URL,
      noAuthPaths: ['/auth/login'],
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions() {
    return {
      paths: { signIn: '/auth/login' },
      endpoints: { afterLogin: '/dashboard' },
    };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {};
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
    return { name: 'seller', version: '1.0.0', description: 'Seller console' };
  }

  bindContext(): void {}
}
```

The full guide, including the root component and the typed hooks, is in the
[repository README](https://github.com/VENIZIA-AI/ardor#readme).

## Migrating from `@minimaltech/ra-core-infra`

ARDOR is that package, split and rebranded. See
[the migration guide](https://github.com/VENIZIA-AI/ardor/blob/develop/docs/migration/ra-core-infra.md) -
the move is four mechanical edits plus four symbol renames.

## License

MIT - see [LICENSE.md](./LICENSE.md).
