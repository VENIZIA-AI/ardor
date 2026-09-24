---
title: Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable
description: "Declare an HttpRepository with @repository({ type: RepositoryTypes.REMOTE }), point a datasource at '/api', and raise the IGNIS peers together."
---

# Changelog - 2026-09-24

## Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" />

**In one line.** An `HttpRepository` is now declared the way IGNIS declares every repository, `@repository({ type: RepositoryTypes.REMOTE, dataSource })`, and discovered at `start()`; a datasource takes a relative `baseUrl` such as `'/api'`; and ARDOR builds on IGNIS 0.2.0, its first stable line.

This entry and [2026-09-23](./2026-09-23-registration-by-hand-and-clean-install) ship in the same release.

## What changed

### New

- **Repositories by discovery.** `RepositoryTypes` is exported from `@venizia/ardor`. `@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })` declares a repository with no model. `@repository` injects the datasource into the first constructor parameter, and `start()` binds the repository as a singleton. Registering by hand with `this.repository(X)` still works.
- **A relative `baseUrl`.** `HttpDataSource` accepts `'/api'` and resolves it against the page's `location` when a request is sent, so the `new URL('/api', window.location.origin).href` workaround is gone. It no longer calls `URL.canParse`, so it constructs on iOS Safari before 17 and Chrome before 120.

## Who is affected

- **Every application.** Move the IGNIS packages to the stable `0.2.0`: `kernel`, `connectors`, `helpers`, `inversion` and `filter`. ARDOR's peers are now `^0.2.0`, bounded to 0.2.x. They used to be open-ended (`>=0.2.0-4x`), which a future IGNIS 0.3.0 would also have satisfied. A prerelease such as `0.2.0-47` no longer satisfies them.
- **Applications that add `@repository` to a repository written for registration by hand.** Nothing to change: `@inject({ target })` on a datasource registered by hand is accepted.
- **Code with no page `location`** (Bun, a test runner) keeps an absolute `baseUrl`. A relative one throws on the first request there.

## Details

```ts
import {
  datasource,
  readAuthTokenFromStorage,
  repository,
  RepositoryTypes,
  useRepository,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: '/api', authTokenResolver: readAuthTokenFromStorage });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class ProductRepository extends HttpRepository<{ id: number; price: number }> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }
}

// Nothing in bindContext(): start() discovers both classes.
export const useProducts = () => useRepository({ target: ProductRepository });
```

The two ways mix. `@repository` used to throw at import on `@inject({ target })` naming a datasource registered by hand, because that class has no key until `bindContext()` runs. ARDOR reported it and IGNIS fixed it in kernel 0.2.0-47, which went into the stable 0.2.0: it judges such a class by its class, so both shapes work:

```ts no-check
@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class ProductRepository extends HttpRepository<TProduct> {
  constructor(@inject({ target: ApiDataSource }) dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }
}

// ...
this.dataSource(ApiDataSource); // in bindContext()
```

- The quickstart, the root README and `examples/5-mins-qs` declare their datasource and repository this way. The example's production bundle renames both classes and still resolves them, because the key goes with the class, not with its name.
- `RepositoryTypes` comes from `@venizia/ignis-kernel/repository`, IGNIS's browser-weight entry. It adds 0.01 kB to the kernel (6.55 kB of a 7.7 kB budget).
- IGNIS 0.2.0 is the same code as its last prereleases (kernel 0.2.0-47, connectors 0.2.0-46, helpers 0.2.0-41, inversion 0.2.0-24, filter 0.2.0-23); ARDOR compared the published tarballs. Nothing else in that line reaches ARDOR: ARDOR has no generated client, no worker bundle and no `strictPath`, and its application has no `stop()`.

| File | Package |
|------|---------|
| `src/base/metadata/index.ts` (`RepositoryTypes`) | kernel |
| `src/__tests__/base/applications/remote-repository.test.ts` | kernel |
| `package.json` peers | kernel, react, admin, ardor |
| `src/application.ts` | examples/5-mins-qs |
