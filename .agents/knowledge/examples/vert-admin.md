---
type: Example
title: vert-admin
description: An ARDOR admin console over IGNIS's examples/vert API demonstrating auth recovery, checkAuth, and a CRUD list.
resource: examples/vert-admin/src/application.ts
tags: [example, vert-admin, ignis, auth, crud]
---

## What it is

`vert-admin` is the family reference example that pairs an ARDOR console with the IGNIS `examples/vert`
API. It is deliberately production-shaped: it signs in through IGNIS's authentication component, checks
session validity against a who-am-i endpoint, recovers expired tokens through a refresh call routed
through an injected service, and lists a real CRUD resource (`configurations`) with totals read from
`content-range`. Anyone wiring a new ARDOR app against a real backend should read this example before
inventing their own auth wiring.

## Run vert first

`vert-admin` has nothing to talk to until the IGNIS API is running. It needs PostgreSQL and Redis:

```bash
cd ../../../ignis/examples/vert
cp .env.example .env.development
bun install && bun run migrate:dev && bun run server:dev
```

Then start the console itself with `bun run dev` from `examples/vert-admin`; Vite proxies `/api` to the
vert server on port 3000. Sign in with a user seeded by `bun run seed:authz` in vert. See
[Build, run, test](/overview/build-run-test.md) for the general pattern this follows.

## VertPaths

`VertPaths` is a const-class holding the literal routes that IGNIS's `examples/vert` mounts: `/auth/sign-in`,
`/auth/who-am-i`, `/auth/token/refresh`, and the `configurations` CRUD resource. Centralizing these as
static readonly fields (see [Const classes](/conventions/const-classes.md)) means the rest of the
application - the data provider options, the auth provider options, and the identity service - all
reference the same strings instead of duplicating literals.

## checkAuth against who-am-i

The auth provider options bound in `bindContext()` set `paths.signIn` to `VertPaths.SIGN_IN` and
`paths.checkAuth` to `VertPaths.WHO_AM_I`. This means react-admin's session check hits the who-am-i
endpoint rather than trusting a cached flag; a 401 there routes the app back to sign-in. This is the
same auth-provider contract described in [Application lifecycle](/architecture/application-lifecycle.md)
and the header protocol used by the data provider is covered in [Header protocol](/architecture/header-protocol.md).

## authRecovery via an injected service

The REST data provider options include an `authRecovery` block with `refreshTokenPath` set to
`VertPaths.REFRESH_TOKEN` and a `refreshToken` callback. That callback does not call the data provider
directly - it resolves `IdentityApi` from the container (`this.get<IdentityApi>({ key: 'services.IdentityApi' })`)
and calls its `refresh()` method. `IdentityApi` is a `BaseApiService` bound via `bindingList()`, so it is
resolved through the same DI container as everything else - see [DI in the browser](/architecture/di-in-the-browser.md).
The refresh endpoint itself is listed in `noAuthPaths` is not set for it (only sign-in is), so a failed
refresh surfaces as a real error instead of looping - the general shape of this mechanism is documented in
[Auth recovery](/architecture/auth-recovery.md) and [No-auth paths](/architecture/no-auth-paths.md).

`IdentityApi.whoAmI()` and `IdentityApi.refresh()` are both decorated with `@api()` and call
`this.dataProvider.send(...)` with an explicit `RequestMethods`, following the pattern in
[Data provider pipeline](/architecture/data-provider-pipeline.md).

## configurations CRUD list

`src/pages/configurations.tsx` renders a react-admin list backed by the `configurations` resource. It
reads records through `useListContext`, resolves collaborating services through `useInjectable` (see
[Hooks and context](/architecture/hooks-and-context.md)), and reports failures with `useNotifyError`
against an `ApplicationError` - the standard error-handling shape from
[Error handling](/conventions/error-handling.md) and [Error flow](/architecture/error-flow.md). Totals for
the list come from the `content-range` header returned by the vert API, which the data provider parses as
part of its normal response pipeline.

## Module augmentation and i18n

The example augments `IUseInjectableKeysOverrides` from `@venizia/ardor-react` with the shape of
`bindingList()`'s return type, and augments `IUseTranslateKeysOverrides` from `@venizia/ardor-admin` with
its own `vert.configurations` and `vert.signedInAs` keys. This is the standard
[Module augmentation](/architecture/module-augmentation.md) technique for getting type-safe autocomplete
on bindings and translation keys without editing framework packages. The i18n provider options add these
keys to the English message bundle on top of `englishMessages`, following
[i18n](/architecture/i18n.md).

## Where things live

- `src/application.ts` - `VertPaths`, `IdentityApi`, and the `Application` class binding rest, auth, and
  i18n provider options plus `bindingList()`.
- `src/pages/configurations.tsx` - the CRUD list page.

This example builds on the same [`@venizia/ardor`](/packages/ardor.md) and
[`@venizia/ardor-admin`](/packages/admin.md) packages used throughout the bundle; for the base concepts
behind `BaseArdorApplication` and provider options, see [What is ARDOR](/overview/what-is-ardor.md) and
[Onboarding](/overview/onboarding.md).
