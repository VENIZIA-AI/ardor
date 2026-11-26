---
title: Application
description: Understand the ARDOR application container, the start() lifecycle, and how ArdorApplication mounts the React tree.
---

# Application

An ARDOR application pairs a `BaseArdorApplication` inversion-of-control container with an `<ArdorApplication />` React root component that mounts react-admin. To start the application, extend `BaseArdorApplication`, call `await application.start()`, and pass the container to `<ArdorApplication />`.

Create `src/application.ts`:

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

Create `src/main.tsx`:

<<< @/../../../examples/5-mins-qs/src/main.tsx{tsx}

> [!NOTE]
> For the complete API contract and method signatures, see the [Application Reference](../../references/application).

## BaseArdorApplication

`BaseArdorApplication` (in `packages/admin/src/applications/base.ts`) extends `AbstractArdorApplication` (in `packages/kernel/src/base/applications/abstract.ts`), which extends the IGNIS `Container`. The application instance is the container; call `this.bind(...)` and `this.get(...)` directly on it. A package that needs only the kernel extends `AbstractArdorApplication`.

`BaseArdorApplication` binds the default providers itself (the REST data, auth and i18n providers and the auth service), each a singleton, before anything of the application. The application binds only their options (see [Providers](./providers)).

Subclasses implement two abstract methods:

- **`getAppInfo()`**: Returns an `IApplicationInfo` object containing `name`, `version`, and `description`, and optionally an `id` that scopes the session and store keys in browser storage to this application. `preConfigure()` binds this metadata under `CoreBindings.APPLICATION_INFO`. Return the object, or a promise of it: `preConfigure()` waits for a promise before it binds the rest.
- **`bindContext()`**: Hook for registering container bindings by hand (such as `this.service()`, `this.repository()`, `this.dataSource()`, `this.component()`, or `this.bind()`). Bindings placed here override any binding declared by a configuration class, stereotype decorator, feature or `bindingList()`, including a class declared `allowOverride: false`.

## The start() Lifecycle

The `start()` method in `packages/kernel/src/base/applications/abstract.ts` awaits three steps in order:

1. **`resolveArtifactIndexes()`**: Evaluates `this.artifacts()`. Plain artifact indexes or pre-inlined groups (from `IgnisArtifactsPlugin`) are kept as-is. Dynamic groups with a `resolve()` function (such as `AutoArtifacts` from `@venizia/ignis-boot/auto`) have `resolve()` awaited to import modules and trigger decorators. Stored in `this.resolvedIndexes` for verification.
2. **`preConfigure()`**: Directly binds `CoreBindings.APPLICATION_INSTANCE` and `CoreBindings.APPLICATION_INFO`. It then binds the default providers, runs stereotypes and `@provide` methods, binds the features under `CoreBindings.FEATURES`, and runs `bindingList()` and `bindContext()`. For details, see [The bind order](./configuration#the-bind-order).
3. **`postConfigure()`**: Runs after `preConfigure()` and `bindContext()` complete. It is declared in `AbstractArdorApplication` and empty there; `BaseArdorApplication` overrides it to call `ApplicationProviders.assertConfigured`, which resolves the providers so a missing options binding rejects `start()` and not the first render. A subclass that overrides `postConfigure()` for post-startup logic, like cache warmups or runtime checks, calls `super.postConfigure()` first.

## ArdorApplication on Render

`ArdorApplication` (in `packages/admin/src/components/application.tsx`) connects the IGNIS container to React. When rendered, it executes the following steps:

1. **Reads features**: When the `features` prop is absent, calls `Features.read({ container })` to retrieve features bound under `CoreBindings.FEATURES`. The prop replaces that read.
2. **Mounts resources and routes**: Calls `Features.mount({ features, resources, routes })` in `packages/admin/src/features/feature.ts`. Application resources and routes mount first, then each feature's in order. Duplicate resource names throw `[features] Resource '<name>' is mounted by both ... | A resource name is unique within an application`.
3. **Resolves default providers**: Resolves framework providers from the container via `container.get()`:
   - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`: Required `IDataProvider`.
   - `CoreBindings.DEFAULT_AUTH_PROVIDER`: `IAuthProvider`, resolved only when `CoreBindings.AUTH_PROVIDER_OPTIONS` is `{ use: true }`. With `{ use: false }`, or no auth options, `ArdorApplication` omits `authProvider`, running react-admin without sign-in so every page is public.
   - `CoreBindings.DEFAULT_I18N_PROVIDER`: Required `I18nProvider`.
4. **Verifies internationalization readiness**: Calls `useFeatureMessagesReady`. If a feature supplies lazy translation loaders for the active locale, triggers `i18nProvider.changeLocale()` and renders the `suspense` fallback until ready.
5. **Wraps the component hierarchy**:
   - `ApplicationContext.Provider` with `{ container, logger }` (the `logger` prop, else a console logger named `ArdorApplication`).
   - `ReduxProvider` with `reduxStore`, only when the prop is passed.
   - `React.Suspense` with `suspense`.
6. **Renders CoreAdmin**: Passes providers and forwarded props, mounting resources as `<Resource key={resource.name} {...resource} />` and routes inside `<CustomRoutes>` as `<Route key={route.id ?? route.path} {...route} />`. It also mounts a default access-denied page at `/access-denied`, or the component you pass as `accessDenied`.

## Application Props

`ArdorApplication` accepts `IArdorApplicationProps` props (in `packages/admin/src/common/types.ts`), extending `CoreAdminProps` (omitting `children`). Each prop, with its type and whether it is required, is in the [Application reference](../../references/application#props).

## Next Steps

- Learn how configuration classes bind options and providers: [Configuration](./configuration)
- Configure framework providers: [Providers](./providers)
- Register resource definitions and custom pages: [Resources and Pages](./resources-and-pages)
- Explore dependency injection with hooks and services: [Dependency Injection](./dependency-injection)
