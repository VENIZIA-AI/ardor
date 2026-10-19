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

`BaseArdorApplication` (in `packages/kernel/src/base/applications/abstract.ts`) extends `AbstractArdorApplication`, which extends the IGNIS `Container`. The application instance is the container; call `this.bind(...)` and `this.get(...)` directly on it.

Subclasses implement two abstract methods:

- **`getAppInfo()`**: Returns an `IApplicationInfo` object containing `name`, `version`, and `description`. `preConfigure()` binds this metadata under `CoreBindings.APPLICATION_INFO`. Return a plain object, because the value is bound directly without awaiting.
- **`bindContext()`**: Hook for registering container bindings by hand (such as `this.service()`, `this.repository()`, `this.dataSource()`, `this.component()`, or `this.bind()`). Bindings placed here override any binding declared by a configuration class or stereotype decorator.

## The start() Lifecycle

The `start()` method in `packages/kernel/src/base/applications/abstract.ts` awaits three steps in order:

1. **`resolveArtifactIndexes()`**: Evaluates `this.artifacts()`. Plain artifact indexes or pre-inlined groups (from `IgnisArtifactsPlugin`) are kept as-is. Dynamic groups with a `resolve()` function (such as `AutoArtifacts` from `@venizia/ignis-boot/auto`) have `resolve()` awaited to import modules and trigger decorators. Stored in `this.resolvedIndexes` for verification.
2. **`preConfigure()`**: Directly binds `CoreBindings.APPLICATION_INSTANCE`, `CoreBindings.APPLICATION_INFO`, and `CoreBindings.FEATURES`. It runs stereotypes and `@provide` methods, features, `bindingList()`, and `bindContext()`. For details, see [The bind order](./configuration).
3. **`postConfigure()`**: Runs after `preConfigure()` and `bindContext()` complete. Defaults to an empty function in `BaseArdorApplication`; override it for post-startup logic like cache warmups or runtime checks.

## ArdorApplication on Render

`ArdorApplication` (in `packages/admin/src/components/application.tsx`) connects the IGNIS container to React. When rendered, it executes the following steps:

1. **Reads features**: Calls `Features.read({ container })` to retrieve features bound under `CoreBindings.FEATURES`.
2. **Mounts resources and routes**: Calls `Features.mount({ features, resources, routes })` in `packages/admin/src/features/feature.ts`. Application resources and routes mount first, then each feature's in order. Duplicate resource names throw `[features] Resource '<name>' is mounted by both ... | A resource name is unique within an application`.
3. **Resolves default providers**: Resolves framework providers from the container via `container.get()`:
   - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`: Required `IDataProvider`.
   - `CoreBindings.DEFAULT_AUTH_PROVIDER`: Optional `IAuthProvider` (`isOptional: true`). If unbound, `ArdorApplication` omits `authProvider`, running react-admin without sign-in so every page is public.
   - `CoreBindings.DEFAULT_I18N_PROVIDER`: Required `I18nProvider`.
4. **Verifies internationalization readiness**: Calls `useFeatureMessagesReady`. If a feature supplies lazy translation loaders for the active locale, triggers `i18nProvider.changeLocale()` and renders the `suspense` fallback until ready.
5. **Wraps the component hierarchy**:
   - `ApplicationContext.Provider` with `{ container, logger }` (`Logger.getInstance({ scope: applicationName, enableDebug })`).
   - `ReduxProvider` with `reduxStore`.
   - `React.Suspense` with `suspense`.
6. **Renders CoreAdmin**: Passes providers and forwarded props, mounting resources as `<Resource key={resource.name} {...resource} />` and routes inside `<CustomRoutes>` as `<Route key={route.id ?? route.path} {...route} />`.

## Application Props

`ArdorApplication` accepts `IApplication` props (in `packages/admin/src/common/types.ts`), extending `CoreAdminProps` (omitting `children`):

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `container` | `Container` | Yes | The started IoC container instance (an instance of `BaseArdorApplication`). |
| `reduxStore` | `Store` | Yes | Redux store instance used for react-admin state management. |
| `suspense` | `ReactNode` | Yes | Fallback React node displayed while components or feature translations load. |
| `enableDebug` | `boolean` | No | Enables debug-level logging in the application logger. Default is `false`. |
| `resources` | `Array<ResourceProps>` | No | Resource definitions registered before feature resources. |
| `routes` | `Array<RouteProps>` | No | Custom routes registered inside `CustomRoutes` before feature routes. |
| `...reactAdminProps` | `Omit<CoreAdminProps, 'children'>` | No | Additional react-admin properties (such as `loginPage`, `layout`, `dashboard`, `title`, `theme`, `catchAll`, `basename`) passed directly to `CoreAdmin`. |

## Next Steps

- Learn how configuration classes bind options and providers: [Configuration](./configuration)
- Configure framework providers: [Providers](./providers)
- Register resource definitions and custom pages: [Resources and Pages](./resources-and-pages)
- Explore dependency injection with hooks and services: [Dependency Injection](./dependency-injection)
