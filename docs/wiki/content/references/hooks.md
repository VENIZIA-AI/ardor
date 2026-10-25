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

## Which hook do I need?

| I want to... | Hook | Needs in the tree | Returns |
| --- | --- | --- | --- |
| Access the IoC container from context | `useApplicationContext` | `ApplicationContext` with a container | `Container` |
| Access the container with an optional override | `useInjectableContainer` | `ApplicationContext` with a container, or explicit option | `Container` |
| Resolve a bound dependency by key or class | `useInjectable` | `ApplicationContext` with a container, or explicit option | Bound instance |
| Resolve a service from the `services` namespace | `useService` | `ApplicationContext` with a container, or explicit option | Bound service instance |
| Resolve a repository from the `repositories` namespace | `useRepository` | `ApplicationContext` with a container, or explicit option | Bound repository instance |
| Resolve a provider from the `providers` namespace | `useProvider` | `ApplicationContext` with a container, or explicit option | Bound provider instance |
| Resolve a component from the `components` namespace | `useComponent` | `ApplicationContext` with a container, or explicit option | Bound component instance |
| Resolve a configuration class from the `configurations` namespace | `useConfiguration` | `ApplicationContext` with a container, or explicit option | Bound configuration instance |
| Access the application logger from context | `useApplicationLogger` | `ApplicationContext` with a logger | `Logger` |
| Build typed dispatch hooks for a Redux store | `createAppDispatch` | react-redux `Provider` | `{ useAppDispatch, useMultipleAppDispatch }` |
| Build typed selector hooks for Redux state | `createAppSelectors` | react-redux `Provider` | `{ useAppSelector, useShallowEqualSelector, useDeepEqualSelector }` |
| Translate message keys with the active i18n provider | `useTranslate` | ra-core i18n context (optional; falls back to identity) | Translation function |
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
| Track window inner dimensions on resize | `useWindowDimensions` | Browser window | `{ width, height }` |

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

### useInjectableContainer

```tsx
import { useInjectableContainer } from '@venizia/ardor';

export function ContainerChecker() {
  const container = useInjectableContainer();
  return <span>{container ? 'container ready' : 'no container'}</span>;
}
```

- **Parameters**: Optional `opts?: { container?: Container }`.
- **Return value**: `Container`.
- **Gotcha**: Throws an error (`[useInjectable] Failed to determine injectable container!`) if neither `opts.container` nor `ApplicationContext.container` is available. Defined in `packages/react/src/hooks/use-injectable.ts`.

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
- **Return value**: `Logger`.
- **Gotcha**: Throws an error (`[useApplicationLogger] must be used within a ApplicationContextProvider`) if called when no logger is mounted on `ApplicationContext`. Defined in `packages/react/src/hooks/use-application-context.ts`.

## Redux

### createAppDispatch

```ts
import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { createAppDispatch } from '@venizia/ardor';

type AppDispatch = Dispatch<UnknownAction>;

export const { useAppDispatch, useMultipleAppDispatch } = createAppDispatch<AppDispatch>();

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

### createAppSelectors

```ts
import { createAppSelectors } from '@venizia/ardor';

interface RootState {
  user: { name: string };
  settings: { theme: string };
}

export const { useAppSelector, useShallowEqualSelector, useDeepEqualSelector } =
  createAppSelectors<RootState>();

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
- **Return value**: `TUseTranslateFn` (`(key: TUseTranslateKeys, options?: AnyType) => string`) when an i18n provider is present, or a fallback identity function `(key: AnyType) => AnyType`.
- **Gotcha**: Returns an identity function when no i18n provider is mounted in the tree, returning the key unchanged rather than throwing. Keys can be extended by augmenting `IUseTranslateKeysOverrides` (see [Module augmentation](../best-practices/module-augmentation)). Defined in `packages/admin/src/hooks/use-translate.ts`.

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
- **Gotcha**: Reads from the container using `useInjectableContainer()`, throwing if called outside `ApplicationContext`. Returns an empty array `[]` if no features were mounted. Defined in `packages/admin/src/hooks/use-features.ts`.

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

- **Parameters**: `opts: IUseDocumentTitleOptions` - `title`, `appTitle`, optional `separator` (default `' · '`), optional `enabled` (default `true`).
- **Return value**: `void`.
- **Gotcha**: Restores the previous title on cleanup only if `document.title` still equals what this hook set; an update from a later writer is left in place. Child effects run before parent effects, so calling `useDocumentTitle` in a parent component overwrites a title set in a child component. Defined in `packages/admin/src/hooks/use-document-title.ts`.

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
- **Gotcha**: When `enabled` is `false` or outside the browser (`!isBrowser()`), the timer does not run and `debouncedValue` retains its initial value. Defined in `packages/react/src/hooks/use-debounce.ts`.

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
- **Gotcha**: The initial render is skipped. Rejections from `onSave` are logged through the application logger (`Logger`, scope `useAutosave`) and swallowed without propagating. Defined in `packages/react/src/hooks/use-autosave.ts`.

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
- **Gotcha**: Resolves to `false` and logs a warning through the application logger (`Logger`, scope `useCopyToClipboard`) if `navigator?.clipboard` is missing (such as non-HTTPS environments) or if the clipboard write operation fails. Defined in `packages/react/src/hooks/use-copy-to-clipboard.ts`.

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

## Related

- [Application](./application)
- [Binding keys](./binding-keys)
- [Data provider](./data-provider)
- [Module augmentation](../best-practices/module-augmentation)
