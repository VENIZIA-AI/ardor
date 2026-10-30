---
title: Providers
description: Understand ARDOR framework providers, how options configure them, how ArdorApplication injects them, and how to replace or leave out one.
---

# Providers

ARDOR coordinates data, authentication, and internationalization through providers configured in `@configuration()` classes. `ArdorApplication` resolves them from the container and supplies them to react-admin:

<<< @/../../../examples/5-mins-qs/src/configurations/admin.configuration.ts{ts}

## Framework Providers

| Piece | What it does | Default class | Bound key | Options key | Required or optional | Reference |
| --- | --- | --- | --- | --- | --- | --- |
| Data provider | Maps react-admin data calls onto REST requests and provides custom HTTP sending methods | `DefaultRestDataProvider` | `CoreBindings.DEFAULT_REST_DATA_PROVIDER` | `CoreBindings.REST_DATA_PROVIDER_OPTIONS` | Required | [REST data provider](../../references/data-provider) |
| Auth provider | Manages authentication sessions, credentials, token storage, and auth error redirection | `DefaultAuthProvider` | `CoreBindings.DEFAULT_AUTH_PROVIDER` | `CoreBindings.AUTH_PROVIDER_OPTIONS` | Optional | [Auth provider](../../references/auth-provider) |
| i18n provider | Resolves translations, handles locale changes, and composes feature message bundles | `DefaultI18nProvider` | `CoreBindings.DEFAULT_I18N_PROVIDER` | `CoreBindings.I18N_PROVIDER_OPTIONS` | Required | [Internationalization](../../references/i18n) |
| Network service (transport) | Executes HTTP requests via fetch, attaches headers and tracing ids, and recovers from 401 errors | `DefaultNetworkRequestService` | None (constructed by data provider) | `CoreBindings.REST_DATA_PROVIDER_OPTIONS` | Required | [Network](../../references/network) |
| Permission provider | Evaluates authorization checks for resources, actions, and records via `canAccess` | None (`IPermissionProvider`) | `CoreBindings.PERMISSION_PROVIDER` | None | Optional | [Permission provider](../../references/permission) |
| Features | Bundles resources, custom routes, translation messages, and configuration classes for modular domains | None (array of `TFeature`) | `CoreBindings.FEATURES` | None | Optional | [Features](../../references/features) |

## Provider Flow into react-admin

<svg viewBox="0 0 684 272" role="img" aria-labelledby="providers-flow-title providers-flow-desc" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font:12px var(--vp-font-family-base);color:var(--vp-c-text-1)">
<title id="providers-flow-title">Provider flow into react-admin</title>
<desc id="providers-flow-desc">Three configuration bindings each inject one provider into the container: the REST data provider, the auth provider (optional) and the i18n provider. The container hands each to CoreAdmin inside ArdorApplication as dataProvider, authProvider and i18nProvider.</desc>
<defs><marker id="providers-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--vp-c-text-2)"/></marker></defs>
<g style="fill:none;stroke:var(--vp-c-divider);stroke-dasharray:5 4">
<rect x="4" y="6" width="210" height="260" rx="10"/>
<rect x="274" y="6" width="210" height="260" rx="10"/>
<rect x="574" y="6" width="106" height="260" rx="10"/>
</g>
<g fill="currentColor" font-weight="600">
<text x="109" y="30" text-anchor="middle">Configuration (@provide)</text>
<text x="379" y="30" text-anchor="middle">IoC Container (Singletons)</text>
<text x="627" y="30" text-anchor="middle">ArdorApplication</text>
</g>
<g style="fill:var(--vp-c-bg-soft);stroke:var(--vp-c-divider)">
<rect x="14" y="54" width="190" height="52" rx="6"/>
<rect x="14" y="124" width="190" height="52" rx="6"/>
<rect x="14" y="194" width="190" height="52" rx="6"/>
<rect x="284" y="54" width="190" height="52" rx="6"/>
<rect x="284" y="124" width="190" height="52" rx="6"/>
<rect x="284" y="194" width="190" height="52" rx="6"/>
<rect x="584" y="108" width="86" height="84" rx="6"/>
</g>
<g fill="currentColor" text-anchor="middle">
<text x="109" y="84">REST_DATA_PROVIDER_OPTIONS</text>
<text x="109" y="154">AUTH_PROVIDER_OPTIONS</text>
<text x="109" y="224">I18N_PROVIDER_OPTIONS</text>
<text x="379" y="77">DEFAULT_REST_DATA_PROVIDER</text>
<text x="379" y="147">DEFAULT_AUTH_PROVIDER</text>
<text x="379" y="217">DEFAULT_I18N_PROVIDER</text>
<text x="627" y="146" font-weight="600">CoreAdmin</text>
</g>
<g fill="var(--vp-c-text-2)" text-anchor="middle" font-size="11">
<text x="379" y="94">IDataProvider</text>
<text x="379" y="164">IAuthProvider (optional)</text>
<text x="379" y="234">I18nProvider</text>
<text x="627" y="164">(react-admin)</text>
<text x="244" y="76">injects</text>
<text x="244" y="146">injects</text>
<text x="244" y="216">injects</text>
<text x="529" y="86">dataProvider</text>
<text x="529" y="143">authProvider</text>
<text x="529" y="233">i18nProvider</text>
</g>
<g style="stroke:var(--vp-c-text-2);stroke-width:1.5;fill:none" marker-end="url(#providers-flow-arrow)">
<path d="M204 80H284"/>
<path d="M204 150H284"/>
<path d="M204 220H284"/>
<path d="M474 80C530 80 530 126 584 126"/>
<path d="M474 150H584"/>
<path d="M474 220C530 220 530 174 584 174"/>
</g>
</svg>

`ArdorApplication` reads providers by key from the container when building props for react-admin; see [Application](./application). Components resolve them with `useProvider` or `useInjectable` (see [Dependency Injection](./dependency-injection)). When passed a `{ target }` class, `useProvider` checks that the class is registered under the `providers` namespace (`BindingNamespaces.PROVIDER`), throwing only when the class is bound under a different namespace.

## Replace One

To customize or replace a default provider, create a subclass that extends the default class, override the specific method, and bind the subclass under the corresponding `CoreBindings` key in a `@configuration()` class.

In `DefaultRestDataProvider` (`packages/admin/src/providers/rest-data.ts`), the helper and transport methods are public or protected methods of the class: `request` and `requestList` (protected), `buildListFilter` (protected, a delegate of `ListFilterBuilder.build`), `toAffectedIds` (protected), `createNetworkService` (protected), `getDataSourceAuth` (public), and `getNetworkService` (public).

The following complete file illustrates subclassing `DefaultRestDataProvider` to override `getOne` and append a derived field to the returned record, registering the replacement provider under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`:

```ts
import { type BaseArdorApplication, configuration, CoreBindings, DefaultRestDataProvider, inject, provide } from '@venizia/ardor';
import { type GetOneParams, type GetOneResult, type RaRecord } from 'ra-core';

export class CustomRestDataProvider extends DefaultRestDataProvider {
  override async getOne<RecordType extends RaRecord = RaRecord>(opts: {
    resource: string;
    params: GetOneParams<RecordType>;
  }): Promise<GetOneResult<RecordType>> {
    const result = await super.getOne(opts);
    return { ...result, data: { ...result.data, isLoaded: true } };
  }
}

@configuration()
export class CustomDataConfiguration {
  constructor(@inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: BaseArdorApplication) {}

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(CustomRestDataProvider).value(this.application);
  }
}
```

Calling `this.application.instantiate(CustomRestDataProvider).value(this.application)` resolves constructor dependencies (`REST_DATA_PROVIDER_OPTIONS` and `APPLICATION_INFO`) and returns the react-admin provider.

## Leave One Out

Some administrative applications do not require authentication, authorization, or feature packages.

### Authentication (No Sign-In)

An application with no sign-in leaves `DEFAULT_AUTH_PROVIDER` unbound; `ArdorApplication` then runs without an auth provider:

1. **Leave `DEFAULT_AUTH_PROVIDER` unbound**: Do not declare `@provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })` or `@provide({ key: CoreBindings.DEFAULT_AUTH_SERVICE })`.
2. **`ArdorApplication` handles omission**: When resolving `CoreBindings.DEFAULT_AUTH_PROVIDER`, `ArdorApplication` uses `isOptional: true`. When unbound, `authProvider` is omitted from the props passed to `CoreAdmin`.
3. **React-admin runs without auth**: No sign-in screen is rendered, and all resource routes and custom routes are immediately accessible.
4. **Configure network options**: In `REST_DATA_PROVIDER_OPTIONS`, set `noAuthPathRegex: /./` so that `DefaultNetworkRequestService` sends every HTTP request without attempting to attach an `Authorization` header.

### Permission Provider

`DefaultAuthProvider` injects `CoreBindings.PERMISSION_PROVIDER` with `isOptional: true`. In `DefaultAuthProvider.value()`, if `permissionProvider` is unbound, `authProvider.canAccess` is omitted, and react-admin allows every authorization check (`useCanAccess` resolves `canAccess: true`).

### Features

`BaseArdorApplication.features()` returns an empty array (`[]`) by default. When no features are mounted, `ArdorApplication` mounts only the resources and custom routes provided directly via application props (`<ArdorApplication resources={...} routes={...} />`).

## Next Steps

- [Configuration](./configuration) - Configure provider options and singleton bindings
- [Application](./application) - Mount providers in `<ArdorApplication />`
- [REST data provider](../../references/data-provider) - Complete data provider API reference
- [Auth provider](../../references/auth-provider) - Authentication options and session management
