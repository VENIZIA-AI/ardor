# @venizia/ardor

Frontend application framework for the VENIZIA family - one entry point over
[`@venizia/ardor-kernel`](https://www.npmjs.com/package/@venizia/ardor-kernel),
[`@venizia/ardor-react`](https://www.npmjs.com/package/@venizia/ardor-react) and
[`@venizia/ardor-admin`](https://www.npmjs.com/package/@venizia/ardor-admin).

IGNIS is the backend framework; ARDOR is its frontend sibling and a consumer of it - inversion of
control comes from `@venizia/ignis-inversion`, and the data layer speaks the query vocabulary of
`@venizia/ignis-filter`.

```bash
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers reflect-metadata
```

The React-side peers (`react`, `react-dom`, `react-redux`, `@reduxjs/toolkit`, `@tanstack/react-query`, `ra-core`, `ra-i18n-polyglot`, `react-router-dom`) are installed too; the full `bun add` line is in the [setup guide](https://ardor.venizia.ai/guides/get-started/setup).

## The `Ardor` namespace

`Ardor` gathers every React hook of the react and admin packages under one name: `Ardor.useRepository(...)`, `Ardor.useTranslate()`. It is the same function as the bare `useRepository`, the Rules of Hooks check the call, and a bundler keeps only the hooks you use, so it adds no bytes to an app.

```tsx
import { Ardor } from '@venizia/ardor';

import { OrdersRepository } from './orders.repository';

export const Orders = () => {
  const repository = Ardor.useRepository({ target: OrdersRepository });

  return <div>{String(repository)}</div>;
};
```

## Moving to the new names

`bun run ardor codemod namespace src` (inside a package that depends on `@venizia/ardor`; never through `bunx`, `bun x` or `npx`, which fetch an unrelated package named `ardor` when the bin is not installed) lists the removed bare names that have a replacement (`getRuntimeConfig` to `RuntimeConfig.get`, `isDefined` to `ValueUtility.isDefined`, `NullableType` to `undefined | null | void`, `Logger.getInstance({ scope })` to `LoggerFactory.getLogger([scope])`, ...) and the removed names with none, and writes nothing; `--write` applies it (it refuses a file with local changes unless you add `--allow-dirty`), `--check` fails while any is left, and `--hooks` also moves hooks imported from `@venizia/ardor` to `Ardor.useX`. It needs the `typescript` package. `ardor codemod --list` prints the name of each codemod.

## Subpaths

- `@venizia/ardor/repository` - `HttpRepository` and the datasource settings; needs the optional peer `@venizia/ignis-connectors`.
- `@venizia/ardor/testing` - `assertArdorApplicationBoots` and fakes of `ResizeObserver`, `IntersectionObserver`, `matchMedia`, storage and the clipboard, for your test suite.
- `@venizia/ardor/vite` - `buildInfoFile`, a Vite plugin that writes the build info file; needs the optional peers `@venizia/ignis-boot` and `vite`.

## Quick start

`BaseArdorApplication` binds the default providers. An application binds their options:

```typescript
import 'reflect-metadata';

import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  type IApplicationInfo,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';

@configuration()
export class SellerConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: import.meta.env.VITE_API_URL,
      noAuthPaths: ['/auth/sign-in'],
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: true, paths: { afterLogin: '/dashboard' } };
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
[Quickstart](https://ardor.venizia.ai/guides/get-started/5-minute-quickstart) and the
[references](https://ardor.venizia.ai/references/hooks).

## Migrating from `@minimaltech/ra-core-infra`

ARDOR is that package, split and rebranded. See
[the migration guide](https://ardor.venizia.ai/guides/migrations/from-ra-core-infra) -
the move is four mechanical edits plus four symbol renames.

## License

MIT - see [LICENSE.md](./LICENSE.md).

---

<p align="center">
  <a href="https://venizia.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://venizia.ai/assets/logo-white.svg">
      <img src="https://venizia.ai/assets/logo.svg" alt="VENIZIA" height="28">
    </picture>
  </a>
  <br>
  <sub>ARDOR is built and maintained by <a href="https://venizia.ai">VENIZIA</a>.</sub>
</p>
