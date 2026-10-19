---
title: Application
description: Understand the ARDOR application container, the start() lifecycle, and how ArdorApplication mounts the React tree.
---

# Application

An ARDOR application consists of two halves:

1. **`BaseArdorApplication`**: A TypeScript class that extends the IGNIS `Container`. The application class is the inversion-of-control container. It defines the startup lifecycle, registers discovered artifacts and features, and exposes dependency injection methods.
2. **`ArdorApplication`**: A React component that accepts the started container, resolves framework providers from it, and renders react-admin's `CoreAdmin`.

To start an application, extend `BaseArdorApplication`, implement `getAppInfo()` and `bindContext()`, call `await application.start()`, and pass the started container instance to `<ArdorApplication />`.

> [!NOTE]
> For the complete API contract and method signatures, see the [Application Reference](../../references/application).

## First Example

The minimal setup requires an application class and an entry file.

Create `src/application.ts`:

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

Create `src/main.tsx`:

<<< @/../../../examples/5-mins-qs/src/main.tsx{tsx}

In `src/application.ts`, `Application` extends `BaseArdorApplication`. It implements `getAppInfo()` to provide application metadata, and implements `bindContext()` for manual bindings. Its `artifacts()` method returns `AutoArtifacts` from `@venizia/ignis-boot/auto`, which supplies the build-time list of decorated classes.

In `src/main.tsx`, `new Application()` instantiates the container. Calling `await application.start()` executes the container lifecycle. Finally, `createRoot` mounts `<ArdorApplication />`, passing the started container, Redux store, suspense fallback, and resources.

## The Two Halves

### BaseArdorApplication: The Container

`BaseArdorApplication` (in `packages/kernel/src/base/applications/abstract.ts`) extends `AbstractArdorApplication`, which extends the IGNIS `Container`. There is no separate container property; the application instance is the container. You call `this.bind(...)` and `this.get(...)` directly on the application instance.

`BaseArdorApplication` requires two abstract methods:

- **`getAppInfo()`**: Returns an `IApplicationInfo` object containing `name`, `version`, and `description`. `preConfigure()` binds this metadata under `CoreBindings.APPLICATION_INFO`. Return a plain object, because the value is bound directly without awaiting.
- **`bindContext()`**: A hook for registering container bindings by hand (such as `this.service()`, `this.repository()`, `this.dataSource()`, `this.component()`, or `this.bind()`). In standard applications, providers and options are declared on `@configuration()` classes, so `bindContext()` is often empty. When an explicit binding is placed here, it overrides any binding declared by a configuration class or stereotype decorator.

### ArdorApplication: The React Root

`ArdorApplication` (in `packages/admin/src/components/application.tsx`) is the top-level React component. It accepts the started application container as `container`, resolves the default data, authentication, and internationalization providers, and hands them to react-admin's `CoreAdmin`.

## The start() Lifecycle

The `start()` method in `packages/kernel/src/base/applications/abstract.ts` coordinates startup by awaiting each step in this order:

1. Resolve artifact indexes
2. `preConfigure()`
3. `postConfigure()`

### 1. Resolve Artifact Indexes

`start()` calls `this.resolveArtifactIndexes()` before running any configuration logic. It evaluates the artifact index list returned by `this.artifacts()`:

- For plain artifact indexes or pre-inlined artifact groups (such as bundles produced by `IgnisArtifactsPlugin`), the index is kept as-is.
- For dynamic artifact groups with a `resolve()` function (such as `AutoArtifacts` from `@venizia/ignis-boot/auto`), `start()` awaits `group.resolve()`. This dynamically imports the application modules, evaluating classes and triggering their decorators.

The resolved indexes are stored in `this.resolvedIndexes` so `registerArtifacts()` can verify that every declared class was discovered.

### 2. preConfigure()

The order is least explicit first (stereotypes and @provide methods, then features, then bindingList(), then bindContext()):

```
Stereotypes and @provide methods  <  Features  <  bindingList()  <  bindContext()
```

For the exact steps, see [The bind order](./configuration).

> [!NOTE]
> `preConfigure()` itself directly binds three keys: `APPLICATION_INSTANCE`, `APPLICATION_INFO`, and `FEATURES`. All other keys are registered through `@provide` methods, `bindingList()`, `bindContext()`, or stereotype decorators.

### 3. postConfigure()

`postConfigure()` runs after `preConfigure()` and all asynchronous work in `bindContext()` complete.

In `BaseArdorApplication`, `postConfigure()` is an empty function. Override it to execute logic that requires container bindings to be in place, such as resolving a service to warm up a cache or performing runtime checks.

## ArdorApplication on Render

`ArdorApplication` (in `packages/admin/src/components/application.tsx`) connects the IGNIS container to React. When rendered, it executes the following steps:

1. **Reads features**: Calls `Features.read({ container })` to retrieve any features bound under `CoreBindings.FEATURES`.
2. **Mounts resources and routes**: Calls `Features.mount({ features, resources, routes })` in `packages/admin/src/features/feature.ts`. The application's own `resources` and `routes` props mount first, followed by each feature's resources and routes in order. If two features or the application define the same resource name, `Features.mount` throws an error when `ArdorApplication` renders (`[features] Resource '<name>' is mounted by both ... | A resource name is unique within an application`). This uniqueness check applies to resource names only; routes are combined in order without duplicate checking.
3. **Resolves default providers**: Resolves the framework providers from the container using `container.get()`:
   - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`: Required. Supplies the `IDataProvider` implementation for data fetching, custom HTTP methods, and authentication headers.
   - `CoreBindings.DEFAULT_AUTH_PROVIDER`: Optional. Resolved with `isOptional: true`. If unbound, `ArdorApplication` omits `authProvider`, running react-admin without sign-in so every page is public.
   - `CoreBindings.DEFAULT_I18N_PROVIDER`: Required. Supplies the react-admin `I18nProvider`.
4. **Verifies internationalization readiness**: Calls `useFeatureMessagesReady`. If any feature supplies lazy translation loaders for the active locale, `ArdorApplication` triggers `i18nProvider.changeLocale()` to load them and displays the `suspense` fallback until messages are ready.
5. **Wraps the component hierarchy**:
   - Wraps the tree in `ApplicationContext.Provider` with `{ container, logger }`. The logger is created via `Logger.getInstance({ scope: applicationName, enableDebug })`.
   - Wraps with `ReduxProvider` using the provided `reduxStore`.
   - Wraps with `React.Suspense` using the provided `suspense` fallback element.
6. **Renders CoreAdmin**:
   - Passes `dataProvider`, `authProvider` (if bound), `i18nProvider`, and all remaining props forwarded from `IApplication`.
   - Mounts each resource from `mounted.resources` as `<Resource key={resource.name} {...resource} />`.
   - Mounts each custom route from `mounted.routes` inside `<CustomRoutes>` as `<Route key={route.id ?? route.path} {...route} />`.

## Application Props

The `ArdorApplication` component accepts `IApplication` props (defined in `packages/admin/src/common/types.ts`). It extends react-admin's `CoreAdminProps` (omitting `children`):

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `container` | `Container` | Yes | The started IoC container instance (an instance of `BaseArdorApplication`). |
| `reduxStore` | `Store` | Yes | Redux store instance used for react-admin state management. |
| `suspense` | `ReactNode` | Yes | Fallback React node displayed while components or feature translations load. |
| `enableDebug` | `boolean` | No | Enables debug-level logging in the application logger. Default is `false`. |
| `resources` | `Array<ResourceProps>` | No | Resource definitions registered before feature resources. |
| `routes` | `Array<RouteProps>` | No | Custom routes registered inside `CustomRoutes` before feature routes. |
| `...reactAdminProps` | `Omit<CoreAdminProps, 'children'>` | No | Additional react-admin properties (such as `loginPage`, `layout`, `dashboard`, `title`, `theme`, `catchAll`, `basename`) passed directly to `CoreAdmin`. |

## Startup and Render Flow

The diagram illustrates how `main.tsx` initializes the container, runs `start()`, mounts `ArdorApplication`, resolves providers, and renders the UI tree:

```mermaid
flowchart TD
  subgraph Entry["1. Entry Point"]
    Main["main.tsx"] --> CreateApp["new Application()"]
    CreateApp --> CallStart["await application.start()"]
  end

  subgraph Lifecycle["2. start() Lifecycle"]
    CallStart --> Step1["resolveArtifactIndexes()"]
    Step1 --> Step2["preConfigure()"]
    Step2 --> Step3["postConfigure()"]
  end

  subgraph Mount["3. React Mount"]
    CallStart -->|after start() resolves| RenderRoot["createRoot().render()"]
    RenderRoot --> ArdorApp["ArdorApplication"]
  end

  subgraph Providers["4. Container Resolution"]
    ArdorApp --> DP["container.get(DEFAULT_REST_DATA_PROVIDER)"]
    ArdorApp --> Auth["container.get(DEFAULT_AUTH_PROVIDER) (optional)"]
    ArdorApp --> I18n["container.get(DEFAULT_I18N_PROVIDER)"]
  end

  subgraph Hierarchy["5. React Tree Assembly"]
    ArdorApp --> AppCtx["ApplicationContext.Provider"]
    AppCtx --> Redux["ReduxProvider"]
    Redux --> Susp["React.Suspense"]
    Susp --> Core["CoreAdmin"]
    Core --> Res["Mounted Resources"]
    Core --> Rts["Mounted CustomRoutes"]
  end
```

## Next Steps

- Learn how configuration classes bind options and providers: [Configuration](./configuration)
- Configure framework providers: [Providers](./providers)
- Register resource definitions and custom pages: [Resources and Pages](./resources-and-pages)
- Explore dependency injection with hooks and services: [Dependency Injection](./dependency-injection)
- Technical API reference: [Application Reference](../../references/application)
