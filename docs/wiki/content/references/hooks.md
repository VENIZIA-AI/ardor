---
title: React hooks
description: Every hook exported by ARDOR - what it returns, what it needs in the React tree, and one example each.
---

# React hooks

ARDOR ships two groups of hooks. The `@venizia/ardor-react` hooks work with the ARDOR container and plain browser APIs. The `@venizia/ardor-admin` hooks sit on top of ra-core providers. All of them are re-exported from `@venizia/ardor`.

## Prerequisites

An ARDOR application mounted with `ApplicationContext` (see [Application](../references/application)), and for the admin hooks a react-admin tree with its providers (see [Data provider](../references/data-provider), [Auth provider](../references/auth-provider), [i18n](../references/i18n)).

## Quick Reference

| Export | Needs in the tree | Returns |
|---|---|---|
| `useInjectable` | `ApplicationContext` with a `container`, or an explicit `container` option | The bound instance |
| `useApplicationContext` | `ApplicationContext` with a `container` | The `Container` |
| `useApplicationLogger` | `ApplicationContext` with a `logger` | The `Logger` |
| `useTranslate` | ra-core i18n context (optional - falls back to identity) | `(key, options?) => string` |
| `useNotifyError` | ra-core notification context | `(error, options?) => void` |
| `useRefreshToken` | ra-core auth provider context, TanStack `QueryClientProvider` | `() => Promise<any>` |
| `useRequestHeaderLocale` | ra-core locale state, `ApplicationContext` with `DEFAULT_REST_DATA_PROVIDER` bound | `void` |
| `useDebounce` | Nothing (browser only) | `{ debouncedValue }` |
| `useAutosave` | Nothing (browser only) | `void` |
| `useConfirm` | Nothing | `{ message, confirm, handleClose, handleConfirm, handleAbort }` |
| `useCopyToClipboard` | Nothing | `{ copy }` |
| `useBeforeUnload` | Nothing (browser only) | `void` |
| `useSizer` | Nothing (browser only) | `{ width, height }` |
| `useWindowDimensions` | Nothing (browser only) | `{ width, height }` |
| `createAppDispatch` | react-redux `Provider` (for the hooks it returns) | `{ useAppDispatch, useMultipleAppDispatch }` |
| `createAppSelectors` | react-redux `Provider` (for the hooks it returns) | `{ useAppSelector, useShallowEqualSelector, useDeepEqualSelector }` |

Types covered on this page: `TUseInjectableKeys`, `TUseInjectableKeysDefault`, `IUseInjectableKeysOverrides`, `TUseInjectableOptions`, `TUseTranslateKeys`, `TUseTranslateKeysDefault`, `TUseTranslateFn`, `IUseTranslateKeysOverrides`, `IUseDebounceParams`, `IUseDebounceReturn`, `IUseAutosaveParams`, `IUseConfirmReturn`, `IUseCopyToClipboardReturn`, `IUseBeforeUnloadParams`.

## useInjectable

Resolves a binding from the IGNIS container. You can ask by `key` or by `target` class. The container comes from `ApplicationContext` unless you pass one explicitly.

```tsx no-check
type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;
type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;

type TUseInjectableOptions =
  | { container?: Container; key: TUseInjectableKeys; target?: never }
  | { container?: Container; key?: never; target: TClass<AnyType> };

const useInjectable: <T>(opts: TUseInjectableOptions) => T;
```

How it resolves:

- `{ key }` - calls `container.get({ key })` directly.
- `{ target }` - looks up the binding key in the container's metadata registry, then calls `container.get`. The class must be decorated (`@service`, `@component`, ...) or registered on the application. Otherwise the hook throws.
- `{ container }` - overrides the context container. If neither an explicit container nor a context container exists, the hook throws.

By key, using a core binding:

```tsx
import { CoreBindings, DefaultRestDataProvider, useInjectable } from '@venizia/ardor';

export function TenantHeaderButton() {
  const dataProvider = useInjectable<DefaultRestDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });

  const handleClick = () => {
    dataProvider.getNetworkService().setHeaders({ 'x-tenant': 'acme' });
  };

  return <button onClick={handleClick}>Use tenant acme</button>;
}
```

By target class:

```tsx
import { useInjectable } from '@venizia/ardor';

export function ProductApiName() {
  const productApi = useInjectable<ProductApi>({ target: ProductApi });
  return <pre>{productApi.constructor.name}</pre>;
}
```

With an explicit container, outside of `ApplicationContext`:

```tsx
import { useInjectable } from '@venizia/ardor';

export function ProductApiFromContainer() {
  const productApi = useInjectable<ProductApi>({ container, target: ProductApi });
  return <pre>{productApi.constructor.name}</pre>;
}
```

`TUseInjectableKeys` is the union of the string values of `CoreBindings` plus the keys of `IUseInjectableKeysOverrides`. That interface is empty by default. Augment it to make your own binding keys type-safe - see [Module augmentation](../best-practices/module-augmentation) and [Binding keys](../references/binding-keys).

```ts
declare module '@venizia/ardor' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': true;
  }
}
```

## useApplicationContext

Returns the `Container` stored in `ApplicationContext`. Throws if the context has no container.

```ts no-check
const useApplicationContext: () => Container;
```

```tsx
import { useApplicationContext } from '@venizia/ardor';

export function ContainerStatus() {
  const appContainer = useApplicationContext();
  return <span>{appContainer ? 'container ready' : 'no container'}</span>;
}
```

## useApplicationLogger

Returns the `Logger` stored in `ApplicationContext`. Throws if the context has no logger.

```ts no-check
const useApplicationLogger: () => Logger;
```

```tsx
import { useApplicationLogger } from '@venizia/ardor';

export function LoggerStatus() {
  const logger = useApplicationLogger();
  return <span>{logger ? 'logger ready' : 'no logger'}</span>;
}
```

`ApplicationContext` itself is a plain React context with the shape `{ container, registry, logger }`, each `null` by default. The ARDOR application fills it - see [Application](../references/application).

## useTranslate

A typed wrapper over the ra-core i18n provider. The `key` argument is typed as `TUseTranslateKeys`: every dotted path of `englishMessages`, plus the keys of `IUseTranslateKeysOverrides`.

```ts no-check
type TUseTranslateKeysDefault = TFullPaths<typeof englishMessages>;
type TUseTranslateKeys = TUseTranslateKeysDefault | keyof IUseTranslateKeysOverrides;
type TUseTranslateFn = (key: TUseTranslateKeys, options?: AnyType) => string;

const useTranslate: () => TUseTranslateFn | ((key: AnyType) => AnyType);
```

When no i18n provider is in the tree, the hook returns an identity function - `translate('x')` gives back `'x'`. So the hook is safe to call in components that are also rendered outside of react-admin.

```tsx
import { useTranslate } from '@venizia/ardor';

export function SaveButton() {
  const translate = useTranslate();
  return <button type="submit">{translate('ra.action.save')}</button>;
}
```

Add your own message keys by augmenting `IUseTranslateKeysOverrides` - see [i18n](../references/i18n) and [Module augmentation](../best-practices/module-augmentation).

## useNotifyError

Turns an `ApplicationError` into a react-admin notification. It reads `error.normalized.code` as the message key and `error.normalized.args` as `messageArgs`. The default type is `'error'`; any `options` you pass are spread last and win.

```ts no-check
const useNotifyError: () => (
  error: ApplicationError,
  options?: NotificationOptions & { type?: NotificationType },
) => void;
```

Needs the ra-core notification context (the one `useNotify` reads).

```tsx
import { useNotifyError } from '@venizia/ardor';

type TAppError = Parameters<ReturnType<typeof useNotifyError>>[0];

export function DeleteButton(props: { onDelete: () => Promise<void> }) {
  const notifyError = useNotifyError();

  const handleClick = () => {
    props.onDelete().catch((error: TAppError) => {
      notifyError(error);
    });
  };

  return <button onClick={handleClick}>Delete</button>;
}
```

## useRefreshToken

Returns a callback that calls `authProvider.refreshToken()` and then invalidates the `['auth', 'getPermissions']` query. If no auth provider is in the tree, the callback resolves to `undefined` without doing anything.

```ts no-check
const useRefreshToken: () => () => Promise<any>;
```

Needs the ra-core auth provider context and a TanStack `QueryClientProvider`. The auth provider must implement `refreshToken` - see [Auth provider](../references/auth-provider).

```tsx
import { useRefreshToken } from '@venizia/ardor';

export function RefreshTokenButton() {
  const refreshToken = useRefreshToken();
  return <button onClick={() => refreshToken()}>Refresh token</button>;
}
```

## useRequestHeaderLocale

Keeps a request header in sync with the react-admin locale. On every locale change it calls `setHeaders` on the network service of the `DefaultRestDataProvider` bound at `CoreBindings.DEFAULT_REST_DATA_PROVIDER`. The header name defaults to `HeaderConsts.X_LOCALE`.

```ts no-check
const useRequestHeaderLocale: (params?: { key?: string }) => void;
```

Needs the ra-core locale state and an `ApplicationContext` whose container has the default REST data provider bound. Mount it once, high in the admin tree.

```tsx
import { useRequestHeaderLocale } from '@venizia/ardor';

export function LocaleHeaderSync() {
  useRequestHeaderLocale({ key: 'accept-language' });
  return null;
}
```

## useDebounce

Delays a value. The debounced value updates `delay` milliseconds after the last change. The default delay is `App.DEFAULT_DEBOUNCE_TIME`.

```tsx no-check
interface IUseDebounceParams<TValue> {
  value: TValue;
  delay?: number;
  disabled?: boolean;
}

interface IUseDebounceReturn<TValue> {
  debouncedValue: TValue;
}

const useDebounce: <TValue>(params: IUseDebounceParams<TValue>) => IUseDebounceReturn<TValue>;
```

When `disabled` is true, or outside a browser, the timer is not set and `debouncedValue` keeps its last value.

```tsx
import React from 'react';
import { useDebounce } from '@venizia/ardor';

export function ProductSearch() {
  const [term, setTerm] = React.useState('');
  const { debouncedValue } = useDebounce({ value: term, delay: 400 });

  return (
    <div>
      <input value={term} onChange={(event) => setTerm(event.target.value)} />
      <p>Searching for: {debouncedValue}</p>
    </div>
  );
}
```

## useAutosave

Calls `onSave` with the latest `data` after it has been stable for `interval` milliseconds (default `2000`). It is built on `useDebounce`. The first render is skipped. A rejected `onSave` is logged with `console.error` and swallowed.

```tsx no-check
interface IUseAutosaveParams<TData, TReturn> {
  data: TData;
  onSave: (data: TData) => Promise<TReturn> | TReturn | void;
  interval?: number;
  enableSaveOnUnmount?: boolean;
  disabled?: boolean;
}

const useAutosave: <TData, TReturn>(params: IUseAutosaveParams<TData, TReturn>) => void;
```

With `enableSaveOnUnmount: true` the hook calls `onSave` one more time with the latest `data` when the component unmounts. `disabled` stops the debounce timer, so no save is scheduled.

A custom hook that owns the note text and autosaves it. Bind `text` and `setText` to a textarea in the component that uses it:

```ts
import React from 'react';
import { useAutosave } from '@venizia/ardor';

export function useNoteAutosave(opts: { onSave: (params: { text: string }) => Promise<void> }) {
  const [text, setText] = React.useState('');

  useAutosave({
    data: text,
    onSave: (value) => opts.onSave({ text: value }),
    interval: 3000,
    enableSaveOnUnmount: true,
  });

  return { text, setText };
}
```

## useConfirm

A promise-based confirmation. `confirm({ message })` stores the message and returns a promise. `handleConfirm` resolves it with `true`, `handleAbort` with `false`. Both also clear the message. `handleClose` only clears the message - the pending promise is never resolved.

```ts no-check
interface IUseConfirmReturn {
  message?: string;
  confirm: (opts: { message: string }) => Promise<boolean>;
  handleClose: () => void;
  handleConfirm: () => void;
  handleAbort: () => void;
}

const useConfirm: () => IUseConfirmReturn;
```

Wire `message` to a dialog, `handleConfirm` to its confirm button and `handleAbort` to its cancel button. `requestDelete` waits for the answer before calling `onDelete`:

```ts
import { useConfirm } from '@venizia/ardor';

export function useDeleteConfirmation(opts: { onDelete: () => Promise<void> }) {
  const { message, confirm, handleConfirm, handleAbort } = useConfirm();

  const requestDelete = async () => {
    const ok = await confirm({ message: 'Delete this product?' });
    if (ok) {
      await opts.onDelete();
    }
  };

  return { message, requestDelete, handleConfirm, handleAbort };
}
```

## useCopyToClipboard

Wraps `navigator.clipboard.writeText`. `copy` resolves to `true` on success. It resolves to `false`, with a `console.warn`, when the Clipboard API is missing or the write fails.

```ts no-check
interface IUseCopyToClipboardReturn {
  copy: (opts: { value: string }) => Promise<boolean>;
}

const useCopyToClipboard: () => IUseCopyToClipboardReturn;
```

```ts
import React from 'react';
import { useCopyToClipboard } from '@venizia/ardor';

export function useCopyLink(opts: { href: string }) {
  const { copy } = useCopyToClipboard();
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    const ok = await copy({ value: opts.href });
    setCopied(ok);
  };

  return { copied, copyLink };
}
```

## useBeforeUnload

Registers a `beforeunload` listener while the component is mounted. When `enabled` (a boolean or a function returning one) is true, the handler calls `event.preventDefault()` and sets `event.returnValue` to `message` if one is given.

```ts no-check
interface IUseBeforeUnloadParams {
  enabled: boolean | (() => boolean);
  message?: string;
}

const useBeforeUnload: (params: IUseBeforeUnloadParams) => void;
```

```ts
import React from 'react';
import { useBeforeUnload } from '@venizia/ardor';

export function useDraftGuard() {
  const [draft, setDraft] = React.useState('');

  useBeforeUnload({
    enabled: () => draft.length > 0,
    message: 'You have unsaved changes.',
  });

  return { draft, setDraft };
}
```

## useSizer

Tracks the size of a DOM element found by id, using a `ResizeObserver`. It returns `{ width, height }`, both `0` until the element is found and measured. The reported width is `clientWidth + 1` and the reported height is `offsetHeight + 1`.

```ts no-check
const useSizer: (props: { containerId: string }) => { width: number; height: number };
```

The effect depends on the `props` object itself. Pass a stable object so the observer is not recreated on every render. The element with id `chart` must be in the DOM for the values to update:

```ts
import { useSizer } from '@venizia/ardor';

const CHART_SIZER = { containerId: 'chart' };

export function useChartSize() {
  const { width, height } = useSizer(CHART_SIZER);
  return { width, height, isMeasured: width > 0 && height > 0 };
}
```

## useWindowDimensions

Returns `window.innerWidth` and `window.innerHeight`, updated on every `resize` event.

```ts no-check
const useWindowDimensions: () => { width: number; height: number };
```

The initial state reads `window` synchronously, so this hook is browser only. It composes well into your own hooks:

```ts
import { useWindowDimensions } from '@venizia/ardor';

export function useIsNarrowViewport(opts: { breakpoint: number }) {
  const { width, height } = useWindowDimensions();
  return { isNarrow: width < opts.breakpoint, width, height };
}
```

## createAppDispatch / createAppSelectors

Two factories that build typed react-redux hooks for your store. Call them once in a module and export the result. The hooks they return need a react-redux `Provider` in the tree.

```ts no-check
const createAppDispatch: <D extends Dispatch<UnknownAction> = Dispatch<UnknownAction>>() => {
  useAppDispatch: () => D;
  useMultipleAppDispatch: () => (...actions: Parameters<D>[0][]) => void;
};

const createAppSelectors: <S>() => {
  useAppSelector: <T>(selector: (state: S) => T, equalityFn?: (a: T, b: T) => boolean) => T;
  useShallowEqualSelector: <T>(selector: (state: S) => T) => T;
  useDeepEqualSelector: <T>(selector: (state: S) => T) => T;
};
```

- `useAppDispatch` is `useDispatch.withTypes<D>()`.
- `useMultipleAppDispatch` returns a function that dispatches each given action in order. Falsy entries are skipped.
- `useAppSelector` is `useSelector.withTypes<S>()`.
- `useShallowEqualSelector` uses react-redux `shallowEqual`.
- `useDeepEqualSelector` uses lodash `isEqual`.

Create the hooks once, in a module next to the store, then compose them into your own hooks:

```ts
import { createAppDispatch, createAppSelectors } from '@venizia/ardor';

export const { useAppDispatch, useMultipleAppDispatch } =
  createAppDispatch<typeof store.dispatch>();

export const { useAppSelector, useShallowEqualSelector, useDeepEqualSelector } =
  createAppSelectors<ReturnType<typeof store.getState>>();

export function useRefreshAll() {
  const dispatch = useAppDispatch();
  const dispatchAll = useMultipleAppDispatch();
  const state = useShallowEqualSelector((current) => current);

  return {
    refreshProducts: () => dispatch({ type: 'products/refresh' }),
    refreshAll: () => dispatchAll({ type: 'products/refresh' }, { type: 'orders/refresh' }),
    sliceNames: Object.keys(state),
  };
}
```

## Common pitfalls

- `useInjectable({ target })` throws when the class has no binding key in the metadata registry. Decorate the class or register it on the application first.
- `useApplicationContext` and `useApplicationLogger` throw outside of a filled `ApplicationContext`. `useInjectable` throws too, unless you pass `container` explicitly.
- `useTranslate` returns an identity function without an i18n provider. Missing translations will not error - they render the key.
- `useNotifyError` reads `error.normalized.code`. An error without a `normalized` field notifies with an `undefined` message.
- `useConfirm`: `handleClose` clears the dialog but leaves the pending promise unresolved. Use `handleAbort` for a cancel button. Calling `confirm` again before the first promise settles replaces the resolver, so the first promise never resolves.
- `useAutosave` swallows `onSave` rejections after logging them. Handle failures inside `onSave` if the UI must react.
- `useSizer` re-subscribes when its argument object changes identity. Keep the `{ containerId }` object stable.
- `useWindowDimensions` and `useSizer` touch `window` and `document`. They are not for server rendering. `useDebounce` and `useAutosave` do nothing outside a browser.
- `useRequestHeaderLocale` requires `CoreBindings.DEFAULT_REST_DATA_PROVIDER` to be bound. See [Binding keys](../references/binding-keys).
- The redux factories rely on `useDispatch.withTypes` and `useSelector.withTypes`, so react-redux must be a version that provides them.
- There is no `useDocumentTitle` export in ARDOR. If you migrate from ra-core-infra, replace it - see [Migration from ra-core-infra](../guides/migration/from-ra-core-infra).

## Related

- [Application](../references/application)
- [Binding keys](../references/binding-keys)
- [Data provider](../references/data-provider)
- [Auth provider](../references/auth-provider)
- [i18n](../references/i18n)
- [Types](../references/types)
- [Module augmentation](../best-practices/module-augmentation)
- [Quickstart](../guides/get-started/quickstart)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
