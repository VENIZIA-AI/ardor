---
title: Features and permissions
description: Mount feature packages - resources, routes, bindings, messages - from the application class, and answer react-admin's canAccess from your own rules.
---

# Features and permissions

A feature package brings one area of an admin - inventory, orders, billing - as a single value: the resources and routes it mounts, the `@configuration()` classes that register its services and repositories, its messages, and the permissions it checks. An application lists the features it mounts; two shells can mount the same feature packages. Permission checks go through react-admin's `canAccess`, answered by a provider the application binds.

## Prerequisites

- An application class built on `BaseArdorApplication` and rendered with `ArdorApplication` - see [Application](./application).

## Quick Reference

| Symbol | Package | What it is |
|---|---|---|
| `IFeatureBase` | `@venizia/ardor-kernel` | `name`, `configurations`, `permissions` - what the container needs |
| `IFeature<TExtension>` | `@venizia/ardor-admin` | `IFeatureBase` plus `resources`, `routes`, `messages`, and your own extension |
| `defineFeature()` | `@venizia/ardor-admin` | Types a feature, keeping the extension |
| `features()` | application class | The features the application mounts, bound under `CoreBindings.FEATURES` |
| `useFeatures()` | `@venizia/ardor-admin` | The mounted features, for a menu or a role editor |
| `IPermissionProvider` | `@venizia/ardor-kernel` | `canAccess({ resource, action, record })`, bound under `CoreBindings.PERMISSION_PROVIDER` |

## Declaring a feature

```ts
import { configuration, defineFeature, provide } from '@venizia/ardor';

@configuration()
export class InventoryConfiguration {
  @provide({ key: 'services.InventoryLabels' })
  labels() {
    return { unit: 'pcs' };
  }
}

const StockList = () => null;

export const inventoryFeature = defineFeature({
  name: 'inventory',
  configurations: [InventoryConfiguration],
  resources: [{ name: 'stocks', list: StockList }],
  routes: [{ path: '/stock-report', element: null }],
  messages: {
    en: { inventory: { title: 'Stock' } },
    vi: () => Promise.resolve({ inventory: { title: 'Kho' } }),
  },
  permissions: ['stock.read', 'stock.adjust'],
});
```

- `configurations` lists the feature's `@configuration()` classes by value. ARDOR packages are `sideEffects: false`, so a module that nothing references can be dropped by the bundler and its bindings silently lost; the list is that reference, and `start()` checks it.
- `messages` maps a locale to a bundle, or to a loader for one.
- `permissions` is declared, never enforced by ARDOR: a role editor can list what each feature checks.

A shell adds its own fields through the extension parameter, typed end to end:

```ts
import { defineFeature, type IFeature } from '@venizia/ardor';

interface IMenuExtension {
  menu: Array<{ id: string; label: string; resource: string }>;
}

export type TShellFeature = IFeature<IMenuExtension>;

export const ordersFeature = defineFeature<IMenuExtension>({
  name: 'orders',
  resources: [{ name: 'orders' }],
  menu: [{ id: 'orders', label: 'orders.menu', resource: 'orders' }],
});
```

ARDOR carries the extension and never reads it.

## Mounting features

The application class lists them once:

```ts
import { BaseArdorApplication, type IFeature } from '@venizia/ardor';

declare const inventoryFeature: IFeature;
declare const ordersFeature: IFeature;

export class WebManagerApplication extends BaseArdorApplication {
  override features() {
    return [inventoryFeature, ordersFeature];
  }

  getAppInfo() {
    return { name: 'web-manager', version: '1.0.0', description: 'merchant console' };
  }

  bindContext() {}
}
```

`preConfigure()` binds the list under `CoreBindings.FEATURES`, after the stereotypes and before `bindingList()` and `bindContext()`, which still override what a feature provides. It throws on:

- two features with one `name`: `[features] Two features are named 'inventory'`;
- a listed configuration class that was never discovered: `[features] 'billing' lists BillingConfiguration, which was never discovered`.

`ArdorApplication` reads the list from the container and mounts the application's own `resources` and `customRoutes` first, then each feature's, in order. `resources` is optional when the features bring them all. A resource name mounted twice throws, naming both owners - react-admin would keep one and drop the other without a word.

`useFeatures()` returns the mounted features, typed with your extension:

```ts
import { type IFeature, useFeatures } from '@venizia/ardor';

type TShellFeature = IFeature<{ menu: Array<{ id: string; label: string }> }>;

export const useMenu = () => {
  return useFeatures<TShellFeature>().flatMap((feature) => feature.menu);
};
```

## Permissions

Bind an `IPermissionProvider` and `DefaultAuthProvider` answers react-admin's `canAccess` from it:

```ts
import { configuration, CoreBindings, type IPermissionProvider, provide } from '@venizia/ardor';

declare const loadPermissionsForCurrentWorkspace: () => Promise<Set<string>>;

@configuration()
export class PermissionConfiguration {
  @provide({ key: CoreBindings.PERMISSION_PROVIDER })
  permissions(): IPermissionProvider {
    return {
      canAccess: async ({ resource, action }) => {
        const granted = await loadPermissionsForCurrentWorkspace();
        return granted.has('*') || granted.has(`${resource}.${action}`);
      },
    };
  }
}
```

The vocabulary - `'<resource>.<action>'`, a `'*'` wildcard, where the set comes from - is the application's; ARDOR only asks. Check with react-admin's own hooks and components, `useCanAccess` and `<CanAccess>`.

- **No provider bound:** `DefaultAuthProvider` has no `canAccess`, and react-admin allows everything, as before.
- **Context switch:** react-admin caches answers under `['auth', 'canAccess', ...]`. When the workspace changes, invalidate the `['auth']` queries.
- **A subclass with its own constructor** must inject the provider and pass it on, or `canAccess` stays absent:

```ts
import {
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  type IAuthProviderOptions,
  type IDataProvider,
  inject,
  type IPermissionProvider,
} from '@venizia/ardor';

export class AuthProvider extends DefaultAuthProvider {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) restDataProvider: IDataProvider,
    @inject({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }) authProviderOptions: IAuthProviderOptions,
    @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE }) authService: DefaultAuthService,
    @inject({ key: CoreBindings.PERMISSION_PROVIDER, isOptional: true })
    permissionProvider?: IPermissionProvider,
  ) {
    super(restDataProvider, authProviderOptions, authService, permissionProvider);
  }
}
```

## Messages

`DefaultI18nProvider` merges, per locale, every feature's messages, then the application's own `i18nSources` over them: the application may relabel a feature. Keys stay flat; no namespace is added, so give each feature its own prefix.

- A key two features both define throws, naming both and the key: `[features] Message 'inventory.title' (en) is defined by both 'inventory' and 'shadow'`. A silent "later wins" is a wrong label nobody notices.
- A loader runs once per locale. For the initial locale, `ArdorApplication` loads it before react-admin renders, showing `suspense` meanwhile; another locale loads on `changeLocale()`. A failed load is thrown from render, for an error boundary.

## Common pitfalls

- **A configuration not in `configurations`.** It may be tree-shaken away in a production build, and nothing tells you. List every `@configuration()` class the feature relies on.
- **Calling `useCanAccess` and seeing everything allowed.** No `IPermissionProvider` is bound, or an `AuthProvider` subclass did not pass it to `super`.
- **A stale answer after switching workspace.** Invalidate `['auth']`.

## Related

- [Application](./application) - `features()` in the `preConfigure()` order
- [Auth provider](./auth-provider) - `canAccess`
- [Internationalization](./i18n) - how feature messages layer under `i18nSources`
