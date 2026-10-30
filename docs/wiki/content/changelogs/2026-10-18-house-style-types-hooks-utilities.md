---
title: Types, hooks and utilities follow IGNIS house style
description: Kernel utilities take one options object, React hooks take opts with an enabled flag, and features are defined through Features.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## Types, hooks and utilities follow IGNIS house style

<Badge type="warning" text="Behavior Change" />

**In one line.** Utilities take one options object, hooks take `opts` with an `enabled` flag, and a feature is defined with `Features.define`:

```typescript
import { Features, isNumber, useDebounce } from '@venizia/ardor';

// Was: defineFeature({ name: 'orders' })
export const ordersFeature = Features.define({ name: 'orders' });

// Was: isNumber(input)
export const isPageSize = isNumber({ value: '1000' });

// Was: useDebounce({ value: search, disabled: !ready })
export const useSearchTerm = (opts: { search: string; ready: boolean }) => {
  const { debouncedValue } = useDebounce({ value: opts.search, enabled: opts.ready });
  return debouncedValue;
};
```

Notice the flag flips: `disabled: x` becomes `enabled: !x`, and `enabled` defaults to `true`.

## What changed

### Kernel (`@venizia/ardor-kernel`)

| Old | New |
|---|---|
| `HeaderConsts` | `HeaderConstants` |
| `ClassProps`, `ClassType`, `TStatusFromClass` | removed: `TClass` from `@venizia/ignis-inversion`, and `TStringConstValue` / `TConstValue` (`TRequestMethod`, `TEnvironment` keep their names) |
| `Authentication`, `RequestChannel`, `RequestCountData`, `LocalStorageKeys` | each gains `SCHEME_SET` and `static isValid(value: string): boolean` (additive); the `isValid` parameter of the other const classes is renamed `input` -> `value` |
| `TLogLevel = 'debug' \| ...` | `LogLevels` const class (`DEBUG`, `INFO`, `WARN`, `ERROR`, `SCHEME_SET`, `isValid`), `TLogLevel = TConstValue<typeof LogLevels>` |
| `BaseService` a copy of `BaseHelper` | `BaseService extends BaseHelper` |
| `new Logger({ scope, enableDebug })`, `logger.toggleDebug({ state })` | `new Logger({ scope })`; the one way to set debug is `Logger.getInstance({ scope, enableDebug })` (process-wide, as before); `toggleDebug` removed |
| `SocketIOClientHelper.unsubscribe({ events })` removed only by event name and leaked wrappers | `unsubscribe({ events, handler? })` removes one handler; subscribing the same handler twice no longer duplicates the listener; `TSocketIOEventHandler` exported |
| `isNumber(value, exact?)` | `isNumber({ value })` (the loose reading, as before); the exact reading is `typeof value === 'number'` |
| `isObject(value)`, `isValidDate(value)`, `isEditableTarget(target)` | `isObject({ value })`, `isValidDate({ value })`, `isEditableTarget({ target })` |
| `int(input)`, `float(input, digit)` | `toInteger({ value })`, `toFloat({ value, digits })` |
| `isInt(n)`, `isFloat(n)` | `isInteger({ value })`, `isFloat({ value })` |
| `toBoolean(input)` | `toBoolean({ value })` |
| `toStringDecimal(input, digit, { localeFormat })` | `toStringDecimal({ value, digits, localeFormat })` |
| `getNumberValue(input, 'int' \| 'float')` | `getNumberValue({ input, method })` with `NumberParseMethods.INT` / `NumberParseMethods.FLOAT` (new const class, `TNumberParseMethod`) |
| `toCamel(s)`, `keysToCamel(object)` | `toCamelCase({ value })`, `keysToCamelCase({ value })` |
| `getUID()` | `generateUniqueId()` |
| `INTL_0_DIGITS_FORMATER`, `INTL_2_DIGITS_FORMATER` | `INTL_0_DIGITS_FORMATTER`, `INTL_2_DIGITS_FORMATTER` |
| `blobToBase64(blob)` | `toDataUrl({ blob })` |
| `stringify(params)`, `parse(search)` | `toQueryString({ params })`, `parseQueryString({ search })` |

### React (`@venizia/ardor-react`)

| Old | New |
|---|---|
| `SyncFC<P>` | `ISyncFC<TProps>` |
| `IUseDebounceParams`, `IUseAutosaveParams`, `IUseBeforeUnloadParams` | `IUseDebounceOptions`, `IUseAutosaveOptions`, `IUseBeforeUnloadOptions`; the argument is `opts` |
| `disabled?: boolean` (`useDebounce`, `useAutosave`) | `enabled?: boolean`, default `true` (IGNIS names state flags `enabled`); invert the value |
| `useBeforeUnload({ enabled: boolean \| () => boolean })` | `useBeforeUnload({ enabled?: boolean, message? })`, default `true`; pass the boolean, not a function |
| `useSizer(props)` | `useSizer(opts: IUseSizerOptions): IUseSizerReturn` (both exported); the observer is keyed on `containerId` |
| `ApplicationContext` value `{ container, registry, logger }` | `IApplicationContextValue { container, logger }` (exported); `registry` was the same container as `container`, drop it |
| generics `D`, `S`, `T` in `createAppDispatch`, `createAppSelectors`, `useInjectable`, `useArtifact` | `TDispatch`, `TState`, `TSelected`, `TInstance` (type-level only) |

### Admin (`@venizia/ardor-admin`)

| Old | New |
|---|---|
| `IFeature` (a `type`) | `TFeature` |
| `defineFeature(feature)` | `Features.define(feature)`; `Features` also exposes `Features.read({ container })` and `Features.mount({ features, resources, routes })` (public now, additive) |
| `useFeatures<TFeature extends IFeature>()` | `useFeatures<TItem extends TFeature>()` |
| `IApplication.customRoutes: { routes }` | `IApplication.routes` (the same name as `TFeature.routes`) |
| `II18nProviderOptions.listLanguages` | `II18nProviderOptions.languages` |

`isDefined`, `isString` and `isBrowser` keep their signatures.

## Who is affected

- **An application that calls a renamed utility or hook.** Rename it with the tables; the compiler lists every call site.
- **An application that passes `disabled` to `useDebounce` or `useAutosave`.** Pass `enabled` with the inverted value. TypeScript does not catch a missed inversion.
- **An application that passed `enableDebug` to `new Logger`.** Call `Logger.getInstance({ scope, enableDebug })` instead.
- **An application with `customRoutes` or `listLanguages`.** Move the value to `routes` or `languages`.
- **An application that builds the `ApplicationContext` value by hand**, in a provider or a test wrapper. Drop `registry`: it held the same container as `container`, and an object literal that keeps it no longer type-checks.
- **An application that types a component with `SyncFC`.** Rename it to `ISyncFC`.
