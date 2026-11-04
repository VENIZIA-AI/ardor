---
title: Hooks
description: Reference for every React hook exported by ARDOR, covering container access, Redux utilities, ra-core companions, and browser helpers.
---

# Hooks

ARDOR provides hooks to interact with the dependency injection container, Redux state, react-admin contexts, and browser APIs. All hooks are exported from `@venizia/ardor`.

```tsx
import { useDocumentTitle } from '@venizia/ardor';

export function StatusWidget() {
  useDocumentTitle({ title: 'Status', appTitle: 'Back Office' });
  return <span>Ready</span>;
}
```

## One name for every hook: `Ardor`

`@venizia/ardor` also exports `Ardor`, a namespace that holds every hook on this page, the way `React.useState` holds a React hook. `Ardor.useRepository(...)` is the same function as `useRepository(...)`, and the React Rules of Hooks check a call through `Ardor` like any other hook call.

```tsx
import { Ardor } from '@venizia/ardor';

export function StatusTitle() {
  Ardor.useDocumentTitle({ title: 'Status', appTitle: 'Back Office' });
  return <span>Ready</span>;
}
```

It costs nothing in the bundle: a bundler keeps only the hooks you call through `Ardor`, so it adds the same bytes as importing them by name. Read a hook through `Ardor.useX` in code; do not index it with a computed key (`Ardor[name]`), which makes the bundler keep them all. The bare imports keep working, and `@venizia/ardor-react` and `@venizia/ardor-admin` still export their own hooks for a project that installs one layer.

## Which hook do I need?

| I want to... | Hook | Needs in the tree | Returns |
| --- | --- | --- | --- |
| Access the IoC container from context | `useApplicationContext` | `ApplicationContext` with a container | `Container` |
| Access the container with an optional override | `useApplicationContainer` | `ApplicationContext` with a container, or explicit option | `Container` |
| Resolve a bound dependency by key or class | `useInjectable` | `ApplicationContext` with a container, or explicit option | Bound instance |
| Resolve a service from the `services` namespace | `useService` | `ApplicationContext` with a container, or explicit option | Bound service instance |
| Resolve a repository from the `repositories` namespace | `useRepository` | `ApplicationContext` with a container, or explicit option | Bound repository instance |
| Resolve a provider from the `providers` namespace | `useProvider` | `ApplicationContext` with a container, or explicit option | Bound provider instance |
| Resolve a component from the `components` namespace | `useComponent` | `ApplicationContext` with a container, or explicit option | Bound component instance |
| Resolve a configuration class from the `configurations` namespace | `useConfiguration` | `ApplicationContext` with a container, or explicit option | Bound configuration instance |
| Access the application logger from context | `useApplicationLogger` | `ApplicationContext` with a logger | `ILogger` |
| Build typed dispatch hooks for a Redux store | `DispatchHooks.create` | react-redux `Provider` | `{ useAppDispatch, useMultipleAppDispatch }` |
| Build typed selector hooks for Redux state | `SelectorHooks.create` | react-redux `Provider` | `{ useAppSelector, useShallowEqualSelector, useDeepEqualSelector }` |
| Translate message keys with the active i18n provider | `useTranslate` | ra-core i18n context (optional; ra-core's default provider answers without one) | Translation function |
| Refresh session token and invalidate permissions query | `useRefreshToken` | ra-core auth provider context, TanStack `QueryClientProvider` | Refresh callback |
| Display an `ApplicationError` as a notification toast | `useNotifyError` | ra-core notification context | Notification callback |
| Synchronize request headers with the active locale | `useRequestHeaderLocale` | ra-core locale state, `CoreBindings.DEFAULT_REST_DATA_PROVIDER` bound | `void` |
| List mounted application features | `useFeatures` | `ApplicationContext` with a container | `Array<TItem>` |
| Set document title with automatic restoration on unmount | `useDocumentTitle` | Browser DOM | `void` |
| Synchronize `<html lang>` with the active locale | `useHtmlLang` | ra-core locale state, browser DOM | `void` |
| Debounce a rapidly changing value | `useDebounce` | Browser DOM | `{ debouncedValue }` |
| Automatically save stable form data | `useAutosave` | Browser DOM | `void` |
| Show a Promise-based confirmation prompt | `useConfirm` | React tree | Confirmation controls |
| Copy text to clipboard using the Clipboard API | `useCopyToClipboard` | Browser Clipboard API | `{ copy }` |
| Warn user before leaving page with unsaved changes | `useBeforeUnload` | Browser window | `void` |
| Observe element dimensions with `ResizeObserver` | `useSizer` | Browser DOM | `{ width, height }` |
| Observe the content or border box of an element with `ResizeObserver` | `useElementSize` | Browser DOM | `{ width, height, measured }`, plus `ref` when you pass no `ref` option |
| Run a callback when any of several elements, or their children, resizes | `useResizeEffect` | Browser DOM | `void` |
| Know whether an element is in view, with `IntersectionObserver` | `useIntersection` | Browser DOM | `IntersectionObserverEntry \| undefined` |
| Keep a value in `localStorage` or `sessionStorage`, in step across hooks and tabs | `useStoredState` | Browser storage | `{ value, setValue, remove }` |
| Track window inner dimensions on resize | `useWindowDimensions` | Browser window | `{ width, height }` |
| Know whether a media query matches | `useMediaQuery` | Browser window | `boolean` |
| Know whether the tab is visible | `useDocumentVisibility` | Browser DOM | `'visible' \| 'hidden'` |
| Know whether the browser is online | `useOnlineStatus` | Browser window | `boolean` |

## Reach the container

### useApplicationContext

```tsx
import { useApplicationContext } from '@venizia/ardor';

export function ContainerStatus() {
  const container = useApplicationContext();
  return <span>{container ? 'container ready' : 'no container'}</span>;
}
```

- **Parameters**: None.
- **Return value**: `Container` from `@venizia/ignis-inversion`.
- **Gotcha**: Throws an error (`[useApplicationContext] must be used within a ApplicationContextProvider`) if called when no container is mounted on `ApplicationContext`. Defined in `packages/react/src/hooks/use-application-context.ts`.

### useApplicationContainer

```tsx
import { useApplicationContainer } from '@venizia/ardor';

export function ContainerChecker() {
  const container = useApplicationContainer();
  return <span>{container ? 'container ready' : 'no container'}</span>;
}
```

- **Parameters**: Optional `opts?: { container?: Container }`.
- **Return value**: `Container`.
- **Gotcha**: Throws an error (`[useApplicationContainer] Failed to determine the application container!`) if neither `opts.container` nor `ApplicationContext.container` is available. Defined in `packages/react/src/hooks/use-injectable.ts`.

### useInjectable

```tsx
import { CoreBindings, type DefaultRestDataProvider, useInjectable } from '@venizia/ardor';

export function TenantHeaderButton() {
  const dataProvider = useInjectable<DefaultRestDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });
  return (
    <button onClick={() => dataProvider.getNetworkService().setHeaders({ headers: { 'x-tenant': 'acme' } })}>
      Tenant
    </button>
  );
}
```

- **Parameters**: `opts: TUseInjectableOptions` - `{ key: TUseInjectableKeys; container?: Container }` or `{ target: TClass<AnyType>; container?: Container }`.
- **Return value**: The resolved instance `TInstance`.
- **Gotcha**: When resolving by `{ target }`, the class must have a registered binding key recorded by a stereotype decorator (`@service()`, `@repository()`, etc.) or registration helper; resolving an undecorated class throws an error. If code minifiers rename classes, keys derived from `<namespace>.<ClassName>` change unless pinned with `binding: { namespace, key }` on the class or resolved by `{ target }` (see [Binding keys](./binding-keys)). Defined in `packages/react/src/hooks/use-injectable.ts`.

### useService

```tsx
import { service, useService } from '@venizia/ardor';

@service()
class OrderService {
  calculateTotal(subtotal: number, tax: number) { return subtotal + tax; }
}

export function OrderTotal() {
  const orderService = useService({ target: OrderService });
  return <span>Total: {orderService.calculateTotal(100, 10)}</span>;
}
```

- **Parameters**: `opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey` - `{ target: TClass<TInstance>; container?: Container }` or `{ key: TUseInjectableKeys; container?: Container }`.
- **Return value**: `TInstance` (inferred from `target`, or supplied type argument).
- **Gotcha**: When passing `target`, throws if the class is bound under a namespace other than `services`. Defined in `packages/react/src/hooks/use-artifact.ts`.

### useRepository

```tsx
import { repository, useRepository } from '@venizia/ardor';

@repository()
class ProductRepository {
  findStock(productId: string) { return productId ? 42 : 0; }
}

export function StockDisplay() {
  const productRepository = useRepository({ target: ProductRepository });
  return <span>Stock: {productRepository.findStock('p1')}</span>;
}
```

- **Parameters**: `opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey` - `{ target: TClass<TInstance>; container?: Container }` or `{ key: TUseInjectableKeys; container?: Container }`.
- **Return value**: `TInstance` (inferred from `target`, or supplied type argument).
- **Gotcha**: When passing `target`, throws if the class is bound under a namespace other than `repositories`. Defined in `packages/react/src/hooks/use-artifact.ts`.

### useProvider

```tsx
import { CoreBindings, type IDataProvider, useProvider } from '@venizia/ardor';

export function DataProviderWidget() {
  const dataProvider = useProvider<IDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });
  return <span>Data provider mounted: {dataProvider ? 'yes' : 'no'}</span>;
}
```

- **Parameters**: `opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey` - `{ target: TClass<TInstance>; container?: Container }` or `{ key: TUseInjectableKeys; container?: Container }`.
- **Return value**: `TInstance` (inferred from `target`, or supplied type argument).
- **Gotcha**: When passing `target`, throws if the class is bound under a namespace other than `providers`. Defined in `packages/react/src/hooks/use-artifact.ts`.

### useComponent

```tsx
import { component, useComponent } from '@venizia/ardor';

@component()
class BannerComponent {
  getLabel() { return 'Dashboard'; }
}

export function BannerView() {
  const banner = useComponent({ target: BannerComponent });
  return <span>{banner.getLabel()}</span>;
}
```

- **Parameters**: `opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey` - `{ target: TClass<TInstance>; container?: Container }` or `{ key: TUseInjectableKeys; container?: Container }`.
- **Return value**: `TInstance` (inferred from `target`, or supplied type argument).
- **Gotcha**: When passing `target`, throws if the class is bound under a namespace other than `components`. Defined in `packages/react/src/hooks/use-artifact.ts`.

### useConfiguration

```tsx
import { configuration, useConfiguration } from '@venizia/ardor';

@configuration()
class AppSettings {
  readonly environment = 'production';
}

export function EnvironmentLabel() {
  const settings = useConfiguration({ target: AppSettings });
  return <span>{settings.environment}</span>;
}
```

- **Parameters**: `opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey` - `{ target: TClass<TInstance>; container?: Container }` or `{ key: TUseInjectableKeys; container?: Container }`.
- **Return value**: `TInstance` (inferred from `target`, or supplied type argument).
- **Gotcha**: When passing `target`, throws if the class is bound under a namespace other than `configurations`. Defined in `packages/react/src/hooks/use-artifact.ts`.

### useApplicationLogger

```tsx
import { useApplicationLogger } from '@venizia/ardor';

export function LoggerButton() {
  const logger = useApplicationLogger();
  return <button onClick={() => logger.info('Action executed')}>Log action</button>;
}
```

- **Parameters**: None.
- **Return value**: `ILogger` from `@venizia/ignis-helpers/core`.
- **Gotcha**: Throws an error (`[useApplicationLogger] must be used within a ApplicationContextProvider`) if called when no logger is mounted on `ApplicationContext`. Defined in `packages/react/src/hooks/use-application-context.ts`.

## Redux

### DispatchHooks.create

```ts
import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { DispatchHooks } from '@venizia/ardor';

type AppDispatch = Dispatch<UnknownAction>;

export const { useAppDispatch, useMultipleAppDispatch } = DispatchHooks.create<AppDispatch>();

export function useResetAction() {
  const dispatch = useAppDispatch();
  const dispatchMultiple = useMultipleAppDispatch();
  return {
    reset: () => dispatch({ type: 'reset' }),
    batchReset: () => dispatchMultiple({ type: 'step1' }, { type: 'step2' }),
  };
}
```

- **Parameters**: None. The factory accepts a type parameter `TDispatch extends Dispatch<UnknownAction>`.
- **Return value**: `{ useAppDispatch, useMultipleAppDispatch }` - typed `useDispatch` hook returning `TDispatch`, and callback `(...actions) => void` dispatching non-falsy actions in sequential order.
- **Gotcha**: Requires a react-redux `Provider` in the tree. Falsy action arguments passed to `useMultipleAppDispatch` are skipped. Defined in `packages/react/src/hooks/redux/use-app-dispatch.ts`.

### SelectorHooks.create

```ts
import { SelectorHooks } from '@venizia/ardor';

interface RootState {
  user: { name: string };
  settings: { theme: string };
}

export const { useAppSelector, useShallowEqualSelector, useDeepEqualSelector } =
  SelectorHooks.create<RootState>();

export function useUserState() {
  const userName = useAppSelector((state) => state.user.name);
  const settings = useShallowEqualSelector((state) => state.settings);
  const user = useDeepEqualSelector((state) => state.user);
  return { userName, settings, user };
}
```

- **Parameters**: None. The factory accepts a type parameter `TState`.
- **Return value**: `{ useAppSelector, useShallowEqualSelector, useDeepEqualSelector }` using default, react-redux `shallowEqual`, and lodash `isEqual` comparators.
- **Gotcha**: Requires a react-redux `Provider` in the tree. Defined in `packages/react/src/hooks/redux/use-app-selector.ts`.

## ra-core companions

### useTranslate

```tsx
import { useTranslate } from '@venizia/ardor';

export function SaveButton() {
  const translate = useTranslate();
  return <button type="submit">{translate('ra.action.save')}</button>;
}
```

- **Parameters**: None.
- **Return value**: `TUseTranslateFn` (`(key: TUseTranslateKeys, options?: AnyType) => string`).
- **Gotcha**: With no i18n provider mounted, ra-core's default provider answers instead of throwing: it returns the `_` text of the options when given, else the key, and fills `%{token}` placeholders from the options. Keys can be extended by augmenting `IUseTranslateKeysOverrides` (see [Module augmentation](../best-practices/module-augmentation)). Defined in `packages/admin/src/hooks/use-translate.ts`.

### useUntypedTranslate

```tsx
import { useUntypedTranslate } from '@venizia/ardor';

export function ErrorLine(props: { code: string }) {
  const translate = useUntypedTranslate();
  return <p>{translate(`errors.${props.code}`, { _: 'Something went wrong' })}</p>;
}
```

- **Parameters**: None.
- **Return value**: `TUseUntypedTranslateFn` (`(key: string, options?: AnyType) => string`).
- **Gotcha**: For a key that exists only at run time, such as a server error code or a data label. A key written in code belongs to [`useTranslate`](#usetranslate), which checks it at compile time; both read the same i18n provider and share one implementation. It is ra-core's own `useTranslate` with a `string` key. A key the catalogs do not hold comes back unchanged, or as the `_` text of the options; with no i18n provider, ra-core's default provider answers the same way. Defined in `packages/admin/src/hooks/use-translate.ts`.

### useRefreshToken

```tsx
import { useRefreshToken } from '@venizia/ardor';

export function RefreshTokenButton() {
  const refreshToken = useRefreshToken();
  return <button onClick={() => void refreshToken()}>Refresh token</button>;
}
```

- **Parameters**: None.
- **Return value**: A callback function `() => Promise<any>`.
- **Gotcha**: Requires the ra-core auth provider context and a TanStack `QueryClientProvider` in the tree. If no auth provider is mounted, calling the returned function resolves to `undefined` without executing anything. Defined in `packages/admin/src/hooks/use-refresh-token.ts`.

### useNotifyError

```tsx
import { useNotifyError } from '@venizia/ardor';

type TNotifyError = ReturnType<typeof useNotifyError>;
type TAppError = Parameters<TNotifyError>[0];

export function DeleteAction(props: { onDelete: () => Promise<void> }) {
  const notifyError = useNotifyError();
  const handleClick = () => {
    props.onDelete().catch((error: TAppError) => notifyError(error));
  };
  return <button onClick={handleClick}>Delete</button>;
}
```

- **Parameters**: None. The returned callback accepts `(error: ApplicationError, options?: NotificationOptions & { type?: NotificationType }) => void`.
- **Return value**: Notification callback function.
- **Gotcha**: Reads `error.normalized?.code` as the translation key and `error.normalized?.args` as `messageArgs`. Passing an error without a `normalized` property results in an `undefined` notification message. Defined in `packages/admin/src/hooks/use-notify-error.ts`.

### useRequestHeaderLocale

```tsx
import { useRequestHeaderLocale } from '@venizia/ardor';

export function LocaleHeaderSync() {
  useRequestHeaderLocale({ key: 'accept-language' });
  return null;
}
```

- **Parameters**: Optional `opts?: { key?: string }`.
- **Return value**: `void`.
- **Gotcha**: Requires `CoreBindings.DEFAULT_REST_DATA_PROVIDER` to be bound in the container. The header name defaults to `HeaderConstants.X_LOCALE` (`'x-locale'`) if `key` is omitted. Defined in `packages/admin/src/hooks/use-request-header-locale.ts`.

### useFeatures

```tsx
import { useFeatures } from '@venizia/ardor';

export function FeatureNavigation() {
  const features = useFeatures();
  return <nav>{features.map((feature) => <span key={feature.name}>{feature.name}</span>)}</nav>;
}
```

- **Parameters**: None. Accepts type parameter `TItem extends TFeature = TFeature`.
- **Return value**: `Array<TItem>` (typed `Array<TFeature>` by default).
- **Gotcha**: Reads from the container using `useApplicationContainer()`, throwing if called outside `ApplicationContext`. Returns an empty array `[]` if no features were mounted. Defined in `packages/admin/src/hooks/use-features.ts`.

### useDocumentTitle

```tsx
import { useDocumentTitle } from '@venizia/ardor';

export function OrderPage(props: { orderNumber?: string }) {
  useDocumentTitle({
    title: [props.orderNumber && `Order #${props.orderNumber}`, 'Orders'],
    appTitle: 'Back Office',
  });
  return null;
}
```

A layout with a base title; a screen such as `OrderPage` above overrides it:

```tsx
import { useDocumentTitle } from '@venizia/ardor';

export function AppLayout(props: { appName: string; children: React.ReactNode }) {
  useDocumentTitle({ title: undefined, appTitle: props.appName, fallback: true });
  return props.children;
}
```

- **Parameters**: `opts: IUseDocumentTitleOptions` - `title`, `appTitle`, optional `separator` (default `' · '`), optional `enabled` (default `true`), optional `fallback` (default `false`; a base title for a layout, below).
- **Return value**: `void`.
- **Gotcha**: Restores the previous title on cleanup only if `document.title` still equals what this hook set; an update from a later writer is left in place. Child effects run before parent effects, so when a layout and a screen both call it, the layout's title wins on the first mount (and when the layout mounts again). Pass `fallback: true` in the layout: a fallback shows only while no other call is mounted, so the screen's title wins on the first mount, the fallback shows again when the screen unmounts, and of two fallbacks the one mounted last shows. A base title that never changes can also be the `<title>` of `index.html`. Defined in `packages/admin/src/hooks/use-document-title.ts`.

### useHtmlLang

```tsx
import { useHtmlLang } from '@venizia/ardor';

export function HtmlLangSync() {
  useHtmlLang();
  return null;
}
```

- **Parameters**: None.
- **Return value**: `void`.
- **Gotcha**: Requires ra-core `useLocaleState` in the tree. Modifies `document.documentElement.lang`, requiring a browser DOM environment. Defined in `packages/admin/src/hooks/use-html-lang.ts`.

## Browser and UI utilities

### useDebounce

```tsx
import React from 'react';
import { useDebounce } from '@venizia/ardor';

export function ProductSearch() {
  const [term, setTerm] = React.useState('');
  const { debouncedValue } = useDebounce({ value: term, delay: 400 });
  return <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={debouncedValue} />;
}
```

- **Parameters**: `opts: IUseDebounceOptions<TValue>` - `value`, optional `delay` (default `App.DEFAULT_DEBOUNCE_TIME` = 500 ms), optional `enabled` (default `true`).
- **Return value**: `IUseDebounceReturn<TValue>` containing `{ debouncedValue: TValue }`.
- **Gotcha**: When `enabled` is `false` or outside the browser (`!BrowserUtility.isBrowser()`), the timer does not run and `debouncedValue` retains its initial value. Defined in `packages/react/src/hooks/use-debounce.ts`.

### useAutosave

```tsx
import React from 'react';
import { useAutosave } from '@venizia/ardor';

export function NotePad(props: { onSave: (text: string) => Promise<void> }) {
  const [text, setText] = React.useState('');
  useAutosave({ data: text, onSave: props.onSave, interval: 2000, enableSaveOnUnmount: true });
  return <textarea value={text} onChange={(e) => setText(e.target.value)} />;
}
```

- **Parameters**: `opts: IUseAutosaveOptions<TData, TReturn>` - `data`, `onSave`, optional `interval` (default `2000`), optional `enableSaveOnUnmount`, optional `enabled` (default `true`).
- **Return value**: `void`.
- **Gotcha**: The initial render is skipped. Rejections from `onSave` are logged through a logger scoped `useAutosave` and swallowed without propagating. Defined in `packages/react/src/hooks/use-autosave.ts`.

### useConfirm

```tsx
import { useConfirm } from '@venizia/ardor';

export function DeleteConfirmation(props: { onDelete: () => Promise<void> }) {
  const { message, confirm, handleConfirm, handleAbort } = useConfirm();
  const handleClick = async () => {
    if (await confirm({ message: 'Delete this item?' })) {
      await props.onDelete();
    }
  };
  return (
    <div>
      <button onClick={handleClick}>Delete</button>
      {message && <button onClick={handleConfirm}>Confirm</button>}
      {message && <button onClick={handleAbort}>Cancel</button>}
    </div>
  );
}
```

- **Parameters**: None.
- **Return value**: `IUseConfirmReturn` - `{ message?, confirm, handleClose, handleConfirm, handleAbort }`.
- **Gotcha**: `handleConfirm` resolves `true`, `handleAbort` resolves `false`, `handleClose` clears the state without resolving. Calling `confirm` again while a prior confirmation is pending resolves the previous Promise with `false` and shows the new message. Defined in `packages/react/src/hooks/use-confirm.ts`.

### useCopyToClipboard

```tsx
import React from 'react';
import { useCopyToClipboard } from '@venizia/ardor';

export function CopyShareLink(props: { url: string }) {
  const { copy } = useCopyToClipboard();
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => setCopied(await copy({ value: props.url }));
  return <button onClick={handleCopy}>{copied ? 'Copied' : 'Share'}</button>;
}
```

- **Parameters**: None. Returned `copy` callback takes `{ value: string }`.
- **Return value**: `IUseCopyToClipboardReturn`: `{ copy: (opts: { value: string }) => Promise<boolean> }`.
- **Gotcha**: Resolves to `false` and logs a warning through a logger scoped `useCopyToClipboard` whenever the text is not on the clipboard: no `navigator` (a server render), no `navigator.clipboard` (non-HTTPS environments, an old WebView), a denied permission or a failed write. It never throws. The write is [`BrowserClipboard.writeText`](./index#browser-clipboard), which is also what to call from code outside React. Defined in `packages/react/src/hooks/use-copy-to-clipboard.ts`.

### useBeforeUnload

```tsx
import React from 'react';
import { useBeforeUnload } from '@venizia/ardor';

export function EditFormGuard() {
  const [dirty, setDirty] = React.useState(false);
  useBeforeUnload({ enabled: dirty, message: 'You have unsaved changes.' });
  return <input onChange={() => setDirty(true)} />;
}
```

- **Parameters**: `opts: IUseBeforeUnloadOptions` - optional `enabled` (default `true`), optional `message`.
- **Return value**: `void`.
- **Gotcha**: Modern browsers display a generic browser-defined confirmation prompt rather than custom `message` text, but assigning `message` populates `event.returnValue` as required by the specification. Defined in `packages/react/src/hooks/use-before-unload.ts`.

### useSizer

```tsx
import { useSizer } from '@venizia/ardor';

export function ChartContainer() {
  const { width, height } = useSizer({ containerId: 'chart-panel' });
  return (
    <div id="chart-panel">
      <span>Width: {width}, Height: {height}</span>
    </div>
  );
}
```

- **Parameters**: `opts: IUseSizerOptions` - `containerId: string`.
- **Return value**: `IUseSizerReturn`: `{ width: number; height: number }`.
- **Gotcha**: Reported width and height are the element's `offsetWidth` and `offsetHeight`, as they are. Returns `0` for both dimensions until the target element exists in the DOM. The observer effect depends only on `containerId`, so passing an inline `{ containerId: '...' }` object does not cause re-subscription. Defined in `packages/react/src/hooks/use-sizer.ts`.

### useElementSize

```tsx
import React from 'react';
import { useElementSize } from '@venizia/ardor';

export function Chart() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize({ ref });

  return <div ref={ref}>Width: {width}, Height: {height}</div>;
}
```

Leave `ref` out when the element mounts later or is replaced, and give the returned `ref` to it:

```tsx
import { useElementSize } from '@venizia/ardor';

export function Panel({ open }: { open: boolean }) {
  const { ref, width, measured } = useElementSize({ round: true });

  return open ? <div ref={ref}>{measured ? `${width}px` : '...'}</div> : null;
}
```

- **Parameters**: `opts?: IUseElementSizeOptions` - optional `ref: React.RefObject<Element | null>`, optional `box`: `content-box` (default) or `border-box`, optional `round`: `true` rounds width and height to whole pixels (default `false`).
- **Return value**: `IUseElementSizeReturn`: `{ width: number; height: number; measured: boolean }`, `0` by `0` with `measured` `false` until the first measure. Without a `ref` option the return is `IUseElementSizeRefReturn`, which adds `ref: React.RefCallback<Element>`; its identity never changes.
- **Gotcha**: The state changes once per animation frame, and not at all when the size is the same. `measured` tells an element measured at `0` by `0` from one not read yet. With the returned `ref`, the hook follows an element that mounts later, is replaced or is removed. With a `ref` object the element is read when the effect runs, so the hook follows a new `ref`, `box` or `round` (and starts again from `0` by `0` with `measured` `false`), not a `ref.current` replaced later. Pass a stable `ref`, as `useRef` gives. To test a component that uses it, see [`FakeResizeObserver`](./testing#test-a-resizeobserver). With `box: 'border-box'` a browser without `borderBoxSize` (Safari before 15.4) reports the content size. On a host with no `ResizeObserver` it stays at `0` by `0` and observes nothing. `useSizer` stays for an element found by id and reads `offsetWidth` and `offsetHeight`. Defined in `packages/react/src/hooks/use-element-size.ts`.

### useResizeEffect

```tsx
import React from 'react';
import { useResizeEffect } from '@venizia/ardor';

export function Toolbar() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setOverflowing] = React.useState(false);

  useResizeEffect({
    targets: [ref],
    onResize: () => {
      const element = ref.current;
      setOverflowing(element !== null && element.scrollWidth > element.clientWidth);
    },
  });

  return <div ref={ref}>{isOverflowing ? 'More...' : 'All'}</div>;
}
```

Use it for a check that runs when something resizes and keeps no size in state, such as an overflow test, the edges of a scroll area or a canvas fit. For the size itself, use `useElementSize`. Add `children: true` to run the callback when a direct child of the element resizes too:

```tsx
import React from 'react';
import { useResizeEffect } from '@venizia/ardor';

export function Tabs() {
  const ref = React.useRef<HTMLUListElement>(null);

  useResizeEffect({
    targets: [ref],
    children: true,
    onResize: (entries) => {
      console.log(entries.map((entry) => entry.target.tagName));
    },
  });

  return <ul ref={ref} />;
}
```

An element that mounts conditionally goes in as state, with the setter as its `ref`:

```tsx
import React from 'react';
import { useResizeEffect } from '@venizia/ardor';

export function Popover({ open }: { open: boolean }) {
  const [element, setElement] = React.useState<HTMLDivElement | null>(null);

  useResizeEffect({ targets: [element], onResize: () => console.log('resized') });

  return open ? <div ref={setElement} /> : null;
}
```

- **Parameters**: `opts: IUseResizeEffectOptions` - `targets: Array<React.RefObject<Element | null> | Element | null>` (an element, a ref to one, or `null`, which is skipped), `onResize: (entries: ResizeObserverEntry[]) => void`, optional `box`: `content-box` (default) or `border-box`, optional `children`: `true` also observes the direct children of each target (default `false`).
- **Return value**: `void`.
- **Gotcha**: One `ResizeObserver` watches all the elements, and `onResize` runs at most once per animation frame with the latest entry of each element that resized since the last call. The hook keeps the latest `onResize`, so a new function each render does not observe again. The targets are read after every render and the observer follows the set: a new element is observed, one that is gone is not, and an element that is already observed is left alone, so a list made anew in each render observes nothing again. Pass an element held in state (`useState` with the setter as `ref`) for one that mounts conditionally or is found by a query, or a ref whose `current` is read at each render; a `null` is skipped. A ref whose `current` changes without a render of this component is not seen until its next render. The first entries are delivered as the browser delivers them, so `onResize` runs once when observing starts. With `children`, a child added later is observed, and so delivers its first entry, and a removed child is not observed any more; a grandchild is never observed, and a `MutationObserver` exists only with `children`. Where there is no `ResizeObserver` the hook does nothing. To test a component that uses it, see [`FakeResizeObserver`](./testing#test-a-resizeobserver). Defined in `packages/react/src/hooks/use-resize-effect.ts`.

### useIntersection

```tsx
import React from 'react';
import { useIntersection } from '@venizia/ardor';

export function LoadMore({ onLoad }: { onLoad: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const entry = useIntersection({ target: ref, rootMargin: '200px' });

  React.useEffect(() => {
    if (entry?.isIntersecting) {
      onLoad();
    }
  }, [entry?.isIntersecting, onLoad]);

  return <div ref={ref} />;
}
```

Use it to know whether an element is in view: lazy content, a "load more" sentinel, a sticky header. A caller that wants only the boolean reads `entry?.isIntersecting`. An element that mounts conditionally goes in as state, as for `useResizeEffect`.

- **Parameters**: `opts: IUseIntersectionOptions` - `target: Element | React.RefObject<Element | null> | null` (read after every render; `null` observes nothing), optional `rootMargin` (default `'0px'`), optional `threshold`: one number from `0` to `1` (default `0`).
- **Return value**: the latest `IntersectionObserverEntry`, or `undefined`.
- **Gotcha**: The value is `undefined` before the first entry, where there is no `IntersectionObserver` (a server render), while `target` is `null`, and again right after a new element, `rootMargin` or `threshold` starts a new observation. The state changes only when `isIntersecting` or `intersectionRatio` changed, so the rectangles of the entry can be one delivery old. The viewport is the root: an app with a scrolling root passes `rootMargin`. There is no option for several thresholds or for one delivery only; for those write an `IntersectionObserver` of your own. Defined in `packages/react/src/hooks/use-intersection.ts`.

### useStoredState

```tsx
import { useStoredState } from '@venizia/ardor';

export function ThemeToggle() {
  const { value, setValue } = useStoredState({ key: '@app/store/theme', defaultValue: 'light' });

  return <button onClick={() => setValue(value === 'light' ? 'dark' : 'light')}>{value}</button>;
}
```

A value that changes many times a second, such as the width of a panel while the user drags its edge, writes the storage once with `writeDelayMs`:

```tsx
import { useStoredState } from '@venizia/ardor';

export function SidebarWidth() {
  const { value, setValue } = useStoredState({
    key: '@app/store/sidebar-width',
    defaultValue: 240,
    writeDelayMs: 200,
  });

  return <input type="range" min={160} max={480} value={value} onChange={(event) => setValue(event.target.valueAsNumber)} />;
}
```

- **Parameters**: `opts: IUseStoredStateOptions<TValue>` - `key` (used as it is: name it `@app/store/<name>`), `defaultValue`, optional `storage` (`local`, the default, or `session`), optional `codec` (JSON by default; [`StorageCodecs.text()`](./index#a-bare-string-as-the-stored-text) for a key whose data is a bare string), optional `writeDelayMs` (default `0`: write at once).
- **Return value**: `IUseStoredStateReturn<TValue>`: `value`, `setValue(next | updater)` and `remove()`.
- **Gotcha**: An updater passed to `setValue` runs against the value at the moment you call it (the stored one, or the one the hook keeps after a refused write), not the value of the last render, so several updaters in one tick compose like a functional `setState`. The one value the hook cannot see is a write it is not told about: after the storage refused a write, the hook keeps its own value, and an updater builds on that kept value, not on a raw `localStorage.setItem` made meanwhile that fired no event. A write through `BrowserStorage`, or a `storage` event from another tab, replaces the kept value. Hooks on the same key follow each other in one tab, code that writes through [`BrowserStorage`](./#browser-storage) reaches them, and a change in another tab arrives through the `storage` event. Where storage is missing or throws, `value` is `defaultValue`. A `setValue` or `remove` that the storage refuses (private mode, a full quota) is kept in the hook until the storage next changes, so the UI still reacts, but it is not stored and other hooks do not see it. With `writeDelayMs` above `0`, `value` changes at once and the storage is written once, that many milliseconds after the last `setValue`; the value waits in the hook in the meantime, the place a refused write is kept, so an updater builds on it and other hooks and tabs see it only after the write. `remove()` cancels the pending write, and so does any change of the storage from outside (a write through `BrowserStorage`, or a `storage` event from another tab): the later write wins. An unmount, or a new `key` or `storage`, writes the pending value at once, to the key it was set for. There is no `pagehide` handler: a tab closed inside the delay loses the last value. Two hooks on one key in a tab each keep their own timer, and the first write to land cancels the pending write of the other, so the earlier timer wins, not the last `setValue`; give a key one writer. Pass a stable `defaultValue` and `codec`. On a server the first render is `defaultValue`. Defined in `packages/react/src/hooks/use-stored-state.ts`.

**Sign out without a flash.** `remove()` and `setValue` tell every hook mounted on the key, in this tab, so a screen that is still mounted re-renders with `defaultValue` while you sign out. The browser tells the other tabs on its own, and no option can stop that. There is no `silent` option, because it would leave the hooks of this tab out of step with the storage. Instead:

- Remove the stored session keys after the protected tree has unmounted: navigate to the login page first, or unmount the tree, then remove the keys.
- Gate every effect that writes the store on the signed-in state. An effect that is still mounted when the keys go can write its defaults back, and the next sign-in starts from them.
- Or let a screen treat an absent value as "signing out" and render nothing.

### useWindowDimensions

```tsx
import { useWindowDimensions } from '@venizia/ardor';

export function ViewportInfo() {
  const { width, height } = useWindowDimensions();
  return <span>Viewport: {width}x{height}</span>;
}
```

- **Parameters**: None.
- **Return value**: `{ width: number; height: number }`.
- **Gotcha**: Reads `window.innerWidth` and `window.innerHeight` during initial state evaluation, and again once the effect runs. Where `window` is undefined (server-side rendering) the first render is `0` by `0`. Defined in `packages/react/src/hooks/use-window-dimensions.ts`.

### useMediaQuery

```tsx
import { useMediaQuery } from '@venizia/ardor';

export function Layout() {
  const isWide = useMediaQuery({ query: '(min-width: 768px)' });
  return <span>{isWide ? 'Wide' : 'Narrow'}</span>;
}
```

- **Parameters**: `opts: { query: string }`.
- **Return value**: `boolean`: whether the query matches now, and again after each change. A new `query` is read at once and the old one is no longer listened to.
- **Gotcha**: In a server render it is `false` and `window.matchMedia` is not called; the browser value arrives on the client render. Defined in `packages/react/src/hooks/use-media-query.ts`.

### useDocumentVisibility

```tsx
import { useDocumentVisibility } from '@venizia/ardor';

export function PauseWhenHidden() {
  const visibility = useDocumentVisibility();
  return <span>{visibility === 'visible' ? 'Live' : 'Paused'}</span>;
}
```

- **Parameters**: None.
- **Return value**: `'visible' | 'hidden'`, the value of `document.visibilityState`, kept by the `visibilitychange` event.
- **Gotcha**: In a server render it is `'visible'` and the document is not read. Defined in `packages/react/src/hooks/use-document-visibility.ts`.

### useOnlineStatus

```tsx
import { useOnlineStatus } from '@venizia/ardor';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  return isOnline ? null : <p>You are offline.</p>;
}
```

- **Parameters**: None.
- **Return value**: `boolean`: `navigator.onLine`, kept by the `online` and `offline` events.
- **Gotcha**: `navigator.onLine` says whether the browser has a network connection, not whether your server answers. In a server render it is `true` and `navigator` is not read. Defined in `packages/react/src/hooks/use-online-status.ts`.

## Related

- [Application](./application)
- [Binding keys](./binding-keys)
- [Data provider](./data-provider)
- [Module augmentation](../best-practices/module-augmentation)
