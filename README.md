<div align="center">

# <img src="https://ardor.venizia.ai/logo.svg" alt="" height="32" align="top"> ARDOR

**A TypeScript framework for admin consoles on react-admin: dependency injection, a REST data provider, sign-in with token refresh and i18n.**

[![Docs](https://img.shields.io/badge/Docs-ardor.venizia.ai-0369A1.svg?style=flat-square)](https://ardor.venizia.ai)
[![npm](https://img.shields.io/npm/v/@venizia/ardor.svg?style=flat-square&color=cb3837&label=@venizia/ardor)](https://www.npmjs.com/package/@venizia/ardor)
[![License: MIT](https://img.shields.io/badge/License-MIT-3DA639.svg?style=flat-square)](LICENSE.md)
[![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.4-f472b6.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Documentation](https://ardor.venizia.ai) &#8226;
[Quickstart](https://ardor.venizia.ai/guides/get-started/5-minute-quickstart) &#8226;
[References](https://ardor.venizia.ai/references/) &#8226;
[Examples](https://ardor.venizia.ai/guides/get-started/examples) &#8226;
[Changelog](https://ardor.venizia.ai/changelogs/)

</div>

---

ARDOR builds admin consoles on `ra-core`, the core of react-admin. You write configuration classes,
repositories and pages; ARDOR wires them through an [IGNIS](https://ignis.venizia.ai) dependency
injection container, sends your REST API the IGNIS filter language, and handles sign-in, token
refresh and i18n. It is for teams with many resources, real auth and services shared across screens,
most of all when the API already runs on IGNIS.

## Start

A new project, with an admin, a Dockerfile and runtime configuration (see
[Create a project](https://ardor.venizia.ai/guides/get-started/create-a-project)):

```bash
bun x @venizia/vulcan init --preset ardor --project demo --frontend-dir apps --app admin
```

Or install into an existing Vite and React project (the peers and the `tsconfig.json` options are in
[Setup](https://ardor.venizia.ai/guides/get-started/setup)):

```bash
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel \
  @venizia/ignis-helpers @venizia/ignis-connectors ra-core ra-i18n-polyglot react react-dom \
  react-redux @reduxjs/toolkit react-router-dom @tanstack/react-query reflect-metadata
```

## Hello world

```tsx
import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import {
  ArdorApplication, BaseArdorApplication, configuration, CoreBindings, DefaultI18nProvider,
  DefaultRestDataProvider, englishMessages, type IApplicationInfo, inject, provide,
} from '@venizia/ardor';
import { createRoot } from 'react-dom/client';

@configuration()
class AdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly app: BaseArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  dataOptions() {
    return { url: '/api', noAuthPathRegex: /./ };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nOptions() {
    return {
      i18nSources: { en: englishMessages },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  dataProvider() {
    return this.app.instantiate(DefaultRestDataProvider).value(this.app);
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.app.instantiate(DefaultI18nProvider).value(this.app);
  }
}

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {}
}

const application = new Application();
const store = configureStore({
  reducer: { app: (state: { ready: boolean } = { ready: true }) => state },
});

// Binds every @provide method. The auth provider stays unbound, so every page is public.
await application.start();

createRoot(document.getElementById('root')!).render(
  <ArdorApplication
    container={application}
    reduxStore={store}
    suspense={<p>Loading</p>}
    dashboard={() => <h1>Hello from ARDOR</h1>}
  />,
);
```

Next: the [Quickstart](https://ardor.venizia.ai/guides/get-started/5-minute-quickstart) adds a
repository, a resource page and sign-in.

## What you get

- **Dependency injection in the browser:** the application is an IGNIS container; [Application](https://ardor.venizia.ai/guides/core-concepts/application)
- **A REST data provider** on the IGNIS filter language, totals from `Content-Range`: [Data provider](https://ardor.venizia.ai/references/data-provider)
- **Sign-in with token refresh:** a 401 refreshes once, then retries: [Auth provider](https://ardor.venizia.ai/references/auth-provider)
- **i18n with typed keys,** English and Vietnamese included: [Internationalization](https://ardor.venizia.ai/references/i18n)
- **HTTP repositories** that share the data provider's session: [Repositories](https://ardor.venizia.ai/references/repository)
- **Runtime configuration and an nginx image** in the generated project: [Create a project](https://ardor.venizia.ai/guides/get-started/create-a-project#one-image-for-every-environment)

## Packages

| Package | Role | Version |
| :--- | :--- | ---: |
| [`@venizia/ardor-kernel`](packages/kernel/) | The container, services, network layer and runtime config; no UI | [![npm](https://img.shields.io/npm/v/@venizia/ardor-kernel.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-kernel) |
| [`@venizia/ardor-react`](packages/react/) | React bindings: application context, `useInjectable`, hooks | [![npm](https://img.shields.io/npm/v/@venizia/ardor-react.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-react) |
| [`@venizia/ardor-admin`](packages/admin/) | The ra-core adapter: data, auth and i18n providers, `ArdorApplication` | [![npm](https://img.shields.io/npm/v/@venizia/ardor-admin.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor-admin) |
| [`@venizia/ardor`](packages/ardor/) | The umbrella: one import over the three above | [![npm](https://img.shields.io/npm/v/@venizia/ardor.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@venizia/ardor) |

> [!NOTE]
> ARDOR is 0.x: minor versions can break. Read the [changelog](https://ardor.venizia.ai/changelogs/)
> before upgrading.

## Contributing

`bun install && make build`, then see [CONTRIBUTING.md](CONTRIBUTING.md): Conventional Commits, branches `feature/*` or `fix/*`, pull requests to `develop`, Bun only.

MIT licensed - see [LICENSE.md](LICENSE.md).
Questions: [GitHub Issues](https://github.com/VENIZIA-AI/ardor/issues) &#8226; developer@venizia.ai

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
