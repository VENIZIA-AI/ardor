---
title: Features
description: Package domain modules with configurations, resources, routes, and messages, mount them in BaseArdorApplication, and read them with useFeatures.
---

# Features

## What it does

A feature package encapsulates one domain area into a self-contained module containing its `@configuration()` classes, react-admin resources, custom routes, and localized message bundles. An application mounts feature packages by returning them from the `features()` method of its application class. ARDOR validates their configuration bindings, merges resources and routes into the administration tree, and coordinates lazy message loading before rendering.

| Export | Kind | Purpose |
| --- | --- | --- |
| `Features` | class | Static helpers: `define()` types a feature, `read()` resolves bound features, `mount()` merges resources and routes |
| `TFeature<TExtension>` | type | Full feature specification including resources, routes, messages, and optional shell extensions |
| `IFeatureBase` | interface | Container-level feature contract (`name`, `configurations`, `permissions`) declared in `packages/kernel/src/common/types.ts` |
| `TFeatureMessages` | type | Map of locale codes to message dictionary objects or asynchronous loader functions |
| `useFeatures` | hook | Reads the list of mounted features from the application container within React components |
| `CoreBindings.FEATURES` | binding key | Binding key (`'@app/application/features'`) where `preConfigure()` binds the mounted feature array |

## How to provide it

A feature encapsulates its domain services, configuration options, resources, routes, and messages in a self-contained module, as demonstrated in the [orders feature example](#example). Its services and options are declared through a class decorated with `@configuration()`. Methods decorated with `@provide({ key })` register lazy singletons into the container. An application class derived from `BaseArdorApplication` mounts features by overriding its `features()` method.

The default `features()` method in `BaseArdorApplication` returns an empty array `[]`. During application startup, `AbstractArdorApplication.start()` executes `preConfigure()`, which binds the returned feature array under `CoreBindings.FEATURES` (`'@app/application/features'`).

In the startup lifecycle, `registerFeatures()` runs after the stereotypes and before `bindingList()` and `bindContext()`, so the application can override what a feature provides. See [The bind order](../guides/core-concepts/configuration#the-bind-order) for the complete application container sequence.

## Options

`Features.define()` accepts a feature definition conforming to `TFeature<TExtension>`. It combines `IFeatureBase` with react-admin UI properties, message bundles, and optional shell extensions:

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | None (required) | Unique identifier for the feature within an application. Used in resource ownership checks and diagnostic errors. |
| `configurations` | `Array<TClass<unknown>>` | `undefined` | Stereotyped `@configuration()` classes belonging to the feature. Listing them by value prevents bundlers from dropping unreferenced modules under `sideEffects: false` and enables discovery checks during startup. Handled as `feature.configurations ?? []` in `packages/kernel/src/base/applications/abstract.ts`. |
| `resources` | `Array<ResourceProps>` | `undefined` | React-admin `<Resource>` definitions mounted into the application view tree. Handled as `feature.resources ?? []` in `packages/admin/src/features/feature.ts`. |
| `routes` | `Array<RouteProps>` | `undefined` | Custom `<Route>` elements mounted under react-admin's `<CustomRoutes>`. Handled as `feature.routes ?? []` in `packages/admin/src/features/feature.ts`. |
| `messages` | `TFeatureMessages` | `undefined` | Dictionary mapping locale codes to message objects or lazy loader functions returning `Promise<object>`. Handled as `feature.messages?.[locale]` in `packages/admin/src/features/messages.ts`. |
| `permissions` | `Array<string>` | `undefined` | Permission keys checked by the feature in the application's vocabulary. Preserved on the feature for consumers such as role editors; ARDOR enforces nothing. See [Permission](./permission). |
| `[extension]` | `TExtension` | None | Custom shell metadata (such as menu entries, navigation paths, or icons) preserved by `Features.define<TExtension>()`. ARDOR carries the extension and never reads it. |

## Example

The following example defines an orders feature with its own `@configuration()`, react-admin resource, custom route, messages, and shell menu extension, then mounts it in an application:

```tsx
import React from 'react';
import {
  BaseArdorApplication,
  configuration,
  Features,
  provide,
  type IApplicationInfo,
  type IFeatureBase,
  type TFeature,
} from '@venizia/ardor';

export class OrderService {
  calculateDiscount(total: number): number {
    return total > 100 ? total * 0.05 : 0;
  }
}

@configuration()
export class OrdersConfiguration {
  @provide({ key: 'services.orders' })
  orderService(): OrderService {
    return new OrderService();
  }
}

const OrderList: React.FC = () => {
  return <div>Order list</div>;
};

const OrderAnalyticsPage: React.FC = () => {
  return <div>Order analytics</div>;
};

interface IShellMenuExtension {
  menu: {
    label: string;
    path: string;
  };
}

export type TOrdersFeature = TFeature<IShellMenuExtension>;

export const ordersFeature = Features.define<IShellMenuExtension>({
  name: 'orders',
  configurations: [OrdersConfiguration],
  resources: [
    {
      name: 'orders',
      list: OrderList,
    },
  ],
  routes: [
    {
      path: '/orders/analytics',
      element: <OrderAnalyticsPage />,
    },
  ],
  messages: {
    en: { orders: { title: 'Orders', analytics: 'Analytics' } },
    vi: () => Promise.resolve({ orders: { title: 'Đơn hàng', analytics: 'Thống kê' } }),
  },
  permissions: ['orders.read', 'orders.export'],
  menu: {
    label: 'orders.title',
    path: '/orders',
  },
});

export class CommerceApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return {
      name: 'commerce-admin',
      version: '1.0.0',
      description: 'Commerce management console',
    };
  }

  override features(): Array<IFeatureBase> {
    return [ordersFeature];
  }

  bindContext() {}
}
```

## Mount order and conflict checks

`ArdorApplication` calls `Features.mount({ features, resources, routes })` to assemble the UI tree. Mount order is deterministic:

1. The application's own `resources` and `routes` passed to `<ArdorApplication>` are mounted first. The application's own `resources` prop is optional when all resources are brought by mounted features.
2. Each feature's `resources` and `routes` are mounted next, in the exact order listed in `features()`.

### During startup and mount

ARDOR performs checks to guarantee isolation. The two `registerFeatures()` errors come from `start()`, while the duplicate-resource error comes from `Features.mount()`, which `ArdorApplication` calls when it renders (a `useMemo` in `packages/admin/src/components/application.tsx`):

- **Duplicate feature name (`start`):** In `packages/kernel/src/base/applications/abstract.ts`, `registerFeatures()` checks that every feature name is unique. If two features share a name, it throws:
  `[features] Two features are named '${feature.name}' | A feature name is unique within an application`
- **Undiscovered configuration (`start`):** In `packages/kernel/src/base/applications/abstract.ts`, `registerFeatures()` checks that every class listed in a feature's `configurations` array was discovered by the metadata registry. If a listed class was not discovered, it throws:
  `[features] '${feature.name}' lists ${target.name}, which was never discovered | Decorate it with @configuration() and import its module before start()`
- **Duplicate resource name (`mount`):** In `packages/admin/src/features/feature.ts`, `Features.mount()` tracks the owner of each resource name (`'the application'` or `feature.name`). If a resource name is mounted more than once, it throws:
  `[features] Resource '${resource.name}' is mounted by both '${owner}' and '${entry.owner}' | A resource name is unique within an application`

## Message loading and suspense

Feature messages are merged per locale by `FeatureMessages.combine()` in `packages/admin/src/features/messages.ts`. Message keys remain flat without an artificial prefix.

- **Duplicate message keys:** If two features define the same leaf key for a locale, ARDOR refuses to guess which label wins and throws:
  `[features] Message '${key}' (${locale}) is defined by both '${owner}' and '${feature}' | Give each feature its own keys, or relabel it in the application's own i18nSources`
- **Application overrides:** The application's own `i18nSources` (configured in `II18nProviderOptions`) are layered on top of all feature messages by `DefaultI18nProvider`. An application can relabel any feature message by defining the same key in its own dictionary. See [Internationalization](./i18n).
- **Lazy loading and suspense:** A feature can provide messages synchronously as an object or asynchronously through a loader function returning `Promise<object>`. For the initial locale, `ArdorApplication` inspects the feature list using `FeatureMessages.hasLoader()`. When a loader exists for that locale, `useFeatureMessagesReady()` keeps the application in a loading state and displays the configured `suspense` fallback until the loader resolves through `i18nProvider.changeLocale()`. If loading rejects, the error is thrown during render for an error boundary to handle. When switching locales later, react-admin's `changeLocale()` manages subsequent loads dynamically.

## Reading features with useFeatures

The `useFeatures()` hook retrieves the array of features mounted in the container. It uses `useInjectableContainer()` to access the current container and calls `Features.read<TItem>({ container })`. If `CoreBindings.FEATURES` is not bound, it returns an empty array.

Passing a shell extension type parameter preserves typed access to custom properties:

```tsx
import React from 'react';
import { type TFeature, useFeatures } from '@venizia/ardor';

interface IMenuExtension {
  menu?: {
    label: string;
    path: string;
  };
}

export type TAppFeature = TFeature<IMenuExtension>;

export const FeatureNavigationMenu: React.FC = () => {
  const features = useFeatures<TAppFeature>();

  return (
    <nav>
      <ul>
        {features.map((feature) => {
          if (!feature.menu) {
            return null;
          }
          return (
            <li key={feature.name}>
              <a href={feature.menu.path}>{feature.menu.label}</a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
```

## Related

- [Application](./application) - Application lifecycle, container setup, and `preConfigure()` binding order
- [Binding keys](./binding-keys) - Container keys in `CoreBindings`, including `CoreBindings.FEATURES`
- [Permission](./permission) - How permissions are checked with react-admin's `canAccess`
- [Internationalization](./i18n) - How feature messages layer beneath `i18nSources`
- [Hooks](./hooks) - Details on `useFeatures` and container resolution hooks
