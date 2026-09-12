<div align="center">

<br />

# :droplet: ARDOR

**react-admin's data contract. IGNIS's container.**

[![Docs](https://img.shields.io/badge/Docs-ardor.venizia.ai-0369A1.svg?style=flat-square)](https://ardor.venizia.ai)
[![npm](https://img.shields.io/npm/v/@venizia/ardor.svg?style=flat-square&color=cb3837&label=@venizia/ardor)](https://www.npmjs.com/package/@venizia/ardor)
[![License: MIT](https://img.shields.io/badge/License-MIT-3DA639.svg?style=flat-square)](LICENSE.md)
[![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.3-f472b6.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Documentation](https://ardor.venizia.ai) &#8226;
[Quickstart](https://ardor.venizia.ai/guides/get-started/quickstart) &#8226;
[References](https://ardor.venizia.ai/references/) &#8226;
[Examples](#examples) &#8226;
[Changelog](https://ardor.venizia.ai/changelogs/)

</div>

---

Frontend application framework for the VENIZIA family. IGNIS is the backend framework; ARDOR is its
frontend sibling and a consumer of it - a react-admin application built as an IGNIS
inversion-of-control container. You bind providers and services by key; React resolves them
through hooks; the data layer speaks the IGNIS filter vocabulary to your API.

## Install

```bash
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter reflect-metadata
bun add ra-core react react-dom react-redux @reduxjs/toolkit react-router-dom @tanstack/react-query
bun add -d typescript @venizia/dev-configs @types/react @types/react-dom
```

> [!IMPORTANT]
> `experimentalDecorators` and `emitDecoratorMetadata` must be `true` in your `tsconfig.json`, declared
> **inline** - a bundler does not resolve them through `extends`, and `@inject` is silently dropped without
> them. Import `reflect-metadata` once, before the application class is defined.

## Hello world

```typescript
import 'reflect-metadata';

import {
  api, BaseApiService, BaseArdorApplication, CoreBindings,
  DefaultAuthProvider, DefaultAuthService, DefaultI18nProvider, DefaultRestDataProvider,
  type IApplicationInfo, type IDataProvider, type ISendParams, RequestMethods,
} from '@venizia/ardor';
import { inject } from '@venizia/ignis-inversion';

class ProductApi extends BaseApiService {
  constructor(@inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) protected dataProvider: IDataProvider) {
    super({ scope: ProductApi.name, resource: 'products' });
  }

  @api()
  async findAll(): Promise<{ id: number; name: string }[]> {
    const params: ISendParams = { method: RequestMethods.GET };
    return (await this.dataProvider.send<{ id: number; name: string }[]>({ resource: this.resource, params })).data;
  }
}

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides extends Record<keyof ReturnType<Application['bindingList']>, unknown> {}
}

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({ url: '/api', noAuthPaths: ['/auth/login'] });
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({ paths: { signIn: '/auth/login' }, endpoints: { afterLogin: '/products' } });
    this.bind({ key: CoreBindings.I18N_PROVIDER_OPTIONS }).toValue({});

    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(DefaultRestDataProvider);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
    this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);
    this.bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER }).toProvider(DefaultI18nProvider);
  }

  // Literal keys survive a minifier and type `useInjectable` through the augmentation above.
  override bindingList() {
    return { 'services.ProductApi': ProductApi };
  }
}
```

```tsx
import { ArdorApplication, useInjectable, useTranslate } from '@venizia/ardor';

const ProductList = () => {
  const productApi = useInjectable<ProductApi>({ key: 'services.ProductApi' });
  const translate = useTranslate();
  // ...
};

const application = new Application();
await application.start();

createRoot(root).render(
  <ArdorApplication container={application} reduxStore={store} suspense={<Spinner />} resources={[{ name: 'products', list: ProductList }]} />,
);
```

Full walkthrough: [5-minute quickstart](https://ardor.venizia.ai/guides/get-started/quickstart) -
then the [references](https://ardor.venizia.ai/references/).

## What you get

| | |
| :--- | :--- |
| **Dependency injection in the browser** | The application is an IGNIS `Container`; `bindingList()`, `@inject`, `useInjectable` by key or by class |
| **A typed REST data layer** | react-admin's `getList`/`getOne`/... mapped onto the IGNIS filter vocabulary (`where`, `order`, `limit`, `skip`), totals from `content-range`, `send()` for anything else |
| **Auth with recovery** | Login/logout/checkAuth/checkError providers; a 401 triggers one token refresh and one retry, never a loop; no-auth paths are explicit |
| **i18n with typed keys** | English and Vietnamese bundles, `useTranslate` keys typed through module augmentation |
| **Hooks** | `useDebounce`, `useAutosave`, `useConfirm`, `useNotifyError`, `useRefreshToken`, typed Redux hook factories |
| **Browser-pure core** | `ardor-kernel` imports no Node builtin and no React; every package is gated for purity, layering, bundle size and a public-surface snapshot |
| **A design system** | `ardor-ui-kit`: Tailwind + Radix components and Figma-derived tokens |

[References](https://ardor.venizia.ai/references/) &#8226;
[Extensions](https://ardor.venizia.ai/extensions/) &#8226;
[Best practices](https://ardor.venizia.ai/best-practices/)

## Packages

In release order - each builds on the ones above it.

| Package | Role | Latest | Highest |
| :--- | :--- | ---: | ---: |
| [`@venizia/ardor-kernel`](packages/kernel/) | Isomorphic core: application base, services, network layer, constants and keys | [![npm](https://img.shields.io/npm/v/@venizia/ardor-kernel.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-kernel) | [![npm highest](https://img.shields.io/npm/v/@venizia/ardor-kernel/highest.svg?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@venizia/ardor-kernel) |
| [`@venizia/ardor-react`](packages/react/) | React bindings: application context, `useInjectable`, UI hooks, Redux factories | [![npm](https://img.shields.io/npm/v/@venizia/ardor-react.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-react) | [![npm highest](https://img.shields.io/npm/v/@venizia/ardor-react/highest.svg?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@venizia/ardor-react) |
| [`@venizia/ardor-admin`](packages/admin/) | react-admin adapter: data, auth and i18n providers, the ra-core hooks | [![npm](https://img.shields.io/npm/v/@venizia/ardor-admin.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-admin) | [![npm highest](https://img.shields.io/npm/v/@venizia/ardor-admin/highest.svg?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@venizia/ardor-admin) |
| [`@venizia/ardor`](packages/ardor/) | The umbrella - one import over the three above | [![npm](https://img.shields.io/npm/v/@venizia/ardor.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor) | [![npm highest](https://img.shields.io/npm/v/@venizia/ardor/highest.svg?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@venizia/ardor) |
| [`@venizia/ardor-ui-kit`](packages/ui-kit/) | Design system: Tailwind + Radix components, design tokens | [![npm](https://img.shields.io/npm/v/@venizia/ardor-ui-kit.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-ui-kit) | [![npm highest](https://img.shields.io/npm/v/@venizia/ardor-ui-kit/highest.svg?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/@venizia/ardor-ui-kit) |

**Latest** is the stable line. **Highest** is the newest published version, prerelease included, and
it is the tag this repository releases to today. ARDOR tracks the **highest** published IGNIS line
(`@venizia/ignis-inversion`, `@venizia/ignis-filter`, `@venizia/dev-configs`) - never `latest`. The
documentation site lives in [`docs/wiki`](docs/wiki/) and is not published to npm.

## Is ARDOR for you?

**Yes** if you are building a react-admin console that must scale with a team - many resources, real
auth, services shared across screens - and especially if your API already runs on IGNIS.

**Probably not** for a marketing site, a three-screen tool, or a UI that is not an admin. Plain
react-admin is lighter.

| | Plain react-admin | **ARDOR** |
| :--- | :--- | :--- |
| Services | module singletons, hand-wired | IoC container, `bindingList()`, `@inject` |
| Data layer | write your own `dataProvider` | REST provider speaking the IGNIS filter vocabulary |
| Auth recovery | do it yourself | one refresh, one retry, explicit no-auth paths |
| Key typing | strings | `useInjectable` and `useTranslate` keys typed through augmentation |
| Structure | do it yourself | guided, the IGNIS way |

> [!NOTE]
> ARDOR is 0.x: minor versions can break. It replaces `@minimaltech/ra-core-infra`, which runs in
> production at nine applications; the core patterns are that package's, hardened. Pin exact versions
> and read the [changelog](https://ardor.venizia.ai/changelogs/) before upgrading.

## Examples

| Example | What it shows |
| :--- | :--- |
| [5-mins-qs](examples/5-mins-qs/) | The smallest app that runs: sign-in, a resource list, a service resolved by key, against a stub API |
| [vert-admin](examples/vert-admin/) | The family reference: an admin console over IGNIS's `vert` API - its auth component, token refresh, a CRUD list |
| [ipc-data-provider](examples/ipc-data-provider/) | `DefaultRestDataProvider.send` over a non-HTTP transport, the desktop-shell pattern |

```bash
cd examples/5-mins-qs
bun run api          # stub API on :3100 - sign in with admin / admin
bun run dev          # Vite on :5173
```

## Contributing

```bash
git clone https://github.com/VENIZIA-AI/ardor.git && cd ardor
bun install
make build           # kernel -> react -> admin -> ardor -> ui-kit
make test            # bun test, every package
make lint
make docs            # the wiki, with the sidebar and snippet gates
```

Conventional Commits (`feat:`, `fix:`, `docs:`, ...), branches `feature/*` / `fix/*`, and **PRs target
`develop`**. Bun only - never npm, yarn, or pnpm. See [CONTRIBUTING.md](CONTRIBUTING.md),
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md). Agents read
[AGENTS.md](AGENTS.md); `make agent-setup` links the rules and the knowledge bundle into your tool.

## Migrating from `@minimaltech/ra-core-infra`

ARDOR is that package, split and rebranded. See the
[migration guide](https://ardor.venizia.ai/guides/migration/from-ra-core-infra) - a codemod plus four
symbol renames.

## Credits

Standing on [IGNIS](https://ignis.venizia.ai) (the container and the filter vocabulary),
[react-admin](https://marmelab.com/react-admin/) (the data contract and the UI runtime), and
[LoopBack 4](https://loopback.io/) (the binding-key and provider patterns).

MIT licensed - see [LICENSE.md](LICENSE.md).
Questions: [GitHub Issues](https://github.com/VENIZIA-AI/ardor/issues) &#8226; developer@venizia.ai
