---
type: Example
title: 5-mins-qs
description: A minimal runnable ARDOR application showing an application class, three default providers, one service, and one resource page wired end to end.
resource: examples/5-mins-qs
tags: [example, quickstart, application, providers, hooks]
---

## What it demonstrates

`examples/5-mins-qs` is the smallest complete ARDOR application. It shows the pieces every real
app needs together:

- An **application class** (`Application extends BaseArdorApplication`) that declares app info and
  binds context - see [Application lifecycle](/architecture/application-lifecycle.md).
- The **three default providers** every ARDOR app typically wires: `DefaultRestDataProvider`,
  `DefaultAuthProvider` (backed by `DefaultAuthService`), and `DefaultI18nProvider`. Each is bound
  under a `CoreBindings` key with its own options object, following
  [Options objects](/conventions/options-objects.md). See [Data provider pipeline](/architecture/data-provider-pipeline.md),
  [Auth recovery](/architecture/auth-recovery.md) and [I18n](/architecture/i18n.md).
- **Discovery by `AutoArtifacts`** - `ApiDataSource extends HttpDataSource` (`src/datasources/`), declared `@datasource()` with the relative
  `baseUrl: '/api'`, and `ProductRepository extends HttpRepository<IProduct>` (`src/repositories/`), declared
  `@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })`, each in a file of its own. `IgnisArtifactsVitePlugin` (in `vite.config.ts`) lists every decorated class under `src/` in the bundle; `Application.artifacts()` returns `AutoArtifacts`; the module that imports it holds no decorated class and is imported by none. `start()` binds each class as a
  singleton, `@repository` injects the datasource, and `useRepository({ target })` resolves by
  class, which survives a minifier because the plugin pins the name of each class it lists (ignis-boot 0.2.1-11; -10 used `keepNames` for the whole build): the production bundle keeps those names, renames the rest, and works. This ties into [DI in the browser](/architecture/di-in-the-browser.md) and
  [Binding key namespaces](/conventions/binding-key-namespaces.md).
- **`useRepository` + `useTranslate` + `useListContext`** used together in one component
  (`ProductList`). `useListContext` comes from react-admin/ra-core and supplies rows and `total`
  fetched by the data provider; `useRepository` resolves `ProductRepository` from the container;
  `useTranslate` reads i18n keys declared via module augmentation. See
  [Hooks and context](/architecture/hooks-and-context.md) and
  [Module augmentation](/architecture/module-augmentation.md).
- **Sign-in** through the auth provider, on IGNIS's contract by default: `POST /auth/sign-in` with the
  `identifier`/`credential` body, answered with `{ userId, roles, token: { value, type } }`; `AUTH_PROVIDER_OPTIONS` sets only `paths.afterLogin`, `noAuthPaths` lists `/auth/sign-in`, and `ProductList` calls `useLogout()` from ra-core to sign back out.

- **Vendor chunks** - `vite.config.ts` sets `build.rolldownOptions.output.codeSplitting` groups (React, other vendor): the build is about 595 KB whole (188 KB gzipped), over Vite's 500 KB warning, and three chunks of 10, 219 and 364 KB leave no warning.

The wiki quickstart (`guides/get-started/5-minute-quickstart`) includes this example's `application.ts`, `datasources/`, `repositories/`, `configurations/`, `pages/*.tsx`, `main.tsx` and `vite.config.ts` with VitePress code imports, so renaming or moving one of them breaks the docs build.

Module augmentation is used once, on `@venizia/ardor-admin`, to teach `useTranslate` about the two `quickstart.*` message keys added to
`englishMessages`.

## How to run

```bash
bun install                # from the repository root
cd examples/5-mins-qs
bun run api                # stub API on :3100 - sign in with admin / admin
bun run dev                # Vite on :5173, proxying /api
```

Open `http://localhost:5173`, sign in, and the product list renders through the data provider
pipeline. See [Build, run, test](/overview/build-run-test.md) for the general commands this
example's scripts wrap.

## What the stub API returns

`api/server.ts` answers `POST /api/auth/sign-in` as an IGNIS backend does: it reads `identifier.value` and `credential.value`, and returns `{ userId, roles, token: { value, type } }`, the shape recommended for an IGNIS `signIn` (IGNIS returns whatever the application's service returns). The bare-token shape is covered by the admin tests.

`api/server.ts` implements the list contract the data provider expects: it returns rows plus a
`content-range` header, which `DefaultRestDataProvider` reads to populate `total` in the list
context. That total is what `ProductList` prints next to the page title. The "expensive products"
count is not part of this contract - it comes from `ProductRepository.countExpensive`, which calls
`count({ where: { price: { gte } } })` through the datasource; the stub reads `where.price.gte` and
answers an empty page with `records */N`.

## What to read first

Before reading the source, skim [What is ARDOR](/overview/what-is-ardor.md) and
[Onboarding](/overview/onboarding.md) for the shape of an application, then
[Application lifecycle](/architecture/application-lifecycle.md) and
[DI in the browser](/architecture/di-in-the-browser.md) to understand `@configuration` + `@provide` and
the registration modes. The files worth opening in order are `src/application.ts` (the application and `AutoArtifacts`), `src/configurations/admin.configuration.ts` (the three providers, the translate augmentation), `src/datasources/` and `src/repositories/` (one decorated class per file), `src/pages/product-list.tsx` (the three hooks used
together), `src/main.tsx` (`ArdorApplication` receiving the container), and `api/server.ts` (the
list contract, especially `content-range`).
