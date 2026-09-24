---
title: Registration by hand, useRepository, and a clean-install gate
description: Register artifacts by stereotype or by hand as in IGNIS, resolve repositories by class, BaseApiService removed, packages proven installable.
---

# Changelog - 2026-09-23

## Registration by hand, useRepository, and a clean-install gate

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="New Feature" /> <Badge type="info" text="Bug Fix" />

**In one line.** An application registers its classes the two ways IGNIS does, by stereotype or by hand, and both resolve by class; `useRepository` is new, `BaseApiService` is gone, and every package is now proven to install and load in an empty project before it is released.

This entry covers everything since `0.1.1-3`.

## What changed

### New

- **Two ways to register, as in IGNIS.** Discovery is unchanged: a class marked `@service()` (or another stereotype) is bound when the application starts. By hand, `bindContext()` calls `this.service(X)`, `this.repository(X)`, `this.dataSource(X)` or `this.component(X)`. Each returns the `Binding` and takes `{ binding, scope, allowOverride }`.
- **Every path records the key on the class.** A class registered by hand, through `bindingList()` or through `injectable()` now resolves by `{ target }`, in a hook and in `@inject({ target })`. Before, only a stereotyped class did.
- **`useRepository`.** Resolves a repository by class and checks that it is bound under `repositories`, like `useService` does for `services`.
- **`registerArtifacts()` honours a stereotype's `scope`.** It used to bind every discovered class as a singleton whatever the stereotype declared. The default is still singleton.

### Fixed

- **The packages load under Node ESM.** Compiled imports carried no file extension, and `lodash` deep imports had no `.js`, so `node` refused to load them. Only bundlers had worked.
- **The umbrella declares its optional peers.** `@venizia/ardor` re-exports `./repository` and `./socket-io` but did not declare `@venizia/ignis-connectors` or `socket.io-client` as peers, so a strict linker could not resolve them.
- **`react-redux` is a required peer of `ardor-react`.** It was marked optional while the package imports it at load time, so an install without it crashed on import.

## Who is affected

- **Applications with a `BaseApiService` subclass.** Extend `BaseService` instead; see below.
- **Every application.** Raise the IGNIS peers to `connectors 0.2.0-44`, `kernel 0.2.0-45`, `helpers 0.2.0-40`, `filter 0.2.0-22` and `inversion 0.2.0-23`, and use Bun 1.4 or later.
- **Applications that resolve a class by key only because `{ target }` used to throw.** Nothing breaks; `{ target }` now works for them too.

## Breaking changes

`BaseApiService` is removed. `@api()` works on any `BaseService` and logs a `resource` field when the class has one.

**Before:**

```ts no-check
export class ProductApi extends BaseApiService {
  constructor() {
    super({ scope: 'ProductApi', resource: 'products' });
  }
  // ...
}
```

**After:**

```ts
import { api, BaseService } from '@venizia/ardor';

export class PricingService extends BaseService {
  protected resource = 'products';

  constructor() {
    super({ scope: 'PricingService' });
  }

  @api()
  async quote(): Promise<number> {
    return 42;
  }
}
```

For reads over HTTP, prefer an `HttpRepository`; see [Repositories](../references/repository).

## Details

```ts
import 'reflect-metadata';

import {
  BaseArdorApplication,
  readAuthTokenFromStorage,
  useRepository,
  type IApplicationInfo,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';
import { inject } from '@venizia/ignis-inversion';

export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'https://api.example.com', authTokenResolver: readAuthTokenFromStorage });
  }
}

export class TicketRepository extends HttpRepository<{ id: string; status: string }> {
  constructor(@inject({ target: ApiDataSource }) dataSource: ApiDataSource) {
    super({ dataSource, resource: 'tickets' });
  }
}

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'desk', version: '1.0.0', description: 'Help desk' };
  }

  bindContext(): void {
    this.dataSource(ApiDataSource); // datasources.ApiDataSource
    this.repository(TicketRepository); // repositories.TicketRepository
  }
}

export const useTickets = () => useRepository({ target: TicketRepository });
```

- Every kind binds a singleton by default, discovery included. IGNIS's server defaults services and repositories to transient; a React hook resolves on every render, so a transient repository would give each render a new instance.
- The key is `opts.binding`, else the stereotype's `binding`, else `<namespace>.<ClassName>`. `allowOverride: false` throws when the key is already bound.
- Discovery of an `HttpRepository` arrived a day later, with IGNIS kernel 0.2.0-46: see [2026-09-24](./2026-09-24-remote-repositories-and-relative-base-url).
- `make clean-install` packs every package, installs the tarballs into empty projects under the hoisted and the isolated linker, and imports every published entry with Bun, Node ESM and a browser build. CI runs it, and the release workflow runs it for the package before the version bump. It found the three fixes above.
- A lint rule refuses `crypto.randomUUID` in package and example code: browsers define it only on a secure origin.
- The release commit now carries `bun.lock` with `package.json`, so a local install after a release no longer leaves a stray lockfile diff.

| File | Package |
|------|---------|
| `src/base/applications/abstract.ts` (registration by hand) | kernel |
| `src/base/decorators/api.ts`; `src/base/services/api.ts` deleted | kernel |
| `src/hooks/use-artifact.ts` (`useRepository`) | react |
| `tsconfig.build.json` (`resolveFullPaths`), lodash imports | all |
| `package.json` peers and engines | kernel, react, admin, ardor |
| `scripts/clean-install/`, `scripts/eslint/secure-context.mjs` | repository |
| `.github/workflows/ci.yml`, `package-release.yml` | repository |
