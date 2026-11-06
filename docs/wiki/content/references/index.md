---
title: API References
description: Technical API reference for ARDOR container classes, providers, binding keys, and React hooks.
---

# ARDOR API References

ARDOR structures ra-core applications inside an IGNIS inversion-of-control container. This reference catalogs the classes, interfaces, binding keys, and hooks of `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin`, which `@venizia/ardor` re-exports. Runtime configuration (`RuntimeConfig.get`), browser storage and the browser clipboard have their own sections below.

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
<a href="./testing" class="guide-card"><h3>Testing</h3><p>assertArdorApplicationBoots proves an application boots, with no browser and no network; fakes for the observers, matchMedia, storage and the clipboard</p></a>
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
| Browser storage | `@venizia/ardor-kernel` | [Browser storage](#browser-storage) |
| Browser clipboard | `@venizia/ardor-kernel` | [Browser clipboard](#browser-clipboard) |

## Runtime config

`RuntimeConfig.get` reads one configuration value: the runtime one from `window.__APP_CONFIG__` (the preset image writes it at container start from the `VITE_` variables), else `buildTimeEnv` (pass `import.meta.env`), else `defaultValue`. Only a non-empty string counts, and a missing `window.__APP_CONFIG__` is not an error. How the image writes the file is in [One image for every environment](../guides/get-started/create-a-project#one-image-for-every-environment).

| Option | Type | Default | Meaning |
|---|---|---|---|
| `key` | `string` | - | The variable name, for example `VITE_API_URL`. |
| `buildTimeEnv` | `Record<string, unknown>` | none | The build-time source, normally `import.meta.env`. |
| `defaultValue` | `string` | none | Used when neither source has a value. |
| `required` | `boolean` | `false` | With `true` the result is a `string`, and a missing value throws. |

Without `required` the result is `string | undefined`. With `required: true` and no value anywhere, it throws an `ApplicationError` from `@venizia/ignis-inversion`. Its message names the key and never a value. Detect it by code, not by message; the key is in `extra.key`:

```typescript
import { RUNTIME_CONFIG_REQUIRED_CODE, RuntimeConfig } from '@venizia/ardor';
import { isApplicationError } from '@venizia/ignis-inversion';

try {
  RuntimeConfig.get({ key: 'VITE_API_URL', required: true });
} catch (error) {
  if (isApplicationError(error) && error.normalized.code === RUNTIME_CONFIG_REQUIRED_CODE) {
    console.error('missing config key', error.extra?.key);
  }
}
```

`RUNTIME_CONFIG_REQUIRED_CODE` is `'ardor.runtime_config.required'`, and `RUNTIME_CONFIG_GLOBAL` is `'__APP_CONFIG__'`. The source is `packages/kernel/src/utilities/runtime-config.ts`.

## Browser storage

`BrowserStorage` reads and writes `localStorage` and `sessionStorage` outside React, and it never throws. A missing area (a server), a blocked accessor (private mode), a quota error or text the codec cannot read gives the fallback or `false`. Nothing touches `window` at import.

```typescript
import { BrowserStorage, StorageAreas } from '@venizia/ardor';

BrowserStorage.set({ key: '@app/store/theme', value: { mode: 'dark' } });
const theme = BrowserStorage.get({ key: '@app/store/theme', fallback: { mode: 'light' } });
BrowserStorage.remove({ key: '@app/store/theme', storage: StorageAreas.LOCAL });
```

| Method | Returns | Meaning |
|---|---|---|
| `get({ key, fallback, storage?, codec? })` | the stored value, else `fallback` | The key is missing, the accessor throws, or `decode` throws. |
| `set({ key, value, storage?, codec? })` | `boolean` | `false` when nothing was stored: no area, a quota error, a value the codec cannot encode, or a key under `@app/auth/`. |
| `remove({ key, storage? })` | `boolean` | `false` when the key was not removed, and for a key under `@app/auth/`. |
| `keys({ storage?, prefix? })` | `Array<string>` | The keys of the area, only those that start with `prefix` when it is given. `[]` where the area is missing or throws. It lists the keys under `@app/auth/` too, because listing writes nothing. |
| `removeWhere({ storage?, prefix })` | `number` | Removes every key that starts with `prefix` and answers how many it removed. `prefix` is required, and an empty one removes nothing, so a call cannot clear an area. A key under `@app/auth/` is never removed, as in `remove`, and is not counted. A key another tab removed after the listing still counts. |
| `subscribe({ key, storage?, listener })` | a function that stops it | `listener` runs after a `set` or `remove` through `BrowserStorage` and after another tab changes the key. |

`storage` is `StorageAreas.LOCAL` (default, `local`) or `StorageAreas.SESSION` (`session`). `codec` is `{ encode(value): string; decode(text): TValue }`, JSON by default. With a `codec`, `fallback` may be of another type, such as `null` for "nothing is stored", and `get` answers the union.

### A bare string as the stored text

A key whose existing data is a bare string (`dark`, not `"dark"`) is not JSON, so the default codec cannot read it. `StorageCodecs.text()` stores a string as it is. With `allowed`, the codec is typed by the list (`'light' | 'dark'` below), so a literal outside it is a compile error; a stored text outside the list gives the `fallback`, and a value outside it, passed past the types, returns `false` from `set` and leaves the storage as it was.

```typescript
import { BrowserStorage, StorageCodecs } from '@venizia/ardor';

const THEME = StorageCodecs.text({ allowed: ['light', 'dark'] });

BrowserStorage.set({ key: '@app/store/theme', value: 'dark', codec: THEME });
const theme = BrowserStorage.get({ key: '@app/store/theme', fallback: 'light', codec: THEME });
```

Create the codec once, outside a component: `useStoredState` asks for a stable `codec`. The error of a refused value names no value, because a stored text can be a token.

Keys are used as you give them. Name yours `@app/store/<name>` (`LocalStorageKeys.PREFIX_STORE` is `@app/store/`). Never write under `@app/auth/`: that prefix is the session, sign-out clears it, and `BrowserStorage` refuses it. Sign-out also removes every key under `@app/store/`, in `localStorage` and `sessionStorage`, so the next user does not see them; keep what must outlive a sign-out, such as a theme, under another prefix (or override `DefaultAuthProvider.clearStoredData`). The React side is [`useStoredState`](./hooks#usestoredstate). The source is `packages/kernel/src/utilities/browser-storage.ts`.

## Browser clipboard

`BrowserClipboard` reads and writes the text on the clipboard of the browser from code outside React, a service or a toast action for instance. Nothing throws or rejects: a refusal answers `false` or `undefined`. A refusal is any of these: no `navigator` (a server render), no `navigator.clipboard` (an insecure context, an old WebView), a denied permission, no user gesture, a document that is not focused. Nothing touches `navigator` at import.

```typescript
import { BrowserClipboard } from '@venizia/ardor';

const isCopied = await BrowserClipboard.writeText({ text: 'https://example.com/share/42' });
const pasted = await BrowserClipboard.readText();
```

| Method | Returns | Meaning |
|---|---|---|
| `writeText({ text })` | `Promise<boolean>` | `true` when the text is on the clipboard, `false` on any refusal. |
| `readText()` | `Promise<string \| undefined>` | The text, or `undefined` on any refusal. Reading needs a permission and a user gesture, and some browsers do not offer it, so `undefined` is a normal answer. |

There is no fallback to `document.execCommand('copy')`: it is deprecated and needs a DOM node, so a refusal returns `false` and the caller decides what to show. The helper logs nothing; [`useCopyToClipboard`](./hooks#usecopytoclipboard) calls it and keeps its warning. The source is `packages/kernel/src/utilities/browser-clipboard.ts`.

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
