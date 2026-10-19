---
title: Hooks
description: Reference for every React hook exported by ARDOR, covering container access, Redux utilities, ra-core companions, and browser helpers.
---

# Hooks

ARDOR provides hooks to interact with the dependency injection container, Redux state, react-admin contexts, and browser APIs. All hooks are exported from `@venizia/ardor`.

```tsx
import { service, useService } from '@venizia/ardor';

@service()
class NotificationService {
  notify(message: string) {
    return message;
  }
}

export function StatusWidget() {
  const notifications = useService({ target: NotificationService });
  return <span>{notifications.notify('Ready')}</span>;
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

These hooks resolve dependencies and services registered in the IGNIS inversion-of-control container.

### useApplicationContext

Returns the `Container` instance stored in the current `ApplicationContext`.

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

Returns the active `Container`, accepting an optional container override in its options.

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

Resolves a bound instance from the container by binding key or decorated target class.

```tsx
import { CoreBindings, type DefaultRestDataProvider, useInjectable } from '@venizia/ardor';

export function TenantHeaderButton() {
  const dataProvider = useInjectable<DefaultRestDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });

  const handleClick = () => {
    dataProvider.getNetworkService().setHeaders({ headers: { 'x-tenant': 'acme' } });
  };

  return <button onClick={handleClick}>Use tenant acme</button>;
}
```

```tsx
import { service, useInjectable } from '@venizia/ardor';

@service()
class PricingService {
  getDiscount() {
    return 0.1;
  }
}

export function PricingWidget() {
  const pricing = useInjectable<PricingService>({ target: PricingService });
  return <span>Discount: {pricing.getDiscount()}</span>;
}
```

- **Parameters**: `opts: TUseInjectableOptions` - `{ key: TUseInjectableKeys; container?: Container }` or `{ target: TClass<AnyType>; container?: Container }`.
- **Return value**: The resolved instance `TInstance`.
- **Gotcha**: When resolving by `{ target }`, the class must have a registered binding key recorded by a stereotype decorator (`@service()`, `@repository()`, etc.) or registration helper; resolving an undecorated class throws an error. If code minifiers rename classes, keys derived from `<namespace>.<ClassName>` change unless pinned with `binding: { namespace, key }` on the class or resolved by `{ target }`. Defined in `packages/react/src/hooks/use-injectable.ts`.

### useService

Resolves a service from the container, verifying that the target class belongs to the `services` namespace.

```tsx
import { service, useService } from '@venizia/ardor';

@service()
class OrderService {
  calculateTotal(subtotal: number, tax: number) {
    return subtotal + tax;
  }
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

Resolves a repository from the container, verifying that the target class belongs to the `repositories` namespace.

```tsx
import { repository, useRepository } from '@venizia/ardor';

@repository()
class ProductRepository {
  findStock(productId: string) {
    return productId ? 42 : 0;
  }
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

Resolves a provider from the container. Resolving by `{ key }` is not namespace-checked; passing a `{ target }` verifies that the target class belongs to the `providers` namespace.

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

Resolves a component from the container, verifying that the target class belongs to the `components` namespace.

```tsx
import { component, useComponent } from '@venizia/ardor';

@component()
class BannerComponent {
  getLabel() {
    return 'Dashboard';
  }
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

Resolves a configuration instance from the container, verifying that the target class belongs to the `configurations` namespace.

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

Returns the `Logger` instance stored in the current `ApplicationContext`.

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

Two factories generate type-safe React Redux hooks tailored to the store state and dispatch types. Both require a Redux `Provider` in the React tree.

### createAppDispatch

Builds typed `useAppDispatch` and `useMultipleAppDispatch` hooks for a Redux store.

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
- **Return value**: An object containing:
  - `useAppDispatch`: Typed `useDispatch` hook returning `TDispatch`.
  - `useMultipleAppDispatch`: Returns a callback `(...actions: Parameters<TDispatch>[0][]) => void` that dispatches each non-falsy action in sequential order.
- **Gotcha**: Requires a react-redux `Provider` in the tree. Falsy action arguments passed to `useMultipleAppDispatch` are skipped. Defined in `packages/react/src/hooks/redux/use-app-dispatch.ts`.

### createAppSelectors

Builds typed `useAppSelector`, `useShallowEqualSelector`, and `useDeepEqualSelector` hooks for Redux state.

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
- **Return value**: An object containing:
  - `useAppSelector`: Typed `useSelector` hook with optional custom equality comparator.
  - `useShallowEqualSelector`: Uses react-redux `shallowEqual` comparator.
  - `useDeepEqualSelector`: Uses lodash `isEqual` comparator.
- **Gotcha**: Requires a react-redux `Provider` in the tree. Defined in `packages/react/src/hooks/redux/use-app-selector.ts`.

## ra-core companions

These hooks integrate with react-admin contexts and data provider infrastructure.

### useTranslate

Returns a type-safe translation function for localized message keys.

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

Returns a callback that refreshes the authentication session via the auth provider and invalidates the permissions cache.

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

Converts an `ApplicationError` into a react-admin notification toast with normalized error code and arguments.

```tsx
import { useNotifyError } from '@venizia/ardor';

type TNotifyError = ReturnType<typeof useNotifyError>;
type TAppError = Parameters<TNotifyError>[0];

export function DeleteAction(props: { onDelete: () => Promise<void> }) {
  const notifyError = useNotifyError();

  const handleClick = () => {
    props.onDelete().catch((error: TAppError) => {
      notifyError(error);
    });
  };

  return <button onClick={handleClick}>Delete</button>;
}
```

- **Parameters**: None. The returned callback accepts `(error: ApplicationError, options?: NotificationOptions & { type?: NotificationType }) => void`.
- **Return value**: Notification callback function.
- **Gotcha**: Reads `error.normalized?.code` as the translation key and `error.normalized?.args` as `messageArgs`. Passing an error without a `normalized` property results in an `undefined` notification message. Defined in `packages/admin/src/hooks/use-notify-error.ts`.

### useRequestHeaderLocale

Synchronizes the active react-admin locale with an HTTP request header on the default REST data provider.

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

Returns the list of registered features mounted on the application container.

```tsx
import { useFeatures } from '@venizia/ardor';

export function FeatureNavigation() {
  const features = useFeatures();

  return (
    <nav>
      {features.map((feature) => (
        <span key={feature.name}>{feature.name}</span>
      ))}
    </nav>
  );
}
```

- **Parameters**: None. Accepts type parameter `TItem extends TFeature = TFeature`.
- **Return value**: `Array<TItem>` (typed `Array<TFeature>` by default).
- **Gotcha**: Reads from the container using `useInjectableContainer()`, throwing if called outside `ApplicationContext`. Returns an empty array `[]` if no features were mounted. Defined in `packages/admin/src/hooks/use-features.ts`.

### useDocumentTitle

Sets the browser tab title from title segments and `appTitle`, restoring the previous title on unmount.

```tsx
import { useDocumentTitle } from '@venizia/ardor';

export function OrderPage(props: { orderNumber?: string }) {
  useDocumentTitle({
    title: [props.orderNumber && `Order #${props.orderNumber}`, 'Orders'],
    appTitle: 'Back Office',
    separator: ' · ',
    enabled: true,
  });
  return null;
}
```

- **Parameters**: `opts: IUseDocumentTitleOptions`:
  - `title`: `string | false | null | undefined` or an array of segments.
  - `appTitle`: Application title suffix string.
  - `separator`: Optional string joining segments (default `' · '`).
  - `enabled`: Optional boolean to enable title management (default `true`).
- **Return value**: `void`.
- **Gotcha**: Restores the previous title on cleanup only if `document.title` still equals what this hook set; an update from a later writer is left in place. Child effects run before parent effects, so calling `useDocumentTitle` in a parent component overwrites a title set in a child component. Defined in `packages/admin/src/hooks/use-document-title.ts`.

### useHtmlLang

Synchronizes the `<html lang>` document attribute with the active react-admin locale.

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

These hooks wrap browser APIs and common user interface patterns.

### useDebounce

Delays updating a value until after a specified interval has elapsed since the last change.

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

- **Parameters**: `opts: IUseDebounceOptions<TValue>`:
  - `value`: The value to debounce (`TValue`).
  - `delay`: Optional delay in milliseconds (default `App.DEFAULT_DEBOUNCE_TIME` = 500 ms).
  - `enabled`: Optional boolean to enable debouncing (default `true`).
- **Return value**: `IUseDebounceReturn<TValue>` containing `{ debouncedValue: TValue }`.
- **Gotcha**: When `enabled` is `false` or outside the browser (`!isBrowser()`), the timer does not run and `debouncedValue` retains its initial value. Defined in `packages/react/src/hooks/use-debounce.ts`.

### useAutosave

Automatically invokes a save function when data remains stable for a specified interval or upon unmount.

```tsx
import React from 'react';
import { useAutosave } from '@venizia/ardor';

export function NotePad(props: { onSave: (text: string) => Promise<void> }) {
  const [text, setText] = React.useState('');

  useAutosave({
    data: text,
    onSave: props.onSave,
    interval: 2000,
    enableSaveOnUnmount: true,
  });

  return <textarea value={text} onChange={(e) => setText(e.target.value)} />;
}
```

- **Parameters**: `opts: IUseAutosaveOptions<TData, TReturn>`:
  - `data`: Data payload to monitor (`TData`).
  - `onSave`: Callback `(data: TData) => Promise<TReturn> | TReturn | void`.
  - `interval`: Optional debounce interval in milliseconds (default `2000`).
  - `enableSaveOnUnmount`: Optional boolean to trigger save on component unmount.
  - `enabled`: Optional boolean to enable autosave (default `true`).
- **Return value**: `void`.
- **Gotcha**: The initial render is skipped. Rejections from `onSave` are logged via `console.error` and swallowed without propagating. Defined in `packages/react/src/hooks/use-autosave.ts`.

### useConfirm

Provides a Promise-based confirmation workflow with dialog message state and resolution callbacks.

```tsx
import { useConfirm } from '@venizia/ardor';

export function DeleteConfirmation(props: { onDelete: () => Promise<void> }) {
  const { message, confirm, handleConfirm, handleAbort } = useConfirm();

  const handleClick = async () => {
    const ok = await confirm({ message: 'Delete this item?' });
    if (ok) {
      await props.onDelete();
    }
  };

  return (
    <div>
      <button onClick={handleClick}>Delete</button>
      {message && (
        <div>
          <span>{message}</span>
          <button onClick={handleConfirm}>Confirm</button>
          <button onClick={handleAbort}>Cancel</button>
        </div>
      )}
    </div>
  );
}
```

- **Parameters**: None.
- **Return value**: `IUseConfirmReturn`:
  - `message?: string`: The message text passed to `confirm`, or undefined when closed.
  - `confirm: (opts: { message: string }) => Promise<boolean>`: Initiates confirmation and returns a Promise.
  - `handleClose: () => void`: Clears dialog state without resolving the active Promise.
  - `handleConfirm: () => void`: Resolves the active Promise with `true` and clears state.
  - `handleAbort: () => void`: Resolves the active Promise with `false` and clears state.
- **Gotcha**: `handleConfirm` resolves `true`, `handleAbort` resolves `false`, `handleClose` clears the state without resolving. Calling `confirm` again while a prior confirmation is pending replaces the internal resolver, leaving the previous Promise unresolved. Defined in `packages/react/src/hooks/use-confirm.ts`.

### useCopyToClipboard

Copies text to the system clipboard using the browser Clipboard API.

```tsx
import React from 'react';
import { useCopyToClipboard } from '@venizia/ardor';

export function CopyShareLink(props: { url: string }) {
  const { copy } = useCopyToClipboard();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const ok = await copy({ value: props.url });
    setCopied(ok);
  };

  return <button onClick={handleCopy}>{copied ? 'Copied' : 'Share'}</button>;
}
```

- **Parameters**: None. Returned `copy` callback takes `{ value: string }`.
- **Return value**: `IUseCopyToClipboardReturn`: `{ copy: (opts: { value: string }) => Promise<boolean> }`.
- **Gotcha**: Resolves to `false` and outputs `console.warn` if `navigator?.clipboard` is missing (such as non-HTTPS environments) or if the clipboard write operation fails. Defined in `packages/react/src/hooks/use-copy-to-clipboard.ts`.

### useBeforeUnload

Registers a `beforeunload` window event listener to warn users of unsaved changes before page unload.

```tsx
import React from 'react';
import { useBeforeUnload } from '@venizia/ardor';

export function EditFormGuard() {
  const [dirty, setDirty] = React.useState(false);

  useBeforeUnload({
    enabled: dirty,
    message: 'You have unsaved changes.',
  });

  return <input onChange={() => setDirty(true)} />;
}
```

- **Parameters**: `opts: IUseBeforeUnloadOptions`:
  - `enabled`: Optional boolean to enable beforeunload interception (default `true`).
  - `message`: Optional confirmation message string.
- **Return value**: `void`.
- **Gotcha**: Modern browsers display a generic browser-defined confirmation prompt rather than custom `message` text, but assigning `message` populates `event.returnValue` as required by the specification. Defined in `packages/react/src/hooks/use-before-unload.ts`.

### useSizer

Observes DOM element size changes using `ResizeObserver` by element ID.

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

- **Parameters**: `opts: IUseSizerOptions`:
  - `containerId`: String DOM ID of the container element.
- **Return value**: `IUseSizerReturn`: `{ width: number; height: number }`.
- **Gotcha**: Reported width is `clientWidth + 1` and reported height is `offsetHeight + 1`. Returns `0` for both dimensions until the target element exists in the DOM. The observer effect depends only on `containerId`, so passing an inline `{ containerId: '...' }` object does not cause re-subscription. Defined in `packages/react/src/hooks/use-sizer.ts`.

### useWindowDimensions

Returns the browser window inner dimensions, updating on window resize events.

```tsx
import { useWindowDimensions } from '@venizia/ardor';

export function ViewportInfo() {
  const { width, height } = useWindowDimensions();
  return <span>Viewport: {width}x{height}</span>;
}
```

- **Parameters**: None.
- **Return value**: `{ width: number; height: number }`.
- **Gotcha**: Reads `window.innerWidth` and `window.innerHeight` synchronously during initial state evaluation. Throws a `ReferenceError` during server-side rendering (SSR) if `window` is undefined. Defined in `packages/react/src/hooks/use-window-dimensions.ts`.

## Related

- [Application](./application)
- [Binding keys](./binding-keys)
- [Data provider](./data-provider)
- [Auth provider](./auth-provider)
- [i18n](./i18n)
- [Features](./features)
- [Network](./network)
- [Repository](./repository)
- [Types](./types)
- [Module augmentation](../best-practices/module-augmentation)
- [Auth recovery](../best-practices/auth-recovery)
- [5-minute quickstart](../guides/get-started/5-minute-quickstart)
- [Migration from ra-core-infra](../guides/migrations/from-ra-core-infra)
