---
title: Registration by hand, useRepository, and installs that load
description: Register artifacts by stereotype or by hand as in IGNIS, resolve repositories by class, BaseApiService removed, packages load under Node ESM.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react']
---

# Changelog - 2026-09-23

## Registration by hand, useRepository, and installs that load

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="New Feature" /> <Badge type="info" text="Bug Fix" />

**In one line.** An application registers its classes the two ways IGNIS does, by stereotype or by hand, and both resolve by class; `useRepository` is new, `BaseApiService` is gone, and the packages now load under Node ESM and install with strict linkers.

This entry covers everything since `0.1.1-3`.

## What changed

### New

- **Two ways to register, as in IGNIS.** A class marked `@service()` (or another stereotype) is still bound when the application starts. By hand, `bindContext()` calls `this.service(X)`, `this.repository(X)`, `this.dataSource(X)` or `this.component(X)`. Each returns the `Binding` and takes `{ binding, scope, allowOverride }`.
- **Every path records the key on the class.** A class registered by hand, through `bindingList()` or through `injectable()` now resolves by `{ target }`, in a hook and in `@inject({ target })`. Before, only a stereotyped class did.
- **`useRepository`.** Resolves a repository by class and checks that it is bound under `repositories`, like `useService` does for `services`.
- **Stereotype `scope` is honoured.** Discovered classes used to bind as singletons whatever the stereotype declared. The default is still singleton.

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

- Every kind binds a singleton by default, discovery included. IGNIS's server defaults services and repositories to transient; a React hook resolves on every render, so a transient repository would give each render a new instance.
- The key is `opts.binding`, else the stereotype's `binding`, else `<namespace>.<ClassName>`. `allowOverride: false` throws when the key is already bound.
- Discovery of an `HttpRepository` arrived a day later, with IGNIS kernel 0.2.0-46: see [2026-09-24](./2026-09-24-remote-repositories-and-relative-base-url).
