<div align="center">

<br />

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
[Examples](examples/) &#8226;
[Changelog](https://ardor.venizia.ai/changelogs/)

</div>

---

ARDOR is a TypeScript framework for admin consoles that outgrow a single screen. It builds on
`ra-core`, the core of react-admin: you write configuration classes, repositories and pages; ARDOR
wires them through an [IGNIS](https://ignis.venizia.ai) dependency injection container, sends your
REST API the IGNIS filter language, and handles sign-in, token refresh and i18n. It is 0.x: a patch
release can carry a breaking change, labeled in the
[changelog](https://ardor.venizia.ai/changelogs/) with how to migrate.

## Get started

```bash
bun x @venizia/vulcan init --preset ardor --project demo --frontend-dir apps --app admin
cd demo && make dev    # the admin on http://localhost:5173/
```

The generated `src/configurations/admin.configuration.ts` binds the providers the admin needs:

```typescript
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  getRuntimeConfig,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class AdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    // The API is `/api` unless VITE_API_URL says otherwise, in .env or in the container's config.js.
    const url = getRuntimeConfig({
      key: 'VITE_API_URL',
      buildTimeEnv: import.meta.env,
      defaultValue: '/api',
    });

    return { url, noAuthPathRegex: /./ };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: { en: englishMessages },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.application.instantiate(DefaultI18nProvider).value(this.application);
  }
}
```

Next: the [Quickstart](https://ardor.venizia.ai/guides/get-started/5-minute-quickstart), or
[add ARDOR to an existing project](https://ardor.venizia.ai/guides/get-started/setup).

## What you get

- **Dependency injection in the browser** - the application is an IGNIS container, configured with `@configuration` and `@provide` classes: [application](https://ardor.venizia.ai/guides/core-concepts/application), [configuration](https://ardor.venizia.ai/guides/core-concepts/configuration).
- **A REST data provider** - react-admin's data calls sent in the IGNIS filter language, totals from `Content-Range`: [data provider](https://ardor.venizia.ai/references/data-provider).
- **Sign-in with token refresh** - a 401 refreshes once for a burst of requests, then retries them: [auth provider](https://ardor.venizia.ai/references/auth-provider).
- **i18n with typed keys** - English and Vietnamese included, your own keys checked through module augmentation: [internationalization](https://ardor.venizia.ai/references/i18n).
- **HTTP repositories** - read the same API with the data provider's token and headers: [repositories](https://ardor.venizia.ai/references/repository).
- **Runtime configuration and an nginx image** - one built image for every environment, with `/health` and security headers: [create a project](https://ardor.venizia.ai/guides/get-started/create-a-project#one-image-for-every-environment).

## Packages

| Package | Role |
| :--- | :--- |
| [`@venizia/ardor`](packages/ardor/) | The umbrella: one import over the three packages below, and the VULCAN preset |
| [`@venizia/ardor-kernel`](packages/kernel/) | The container, services, network layer and runtime config; no UI |
| [`@venizia/ardor-react`](packages/react/) | React bindings: application context, `useInjectable`, hooks |
| [`@venizia/ardor-admin`](packages/admin/) | The ra-core adapter: data, auth and i18n providers, `ArdorApplication` |

The documentation site lives in [`docs/wiki`](docs/wiki/) and is not published to npm. Runnable
projects are in [`examples/`](examples/).

## Contributing

Bun 1.4 or later; pull requests target `develop`. See [CONTRIBUTING.md](CONTRIBUTING.md). MIT
licensed - see [LICENSE.md](LICENSE.md). Questions: [GitHub Issues](https://github.com/VENIZIA-AI/ardor/issues).

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
