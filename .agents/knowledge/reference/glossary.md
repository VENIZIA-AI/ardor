---
type: Glossary
title: Glossary
description: Definitions of the recurring terms used across the ARDOR knowledge bundle.
resource: packages/kernel/src/base
tags: [reference, glossary, terminology]
---

This page defines terms as they are used across the bundle. Where a term has a fuller treatment,
the definition links to it.

**Application** - the IoC container at the root of an ARDOR app. It extends `BaseArdorApplication`,
implements `getAppInfo()` and `bindContext()`, and is started once (`await application.start()`)
before being handed to `ArdorApplication` as the `container` prop. See
[Application lifecycle](/architecture/application-lifecycle.md).

**Binding key** - the string identifier used to register and resolve something in the container,
for example `CoreBindings.REST_DATA_PROVIDER_OPTIONS` or `'services.ProductApi'`. Binding keys are
namespaced by convention so that services, providers, and options do not collide. See
[Binding key namespaces](/conventions/binding-key-namespaces.md) and
[Binding keys reference](/reference/binding-keys.md).

**Provider** - something bound with `.toProvider(...)`, resolved lazily and typically producing a
value used by react-admin (the REST data provider, the auth provider, the i18n provider). Contrast
with a class bound with `.toClass(...)` and a static value bound with `.toValue(...)`. See
[DI in the browser](/architecture/di-in-the-browser.md).

**Service** - a unit registered with `this.service(SomeApi)` in `bindContext()`, resolved later
through `useInjectable`. Services carry application logic (for example `ProductApi`), as opposed
to the framework-level providers. See [Hooks and services reference](/reference/hooks-and-services.md).

**Data provider** - the react-admin data provider produced by `DefaultRestDataProvider`. It speaks
REST to the backend, understands `noAuthPaths` and `authRecovery`, and is the seam react-admin uses
for all list/get/create/update/delete calls. See
[Data provider pipeline](/architecture/data-provider-pipeline.md).

**Auth recovery** - the `authRecovery` option (for example `{ refreshTokenPath: '/auth/refresh' }`)
that tells the data provider how to obtain a new token when a request fails on an expired one,
instead of failing outright. See [Auth recovery](/architecture/auth-recovery.md).

**No-auth path** - an endpoint listed in `noAuthPaths` (or matched by `noAuthPathRegex`) that is
called before a token exists, such as `/auth/login`. Anything not matched is sent with an
Authorization header and fails without a token. See [No-auth paths](/architecture/no-auth-paths.md).

**Umbrella** - `@venizia/ardor`, the single package an application depends on. It re-exports
`@venizia/ardor-kernel`, `@venizia/ardor-react`, and `@venizia/ardor-admin` so consumers do not need
three separate dependencies. See [`@venizia/ardor`](/packages/ardor.md).

**Augmentation** - declaring extra members on an ARDOR-defined interface via `declare module`, used
to teach TypeScript an application's own binding keys or message keys (for example extending
`IUseInjectableKeysOverrides` or `IUseTranslateKeysOverrides`). See
[Module augmentation](/architecture/module-augmentation.md).

**Purity** - the requirement that `ardor-kernel` and `ardor-react` stay isomorphic: no React in the
kernel, no react-admin, and no server-only or Node-only code leaking into either package. This is
the same guarantee `ignis-kernel` carries in IGNIS, and it is why the kernel has no controllers,
repositories, or datasource layer of its own - those concepts do not exist in ARDOR.

**Layer boundary** - the dependency order between packages (kernel before react before admin
before the ardor umbrella; ui-kit is independent). A package type-checks against the built `dist`
of its dependency, never its `src`, so rebuilding one package does not automatically propagate to
the next until that package is rebuilt too. See [Monorepo layout](/overview/monorepo-layout.md) and
[Build system](/process/build-system.md).

**Surface snapshot** - a tracked record of a package's public exports, used to catch accidental
additions or removals to what a package exposes. IGNIS generates this with `scripts/public-surface.ts`;
it is the artifact [Public surface](/reference/public-surface.md) describes for ARDOR.

**Changelog entry** - a per-release file describing what changed, who is affected, and any breaking
changes, following the IGNIS `content/changelogs/YYYY-MM-DD-<slug>.md` template. See
[Release and publish](/process/release-publish.md).

**Highest line** - the marker in a package's release history for the newest published version, used
so the release chain and the package table can distinguish "latest" from "highest" when versions are
not published in strict order. See [Release and publish](/process/release-publish.md).
