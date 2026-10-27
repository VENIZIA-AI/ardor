---
title: API References
description: Technical API reference for ARDOR container classes, providers, binding keys, and React hooks.
---

# ARDOR API References

ARDOR structures ra-core applications inside an IGNIS inversion-of-control container. This reference catalogs the classes, interfaces, binding keys, and hooks of `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin`, which `@venizia/ardor` re-exports. Runtime configuration (`getRuntimeConfig`) has its own section below.

<div class="guide-cards">
<a href="./application" class="guide-card"><h3>Application</h3><p>Container lifecycle, configuration, and ArdorApplication component</p></a>
<a href="./binding-keys" class="guide-card"><h3>Binding Keys</h3><p>CoreBindings and LocalStorageKeys constants and resolution rules</p></a>
<a href="./data-provider" class="guide-card"><h3>Data Provider</h3><p>DefaultRestDataProvider, IDataProvider, and REST request mapping</p></a>
<a href="./auth-provider" class="guide-card"><h3>Auth Provider</h3><p>DefaultAuthProvider, DefaultAuthService, and credential handling</p></a>
<a href="./i18n" class="guide-card"><h3>Internationalization</h3><p>DefaultI18nProvider, translation bundles, and locale synchronization</p></a>
<a href="./network" class="guide-card"><h3>Network</h3><p>DefaultNetworkRequestService, headers, tracing, and 401 recovery</p></a>
<a href="./permission" class="guide-card"><h3>Permission</h3><p>IPermissionProvider contract and react-admin canAccess delegation</p></a>
<a href="./features" class="guide-card"><h3>Features</h3><p>Feature package definitions, configuration classes, and route mounting</p></a>
<a href="./repository" class="guide-card"><h3>Repository</h3><p>HttpRepository and HttpDataSource for resource-level operations</p></a>
<a href="./hooks" class="guide-card"><h3>Hooks</h3><p>Container resolution, Redux hooks, ra-core helpers, and UI utilities</p></a>
<a href="./testing" class="guide-card"><h3>Testing</h3><p>assertArdorApplicationBoots proves an application boots, with no browser and no network</p></a>
<a href="./types" class="guide-card"><h3>Types</h3><p>Kernel type aliases, const classes, path helpers, and options shapes</p></a>
</div>

## Framework Packages

| Piece | Package | Page |
|---|---|---|
| Application | `@venizia/ardor-kernel`, `@venizia/ardor-admin` | [Application](./application) |
| Binding keys | `@venizia/ardor-kernel` | [Binding keys](./binding-keys) |
| Data provider | `@venizia/ardor-admin` | [Data provider](./data-provider) |
| Auth provider | `@venizia/ardor-admin` | [Auth provider](./auth-provider) |
| Internationalization | `@venizia/ardor-admin` | [Internationalization](./i18n) |
| Network | `@venizia/ardor-kernel` | [Network](./network) |
| Permission | `@venizia/ardor-kernel`, `@venizia/ardor-admin` | [Permission](./permission) |
| Features | `@venizia/ardor-kernel`, `@venizia/ardor-admin` | [Features](./features) |
| Repository | `@venizia/ardor-kernel`, `@venizia/ardor/repository` | [Repository](./repository) |
| Hooks | `@venizia/ardor-react`, `@venizia/ardor-admin` | [Hooks](./hooks) |
| Testing | `@venizia/ardor` (`/testing`) | [Testing](./testing) |
| Types | `@venizia/ardor-kernel` | [Types](./types) |
| Runtime config | `@venizia/ardor-kernel` | [Runtime config](#runtime-config) |

## Runtime config

`getRuntimeConfig` reads one configuration value: the runtime one from `window.__APP_CONFIG__` (the preset image writes it at container start from the `VITE_` variables), else `buildTimeEnv` (pass `import.meta.env`), else `defaultValue`. Only a non-empty string counts, and a missing `window.__APP_CONFIG__` is not an error. How the image writes the file is in [One image for every environment](../guides/get-started/create-a-project#one-image-for-every-environment).

| Option | Type | Default | Meaning |
|---|---|---|---|
| `key` | `string` | - | The variable name, for example `VITE_API_URL`. |
| `buildTimeEnv` | `Record<string, unknown>` | none | The build-time source, normally `import.meta.env`. |
| `defaultValue` | `string` | none | Used when neither source has a value. |
| `required` | `boolean` | `false` | With `true` the result is a `string`, and a missing value throws. |

Without `required` the result is `string | undefined`. With `required: true` and no value anywhere, it throws an `ApplicationError` from `@venizia/ignis-inversion`. Its message names the key and never a value. Detect it by code, not by message; the key is in `extra.key`:

```typescript
import { getRuntimeConfig, RUNTIME_CONFIG_REQUIRED_CODE } from '@venizia/ardor';
import { isApplicationError } from '@venizia/ignis-inversion';

try {
  getRuntimeConfig({ key: 'VITE_API_URL', required: true });
} catch (error) {
  if (isApplicationError(error) && error.normalized.code === RUNTIME_CONFIG_REQUIRED_CODE) {
    console.error('missing config key', error.extra?.key);
  }
}
```

`RUNTIME_CONFIG_REQUIRED_CODE` is `'ardor.runtime_config.required'`, and `RUNTIME_CONFIG_GLOBAL` is `'__APP_CONFIG__'`. The source is `packages/kernel/src/utilities/runtime-config.ts`.

## Find the Exact API

<div class="roadmap">
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">1</span><h4>Application</h4></div>
  <p><a href="./application">Application</a></p>
  <span class="stage-desc">Container setup, preConfigure bind order, and ArdorApplication root component</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">2</span><h4>Binding Keys</h4></div>
  <p><a href="./binding-keys">Binding keys</a></p>
  <span class="stage-desc">CoreBindings container keys and LocalStorageKeys storage identifiers</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">3</span><h4>Providers</h4></div>
  <p><a href="./data-provider">Data provider</a> → <a href="./auth-provider">Auth provider</a> → <a href="./i18n">Internationalization</a> → <a href="./network">Network</a> → <a href="./permission">Permission</a> → <a href="./features">Features</a></p>
  <span class="stage-desc">REST data mapping, authentication lifecycle, translation bundles, network transport, permissions, and features</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">4</span><h4>Hooks</h4></div>
  <p><a href="./hooks">Hooks</a></p>
  <span class="stage-desc">Container dependency resolution, Redux hooks, and React UI utilities</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">5</span><h4>Repositories and types</h4></div>
  <p><a href="./repository">Repository</a> → <a href="./types">Types</a></p>
  <span class="stage-desc">Resource-level HTTP repositories, data sources, and kernel type definitions</span>
</div>
</div>
