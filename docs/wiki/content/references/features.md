---
title: Features
description: Package domain modules with configurations, resources, routes, and messages, mount them in BaseArdorApplication, and read them with useFeatures.
---

# Features

Features package domain configurations, stereotyped classes, react-admin resources, custom routes, menu entries and localized messages into self-contained modules mounted by `BaseArdorApplication`.

```tsx
import React from 'react';
import {
  BaseArdorApplication,
  BaseService,
  BindingKeys,
  configuration,
  Features,
  provide,
  service,
  type IApplicationInfo,
  type IFeatureBase,
} from '@venizia/ardor';

@service()
export class OrderService extends BaseService {
  constructor() {
    super({ scope: OrderService.name });
  }
}

// A value with no class has a key: keep it in a constants class.
export class OrdersBindings {
  static readonly PAGE_SIZE = BindingKeys.build<number>({ key: 'orders.pageSize' });
}

@configuration()
export class OrdersConfiguration {
  @provide({ key: OrdersBindings.PAGE_SIZE })
  pageSize(): number {
    return 25;
  }
}

const OrderList: React.FC = () => <div>Order list</div>;
const OrderAnalyticsPage: React.FC = () => <div>Order analytics</div>;

export const ordersFeature = Features.define({
  name: 'orders',
  configurations: [OrdersConfiguration],
  artifacts: { services: [OrderService] },
  resources: [{ name: 'orders', list: OrderList }],
  routes: [{ path: '/orders/analytics', element: <OrderAnalyticsPage /> }],
  messages: {
    en: { orders: { title: 'Orders', analytics: 'Analytics' } },
    vi: () => Promise.resolve({ orders: { title: 'Đơn hàng', analytics: 'Thống kê' } }),
  },
  permissions: ['orders.read', 'orders.export'],
  menu: [
    { label: 'orders.title', to: '/orders', icon: 'cart' },
    {
      label: 'orders.analytics',
      to: '/orders/analytics',
      access: { resource: 'orders', action: 'export' },
    },
  ],
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
| `Features` | class | Static helpers to define, read and mount features and to load their messages |
| `TFeature<TExtension>` | type | Full feature specification including resources, routes, messages, menu, and optional shell extensions |
| `IFeatureBase` | interface | Container-level feature contract (`name`, `configurations`, `artifacts`, `permissions`) |
| `IMenuEntry` | interface | A menu link of a feature: `label`, `to`, optional `access` and `icon` |
| `TFeatureMessages` | type | Map of locale codes to message dictionary objects or asynchronous loader functions |
| `TArdorRoute` | type | A React Router route plus `access`, `auth` and `layout`: who may open it, and where it renders |
| `IRouteAccess` | interface | The `resource` and `action` a route with `access` asks the permission provider |
| `useFeatures` | hook | The features `ArdorApplication` mounts, within React components |
| `useMenuEntries` | hook | The menu entries of the mounted features that the user may open |
| `CoreBindings.FEATURES` | binding key | Key `'@app/application/features'`, where `preConfigure()` binds the mounted feature array |

The `Features` helpers: `define()` types a feature, `read()` resolves bound features, `mount()` merges resources and routes, `hasPendingMessages()` and `loadMessages()` read and load the lazy i18n sources, and `verifyMessages({ features, locales })` loads and merges the features' messages of each locale, without changing a provider's locale, and rejects on the first failure (`assertArdorApplicationBoots` uses it). `IFeatureBase` is declared in `packages/kernel/src/common/types.ts`.

## Options

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | None (required) | Unique identifier for the feature within an application. |
| `configurations` | `Array<TClass<unknown>>` | `undefined` | Stereotyped `@configuration()` classes of the feature. |
| `artifacts` | `IArtifactIndex` | `undefined` | The feature's own stereotyped classes, by value, per group (`services`, `repositories`, ...). |
| `resources` | `Array<ResourceProps>` | `undefined` | React-admin `<Resource>` definitions mounted into the view tree. |
| `routes` | `Array<TArdorRoute>` | `undefined` | Custom routes; each may declare `access`, `auth` and `layout`. |
| `messages` | `TFeatureMessages` | `undefined` | Locale codes mapped to message objects or lazy loaders. |
| `menu` | `Array<IMenuEntry>` | `undefined` | Menu links, in order. `useMenuEntries()` lists those the user may open. |
| `permissions` | `Array<string>` | `undefined` | Permission names the feature's pages use. Metadata only: it enforces nothing. |
| `[extension]` | `TExtension` | None | Custom shell metadata, such as the industries a feature serves. |

- **`name`:** Used in resource ownership checks and diagnostic errors.
- **`configurations`:** Listing them by value prevents bundlers from dropping unreferenced modules under `sideEffects: false` and enables discovery checks during startup. Handled as `feature.configurations ?? []` in `packages/kernel/src/base/applications/abstract.ts`.
- **`artifacts`:** The shape of the application's `artifacts()` index. A feature package that lists its own classes carries them: importing the feature module imports their modules, so discovery binds them, and `start()` checks each was discovered.
- **`menu`:** Each entry is `{ label, to, access?, icon? }`. `label` is a translation key; `icon` is a name your shell maps to an icon, since ARDOR renders no menu. See [Menu entries](#menu-entries).
- **`resources`:** Handled as `feature.resources ?? []` in `packages/admin/src/features/feature.ts`.
- **`routes`:** Handled as `feature.routes ?? []` in `packages/admin/src/features/feature.ts`. A route without `access` or `auth: { use: true }` is open to anyone who types its path, signed in or not, unless the application sets `requireAuth`. See [A route that needs permission](#a-route-that-needs-permission) and [Public pages and pages outside the layout](#public-pages-and-pages-outside-the-layout).
- **`messages`:** A dictionary mapping locale codes to message objects or lazy loader functions returning `Promise<object>`. Handled as `feature.messages?.[locale]` in `packages/admin/src/features/messages.ts`.
- **`permissions`:** Descriptive metadata: the permission names the feature's pages use, for a role editor to list. ARDOR enforces nothing with it. A permission is enforced only by `access`, on a route or on a menu entry. See [Permission](./permission).
- **`[extension]`:** Preserved by `Features.define<TExtension>()`. ARDOR carries the extension and never reads it. An extension must not declare a field ARDOR declares, such as `menu`.

## A route that needs permission

react-admin checks neither sign-in nor `canAccess` on a custom route. A route with `access: { resource, action }` is rendered inside react-admin's `Authenticated` and `CanAccess`: a signed-out user is sent to the sign-in page, and a signed-in user is asked of the `canAccess` of the [permission provider](./permission) for that `resource` and `action`.

```tsx
import React from 'react';
import { Features, type TFeature } from '@venizia/ardor';

const SettingsPage: React.FC = () => <h1>Settings</h1>;

export const SettingsFeature: TFeature = Features.define({
  name: 'settings',
  routes: [
    {
      path: '/settings',
      element: <SettingsPage />,
      access: { resource: 'settings', action: 'edit' },
    },
  ],
});
```

- An app with an `access` route fails at mount, naming the route, when sign-in is off or no permission provider is bound: nothing could answer, and the route would be open.
- A user who is not allowed is sent to the default access-denied page, as for a denied resource.
- `access` works the same in the `routes` prop of `ArdorApplication`, and with a route that gives `Component` instead of `element`.
- Hiding a page is not protection: the backend must check every request.

## Public pages and pages outside the layout

Two more fields sit next to `access` on a route:

| Field | Effect |
| --- | --- |
| None | Inside the layout. Signed in only when the application sets `requireAuth`. |
| `auth: { use: true }` | Renders only for a signed-in user, with no permission check. A signed-out user goes to sign-in. |
| `auth: { use: false }` | Marks the route public. With `access` as well, `Features.mount()` throws. |
| `layout: { use: false }` | Renders in `<CustomRoutes noLayout>`; under `requireAuth` it waits for sign-in. |

```tsx
import React from 'react';
import { Features, type TFeature } from '@venizia/ardor';

const AcceptInvitePage: React.FC = () => <h1>Accept the invite</h1>;
const ProfilePage: React.FC = () => <h1>My profile</h1>;

export const AccountFeature: TFeature = Features.define({
  name: 'account',
  routes: [
    {
      path: '/accept-invite',
      element: <AcceptInvitePage />,
      layout: { use: false },
      auth: { use: false },
    },
    { path: '/profile', element: <ProfilePage />, auth: { use: true } },
  ],
});
```

- **A public page under `requireAuth`** needs both `layout: { use: false }` and `auth: { use: false }`. react-admin renders a route outside the layout before it checks sign-in, so ARDOR wraps such a route in `Authenticated` itself under `requireAuth`; `auth: { use: false }` lifts that. A route inside the layout waits for the sign-in check, so `auth: { use: false }` alone does not open it.
- **Outside the layout is still guarded** when the route has `access` or `auth: { use: true }`, and under `requireAuth` when it does not say `auth: { use: false }`: a signed-out user goes to the sign-in page, as react-admin's `Authenticated` does.
- **The fields work the same** in the `routes` prop of `ArdorApplication` and in the `routes` of a feature.

## Mount order and conflict checks

`ArdorApplication` calls `Features.mount({ features, resources, routes })` to assemble the UI tree:

1. The application's own `resources` and `routes` passed to `<ArdorApplication>` are mounted first.
2. Each feature's `resources` and `routes` are mounted next, in the order listed in `features()`.

ARDOR enforces isolation during startup and mount:

- **Duplicate feature name (`start`):** If two features share a name, `registerFeatures()` in `packages/kernel/src/base/applications/abstract.ts` throws:
  `[features] Two features are named '${feature.name}' | A feature name is unique within an application`
- **Undiscovered configuration (`start`):** If a class in `configurations` was not discovered by the metadata registry, `registerFeatures()` in `packages/kernel/src/base/applications/abstract.ts` throws:
  `[features] '${feature.name}' lists ${target.name}, which was never discovered | Decorate it with @configuration() and import its module before start()`
- **Undiscovered artifact (`start`):** If a class in `artifacts` was not discovered, `registerFeatures()` throws, naming the group:
  `[features] 'orders' lists OrderService in artifacts.services, which was never discovered | Decorate it with its stereotype and import its module before start()`
- **Duplicate resource name (`mount`):** If a resource name is mounted more than once, `Features.mount()` in `packages/admin/src/features/feature.ts` throws:
  `[features] Resource '${resource.name}' is mounted by both '${owner}' and '${entry.owner}' | A resource name is unique within an application`
- **Duplicate route path (`mount`):** Two routes with one path, or a route whose path is `/<resource name>`, throw and name both owners; `orders` and `/orders` are one path:
  `[features] Route '/orders' is mounted by both 'commerce' (resource 'orders') and 'shadow' | A route path is unique within an application and is not the path of a resource`
- **Route with no key (`mount`):** The React key of a route is `id ?? path`. A route with neither throws `[features] A route of '<owner>' has neither an id nor a path`.
- **Public route with access (`mount`):** A route with `access` and `auth: { use: false }` throws and names its path.

## Mount a filtered list

`ArdorApplication` mounts every bound feature unless you pass `features`. A shell that serves an industry, a plan or a role filters `Features.read` with its own rule and passes the result:

```tsx
import React from 'react';
import { type Store } from '@reduxjs/toolkit';
import {
  ArdorApplication,
  type BaseArdorApplication,
  Features,
  type TFeature,
} from '@venizia/ardor';

interface IIndustryExtension {
  industries?: Array<string>;
}

export const IndustryShell: React.FC<{
  application: BaseArdorApplication;
  reduxStore: Store;
  industry: string;
}> = ({ application, reduxStore, industry }) => {
  const features = React.useMemo(() => {
    return Features.read<TFeature<IIndustryExtension>>({ container: application }).filter(
      (feature) => feature.industries?.includes(industry) ?? false,
    );
  }, [application, industry]);

  // A new industry is a new application: the key remounts it.
  return (
    <ArdorApplication
      key={industry}
      container={application}
      reduxStore={reduxStore}
      suspense={<div>Loading...</div>}
      features={features}
    />
  );
};
```

- **The rule is yours.** ARDOR reads no context and has no predicate. `industries` is the shell's own extension, declared with `Features.define<IIndustryExtension>`; ARDOR carries it and never reads it.
- **The list is read as given.** Pass the same array until the rule's input changes. ARDOR does not re-read it for a new workspace: remount the application with a `key` when the industry, plan or merchant changes. That remount is the app's job.
- **Left out is not unbound.** A feature missing from `features` mounts no resource and no route, but the container still holds its configurations, and the i18n provider still holds its messages. A message key two features define still throws when the i18n provider is built, even if one of them is not mounted.

## Message loading and suspense

Feature messages are merged per locale by `FeatureMessages` in `packages/admin/src/features/messages.ts`. Message keys remain flat without an artificial prefix.

- **Duplicate message keys:** If two features define the same leaf key for a locale, the i18n provider throws when it is built, checking every locale in `languages` and the fallback locale, never when a user switches language:
  `[features] Message '${key}' (${locale}) is defined by both '${owner}' and '${feature}' | Give each feature its own keys, or relabel it in the application's own i18nSources`
- **Application overrides:** Application dictionaries in `i18nSources` override feature messages. See [Internationalization](./i18n).
- **Lazy loading and suspense:** A feature can provide messages synchronously as an object or asynchronously through a loader function returning `Promise<object>`. A loader may resolve to the messages or to an ES module whose default export is the messages, so `vi: () => import('./vi')` works and the keys are read unprefixed. For the initial locale, `ArdorApplication` displays the configured `suspense` fallback until the loader resolves. A loader that fails (or a key that two lazy bundles both define) is logged, the locale shows the fallback messages, and the next `changeLocale()` tries the loader again.

## Menu entries

`useMenuEntries()` returns the `menu` entries of the mounted features, in feature order, each with the name of its `feature`. An entry without `access` is always listed. An entry with `access` is listed once the `canAccess` of the [permission provider](./permission) allows it, so a menu never flashes a link the user may not open: while the check runs, or when it fails, the entry is left out. Without a permission provider, or without sign-in, every entry is listed.

The hooks here are read through `Ardor`, the same functions as the bare `useX` exports (see [Hooks](./hooks#one-name-for-every-hook-ardor)).

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Ardor } from '@venizia/ardor';

export const ShellMenu: React.FC = () => {
  const entries = Ardor.useMenuEntries();
  const translate = Ardor.useUntypedTranslate();

  return (
    <nav>
      <ul>
        {entries.map((entry) => (
          <li key={`${entry.feature}:${entry.to}`}>
            <Link to={entry.to}>{translate(entry.label)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
```

- **Link with `Link`, not `<a href>`**: a plain anchor reloads the page. `label` is a translation key, so read it with `useUntypedTranslate`.
- **Call it inside `ArdorApplication`**, such as in the `layout` or `menu` you pass: it reads react-admin's auth provider and query cache.
- **The answers share react-admin's cache** under `['auth', 'canAccess', { resource, action }]`, so a sign-in of another user or `useRefreshToken` renews them.
- **Hiding a link is not protection.** Give the route the same `access`, and let the backend check every request.

## Reading features with useFeatures

The `useFeatures()` hook returns the features `ArdorApplication` mounts: the `features` prop when the shell passed one, else every feature bound under `CoreBindings.FEATURES`. Outside `ArdorApplication` it reads the container, and returns an empty array when `CoreBindings.FEATURES` is not bound.

```tsx
import React from 'react';
import { Ardor } from '@venizia/ardor';

export const RoleEditorPermissions: React.FC = () => {
  const features = Ardor.useFeatures();

  return (
    <ul>
      {features.map((feature) => (
        <li key={feature.name}>
          {feature.name}: {(feature.permissions ?? []).join(', ')}
        </li>
      ))}
    </ul>
  );
};
```

## Related

- [Application](./application) - Application lifecycle, container setup, and `preConfigure()` binding order
- [Binding keys](./binding-keys) - Container keys in `CoreBindings`, including `CoreBindings.FEATURES`
- [Permission](./permission) - Permission vocabulary declared on features
- [Internationalization](./i18n) - Layering application dictionaries over feature messages
