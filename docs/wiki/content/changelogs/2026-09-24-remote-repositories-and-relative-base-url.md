---
title: Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable
description: "Declare an HttpRepository with @repository({ type: RepositoryTypes.REMOTE }), point a datasource at '/api', and raise the IGNIS peers together."
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-09-24

## Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" />

**In one line.** An `HttpRepository` is now declared the way IGNIS declares every repository, `@repository({ type: RepositoryTypes.REMOTE, dataSource })`, and discovered at `start()`; a datasource takes a relative `baseUrl` such as `'/api'`; and ARDOR builds on IGNIS 0.2.0, its first stable line.

This entry and [2026-09-23](./2026-09-23-registration-by-hand-and-clean-install) ship in the same release.

## What changed

- **Repositories by discovery.** `RepositoryTypes` is exported from `@venizia/ardor`. `@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })` declares a repository with no model. `@repository` injects the datasource into the first constructor parameter, and `start()` binds the repository as a singleton. Registering by hand with `this.repository(X)` still works.
- **A relative `baseUrl`.** `HttpDataSource` accepts `'/api'` and resolves it against the page's `location` when a request is sent, so the `new URL('/api', window.location.origin).href` workaround is gone. It no longer calls `URL.canParse`, so it constructs on iOS Safari before 17 and Chrome before 120.
- **The two registration styles mix.** `@inject({ target })` naming a datasource registered by hand is accepted by `@repository` (fixed in IGNIS kernel 0.2.0-47, part of stable 0.2.0).

## Who is affected

- **Every application.** Move the IGNIS packages to the stable `0.2.0`: `kernel`, `connectors`, `helpers`, `inversion` and `filter`. ARDOR's peers are now `^0.2.0`, bounded to 0.2.x. A prerelease such as `0.2.0-47` no longer satisfies them.
- **Applications that add `@repository` to a repository written for registration by hand.** Nothing to change.
- **Code with no page `location`** (Bun, a test runner) keeps an absolute `baseUrl`. A relative one throws on the first request there.

## Details

```ts
import {
  datasource,
  DefaultNetworkRequestService,
  repository,
  RepositoryTypes,
  useRepository,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: '/api', authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage });
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

A datasource registered by hand also works: put `@inject({ target: ApiDataSource })` on the constructor parameter and call `this.dataSource(ApiDataSource)` in `bindContext()`.
