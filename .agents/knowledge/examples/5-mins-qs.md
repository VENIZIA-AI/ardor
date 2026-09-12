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
- **`bindingList()`** - a second binding surface on the application, used here to register
  `ProductApi` under the literal key `'services.ProductApi'`. The comment in the source is explicit
  about why: a literal key string survives minification, while keying off `ProductApi.name` (via
  `this.service(ProductApi)`) would break under a production build that renames classes. This ties
  into [DI in the browser](/architecture/di-in-the-browser.md) and
  [Binding key namespaces](/conventions/binding-key-namespaces.md).
- **`useInjectable` + `useTranslate` + `useListContext`** used together in one component
  (`ProductList`). `useListContext` comes from react-admin/ra-core and supplies rows and `total`
  fetched by the data provider; `useInjectable` resolves `ProductApi` from the container;
  `useTranslate` reads i18n keys declared via module augmentation. See
  [Hooks and context](/architecture/hooks-and-context.md) and
  [Module augmentation](/architecture/module-augmentation.md).
- **Sign-in** through the auth provider: `AUTH_PROVIDER_OPTIONS` sets `paths.signIn` and
  `endpoints.afterLogin`, and `ProductList` calls `useLogout()` from ra-core to sign back out.

Module augmentation is used twice here: once on `@venizia/ardor-react` to teach `useInjectable`
about the keys from `bindingList()` (so the resolved type follows the registration), and once on
`@venizia/ardor-admin` to teach `useTranslate` about the two `quickstart.*` message keys added to
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

`api/server.ts` implements the list contract the data provider expects: it returns rows plus a
`content-range` header, which `DefaultRestDataProvider` reads to populate `total` in the list
context. That total is what `ProductList` prints next to the page title. The "expensive products"
count is not part of this contract - it comes from `ProductApi.findExpensive`, a custom
`@api()`-annotated method on a `BaseApiService` subclass that calls the same data provider directly
with its own query.

## What to read first

Before reading the source, skim [What is ARDOR](/overview/what-is-ardor.md) and
[Onboarding](/overview/onboarding.md) for the shape of an application, then
[Application lifecycle](/architecture/application-lifecycle.md) and
[DI in the browser](/architecture/di-in-the-browser.md) to understand `bindContext` and
`bindingList`. The four files worth opening in order are `src/application.ts` (application, three
providers, `ProductApi`, key augmentations), `src/pages/product-list.tsx` (the three hooks used
together), `src/main.tsx` (`ArdorApplication` receiving the container), and `api/server.ts` (the
list contract, especially `content-range`).
