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
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  type IApplicationInfo,
} from '@venizia/ardor';

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'seller', version: '1.0.0', description: 'Seller console' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: import.meta.env.VITE_API_URL,
      noAuthPaths: ['/auth/login'],
    });
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({
      paths: { signIn: '/auth/login' },
      endpoints: { afterLogin: '/dashboard' },
    });
    this.bind({ key: CoreBindings.I18N_PROVIDER_OPTIONS }).toValue({});

    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(DefaultRestDataProvider);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);
    this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toProvider(DefaultI18nProvider);
  }
}
```

The full guide, including the root component and the typed hooks, is in the
[repository README](https://github.com/VENIZIA-AI/ardor#readme).

## Migrating from `@minimaltech/ra-core-infra`

ARDOR is that package, split and rebranded. See
[the migration guide](https://github.com/VENIZIA-AI/ardor/blob/develop/docs/migration/ra-core-infra.md) -
the move is a codemod plus four symbol renames.

## License

MIT - see [LICENSE.md](./LICENSE.md).
