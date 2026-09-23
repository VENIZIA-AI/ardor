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
for example `CoreBindings.REST_DATA_PROVIDER_OPTIONS` or `'repositories.ProductRepository'`. Binding keys are
namespaced by convention so that services, providers, and options do not collide. See
[Binding key namespaces](/conventions/binding-key-namespaces.md) and
[Binding keys reference](/reference/binding-keys.md).

**CoreBindings** - the const class of fixed framework keys, paths under `@app/` (for example
`'@app/application/instance'`) rather than `<scope>.<ClassName>` keys. It is ARDOR's own, not
re-exported from IGNIS, whose own `CoreBindings` shares the member `APPLICATION_INSTANCE` with a
different value (`'@app/instance'`). See [Binding key namespaces](/conventions/binding-key-namespaces.md).

**Stereotype** - a class decorator from `@venizia/ignis-kernel/metadata`, re-exported by ARDOR
(`service`, `component`, `configuration` and the rest). At import time it records the binding key
on the class and appends the class to a process-global discovery list, which `registerArtifacts()`
binds during `preConfigure()`. It binds first, so a `bindingList()` entry under the same key
overrides it, and a `bindContext()` binding overrides both. See
[Binding key namespaces](/conventions/binding-key-namespaces.md).

**Binding list** - `bindingList()`, the application override that returns literal
`{ 'services.PricingService': PricingService }` keys, bound as singletons after the stereotypes and before
`bindContext()`. Literal keys survive a minifier that rewrites `Class.name`, and they are what types
`useInjectable` through `IUseInjectableKeysOverrides`. See
[Binding key namespaces](/conventions/binding-key-namespaces.md).

**Provider** - something bound with `.toProvider(...)`, resolved lazily and typically producing a
value used by react-admin (the REST data provider, the auth provider, the i18n provider). Contrast
with a class bound with `.toClass(...)` and a static value bound with `.toValue(...)`. See
[DI in the browser](/architecture/di-in-the-browser.md).

**Service** - a class of application logic (for example `PricingService`), as opposed to the
framework-level providers, bound under `services.<ClassName>`. Two ways to register it, as in IGNIS:
mark it `@service()` so the application discovers it, or call `this.service(X)` in `bindContext()`.
Both record the key on the class, so `useService({ target })` resolves either and asserts the class
landed in the `services` namespace. A repository is the same with `@repository` /
`this.repository(X)` / `useRepository`. See [Hooks and services reference](/reference/hooks-and-services.md).

**ApplicationContext** - the React context in `ardor-react` that holds the `container`, the
`registry` and the `logger`. `ArdorApplication` provides it, and `useInjectable` and the stereotype
hooks fall back to its container when none is passed. See
[Hooks and context](/architecture/hooks-and-context.md).

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

**Purity** - the requirement that ARDOR's runtime packages stay browser-safe: kernel and react
import neither a Node builtin nor `ra-core`, and admin imports no Node builtin. `make purity` probes
the built `dist` of kernel, react, admin and the ardor umbrella; the layering half (no React in the
kernel, no react-admin in kernel or react) is `make layer-check`. This is the same guarantee
`ignis-kernel` carries in IGNIS, and it is why the kernel has no controllers, repositories, or
datasource layer of its own - those concepts do not exist in ARDOR. See
[Design decisions](/overview/design-decisions.md).

**Layer boundary** - the dependency order between packages (kernel before react before admin
before the ardor umbrella; ui-kit is independent). A package type-checks against the built `dist`
of its dependency, never its `src`, so rebuilding one package does not automatically propagate to
the next until that package is rebuilt too. See [Monorepo layout](/overview/monorepo-layout.md) and
[Build system](/process/build-system.md).

**Surface snapshot** - a tracked record of a package's public exports, used to catch accidental
additions or removals to what a package exposes. ARDOR generates it itself with its own
`scripts/public-surface.ts` (`make surface-gen`, verified by `make surface-check`), reading the built
`.d.ts` - the same pattern IGNIS follows for its own packages. The snapshot is
[Public surface](/reference/public-surface.md).

**Changelog entry** - a per-release file describing what changed, who is affected, and any breaking
changes, following the IGNIS `content/changelogs/YYYY-MM-DD-<slug>.md` template. See
[Release and publish](/process/release-publish.md).

**Highest line** - the newest published version of a `@venizia/*` dependency, prerelease included,
which ARDOR tracks instead of npm's `latest` tag because a feature shipped on the IGNIS prerelease
line is what the framework builds on. The `@venizia/*` entries of the root `workspaces.catalog` (the
IGNIS packages and `dev-configs`) follow the npm dist-tag `highest` through
`bun scripts/refresh-catalog.ts highest`. ARDOR's own cross-package ranges sit outside the catalog
and follow the semver-highest published version through each package's `force-update highest`.
`make update` runs both. See [Build system](/process/build-system.md) and
[Release and publish](/process/release-publish.md).
