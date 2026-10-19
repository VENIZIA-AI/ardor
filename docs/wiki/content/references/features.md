---
title: Features
description: Package domain modules with configurations, resources, routes, and messages, mount them in BaseArdorApplication, and read them with useFeatures.
---

# Features

Features package domain configurations, react-admin resources, custom routes, and localized messages into self-contained modules mounted by `BaseArdorApplication`.

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

export class OrderService {}

@configuration()
export class OrdersConfiguration {
  @provide({ key: 'services.orders' })
  orderService(): OrderService {
    return new OrderService();
  }
}

const OrderList: React.FC = () => <div>Order list</div>;
const OrderAnalyticsPage: React.FC = () => <div>Order analytics</div>;

interface IShellMenuExtension {
  menu: { label: string; path: string };
}

export const ordersFeature = Features.define<IShellMenuExtension>({
  name: 'orders',
  configurations: [OrdersConfiguration],
  resources: [{ name: 'orders', list: OrderList }],
  routes: [{ path: '/orders/analytics', element: <OrderAnalyticsPage /> }],
  messages: {
    en: { orders: { title: 'Orders', analytics: 'Analytics' } },
    vi: () => Promise.resolve({ orders: { title: 'Đơn hàng', analytics: 'Thống kê' } }),
  },
  permissions: ['orders.read', 'orders.export'],
  menu: { label: 'orders.title', path: '/orders' },
});

export class CommerceApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'commerce-admin', version: '1.0.0', description: 'Commerce admin' };
  }

  override features(): Array<IFeatureBase> {
    return [ordersFeature];
  }

  bindContext() {}
}
```

## What it does

| Export | Kind | Purpose |
| --- | --- | --- |
| `Features` | class | Static helpers: `define()` types a feature, `read()` resolves bound features, `mount()` merges resources and routes |
| `TFeature<TExtension>` | type | Full feature specification including resources, routes, messages, and optional shell extensions |
| `IFeatureBase` | interface | Container-level feature contract (`name`, `configurations`, `permissions`) declared in `packages/kernel/src/common/types.ts` |
| `TFeatureMessages` | type | Map of locale codes to message dictionary objects or asynchronous loader functions |
| `useFeatures` | hook | Reads the list of mounted features from the application container within React components |
| `CoreBindings.FEATURES` | binding key | Binding key (`'@app/application/features'`) where `preConfigure()` binds the mounted feature array |

## Options

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | None (required) | Unique identifier for the feature within an application. Used in resource ownership checks and diagnostic errors. |
| `configurations` | `Array<TClass<unknown>>` | `undefined` | Stereotyped `@configuration()` classes belonging to the feature. Listing them by value prevents bundlers from dropping unreferenced modules under `sideEffects: false` and enables discovery checks during startup. Handled as `feature.configurations ?? []` in `packages/kernel/src/base/applications/abstract.ts`. |
| `resources` | `Array<ResourceProps>` | `undefined` | React-admin `<Resource>` definitions mounted into the application view tree. Handled as `feature.resources ?? []` in `packages/admin/src/features/feature.ts`. |
| `routes` | `Array<RouteProps>` | `undefined` | Custom `<Route>` elements mounted under react-admin's `<CustomRoutes>`. Handled as `feature.routes ?? []` in `packages/admin/src/features/feature.ts`. |
| `messages` | `TFeatureMessages` | `undefined` | Dictionary mapping locale codes to message objects or lazy loader functions returning `Promise<object>`. Handled as `feature.messages?.[locale]` in `packages/admin/src/features/messages.ts`. |
| `permissions` | `Array<string>` | `undefined` | Permission keys checked by the feature in the application's vocabulary. Preserved on the feature for consumers such as role editors; ARDOR enforces nothing. See [Permission](./permission). |
| `[extension]` | `TExtension` | None | Custom shell metadata (such as menu entries, navigation paths, or icons) preserved by `Features.define<TExtension>()`. ARDOR carries the extension and never reads it. |

## Mount order and conflict checks

`ArdorApplication` calls `Features.mount({ features, resources, routes })` to assemble the UI tree:

1. The application's own `resources` and `routes` passed to `<ArdorApplication>` are mounted first.
2. Each feature's `resources` and `routes` are mounted next, in the order listed in `features()`.

ARDOR enforces isolation during startup and mount:

- **Duplicate feature name (`start`):** If two features share a name, `registerFeatures()` in `packages/kernel/src/base/applications/abstract.ts` throws:
  `[features] Two features are named '${feature.name}' | A feature name is unique within an application`
- **Undiscovered configuration (`start`):** If a class in `configurations` was not discovered by the metadata registry, `registerFeatures()` in `packages/kernel/src/base/applications/abstract.ts` throws:
  `[features] '${feature.name}' lists ${target.name}, which was never discovered | Decorate it with @configuration() and import its module before start()`
- **Duplicate resource name (`mount`):** If a resource name is mounted more than once, `Features.mount()` in `packages/admin/src/features/feature.ts` throws:
  `[features] Resource '${resource.name}' is mounted by both '${owner}' and '${entry.owner}' | A resource name is unique within an application`

## Message loading and suspense

Feature messages are merged per locale by `FeatureMessages.combine()` in `packages/admin/src/features/messages.ts`. Message keys remain flat without an artificial prefix.

- **Duplicate message keys:** If two features define the same leaf key for a locale, ARDOR throws:
  `[features] Message '${key}' (${locale}) is defined by both '${owner}' and '${feature}' | Give each feature its own keys, or relabel it in the application's own i18nSources`
- **Application overrides:** Application dictionaries in `i18nSources` override feature messages. See [Internationalization](./i18n).
- **Lazy loading and suspense:** A feature can provide messages synchronously as an object or asynchronously through a loader function returning `Promise<object>`. For the initial locale, `ArdorApplication` displays the configured `suspense` fallback until the loader resolves.

## Reading features with useFeatures

The `useFeatures()` hook retrieves the array of features mounted in the container. If `CoreBindings.FEATURES` is not bound, it returns an empty array.

```tsx
import React from 'react';
import { type TFeature, useFeatures } from '@venizia/ardor';

interface IMenuExtension {
  menu?: { label: string; path: string };
}

export const FeatureNavigationMenu: React.FC = () => {
  const features = useFeatures<TFeature<IMenuExtension>>();

  return (
    <nav>
      <ul>
        {features.map((feature) =>
          feature.menu ? (
            <li key={feature.name}>
              <a href={feature.menu.path}>{feature.menu.label}</a>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
};
```

## Related

- [Application](./application) - Application lifecycle, container setup, and `preConfigure()` binding order
- [Binding keys](./binding-keys) - Container keys in `CoreBindings`, including `CoreBindings.FEATURES`
- [Permission](./permission) - Permission vocabulary declared on features
- [Internationalization](./i18n) - Layering application dictionaries over feature messages
