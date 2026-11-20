---
type: Concept
title: Module augmentation
description: How ARDOR types translation keys through TypeScript module augmentation, how binding keys carry their own type instead, and the traps that make augmentation silently fail.
resource: packages/react/src/hooks/use-injectable.ts
tags: [architecture, typescript, module-augmentation, useInjectable, useTranslate, di]
---

# Module augmentation

`IUseTranslateKeysOverrides` is the one augmentation point an application uses. `useTranslate` does not accept arbitrary strings: it takes a union of dotted paths built from the default English messages plus whatever an application merges in. A translation key that is not declared fails at compile time, and that failure is the point, not a bug.

Binding keys need no augmentation. A key carries the type of its value (`BindingKeys.build<T>`), so `useInjectable({ key })` returns `T` and a string that is not a key does not compile.

## Why translation keys are typed

`TUseTranslateKeysDefault` is the dotted-path union produced by `TFullPaths` over the default messages object. `TUseTranslateKeys` unions it with `keyof IUseTranslateKeysOverrides`.

Only the `keyof` of the override interface matters - property values are ignored, so the convention is to type them all as `true`. This gives applications compile-time protection against typo'd keys instead of accepting any string silently.

## Binding keys carry their type

`BindingKeys.build<T>({ namespace?, key })` (from `@venizia/ignis-inversion`, re-exported by `@venizia/ardor`) makes a `TBindingKey<T>`. The hooks take `{ key: TBindingKey<TValue> }` and return `TValue` with no generic. A plain string, template literal or symbol is not a key and does not compile. A generic written next to a key must be a subtype or supertype of the key's type. `TBindingKeyValue<typeof key>` names `T`. `@inject({ key })` is not checked against the decorated parameter.

`CoreBindings` is built this way (`packages/kernel/src/common/keys.ts`). Four of its keys have their value types in `@venizia/ardor-admin`, which the kernel cannot import: `DEFAULT_REST_DATA_PROVIDER`, `DEFAULT_AUTH_PROVIDER`, `DEFAULT_I18N_PROVIDER` and `I18N_PROVIDER_OPTIONS`. The kernel declares them as `TCoreBindingType<'restDataProvider' | 'authProvider' | 'i18nProvider' | 'i18nProviderOptions'>`, which is `unknown` in the kernel alone. `@venizia/ardor-admin` merges `IDataProvider`, `IAuthProvider`, `I18nProvider` and `II18nProviderOptions` into the kernel interface `ICoreBindingTypes` with `declare module '@venizia/ardor-kernel'` (`packages/admin/src/common/types.ts`). An application that imports `@venizia/ardor` or `@venizia/ardor-admin` reads the real types with no augmentation of its own.

An application's own keys need nothing: build each with `BindingKeys.build<T>` and the type travels with the key. A class needs no key at all; it resolves by `{ target }`.

## The per-stereotype hooks

`useService`, `useRepository`, `useProvider`, `useComponent` and `useConfiguration` take the same `{ key: TBindingKey<TValue> }` form as `useInjectable` and return `TValue`. The `{ target }` form of every one of them resolves through the binding key recorded on the class, by a stereotype or by registration by hand, so no key is involved.

## The owning package

`IUseTranslateKeysOverrides` is declared in the [Admin package](/packages/admin.md) and re-exported from the [ARDOR umbrella package](/packages/ardor.md) with `export *`. An application augments the umbrella: `declare module '@venizia/ardor'` merges into the declaring interface.

## Why the umbrella is the module to augment

TypeScript merges interface declarations by module identity, and it follows an `export *` chain to the module that declares the interface. `@venizia/ardor` re-exports `@venizia/ardor-admin` with `export *`, so a `declare module '@venizia/ardor'` block merges into the real `IUseTranslateKeysOverrides`. Measured on a registry-only app (`@venizia/ardor@0.1.4-5`, TypeScript 6, Bun 1.4.3) under both linkers: the umbrella block merges, a declared key is accepted and an undeclared one rejected (issue #98).

The declaring package is the fragile target. An application depends on `@venizia/ardor` alone, so under a linker that does not hoist (Bun's `isolated` linker, pnpm) `@venizia/ardor-admin` is not resolvable from it. `declare module '@venizia/ardor-admin'` then fails with `TS2664 Invalid module name in augmentation, module cannot be found`, and the keys are missing; under a hoisting linker the same block compiles, which hides the problem. A declaring package works only when the application lists it as its own dependency. The rule: augment `@venizia/ardor`.

`examples/5-mins-qs/src/augmentation.check.ts` holds the type-level check. It is never imported; the example's `typecheck` fails if the claim stops holding.

## The any-widening footgun

Applications are expected to derive their translation keys from something real - a message object - rather than typing literals by hand twice. This has a sharp edge: if the type being derived from resolves to `any` (a broken import path, a stale build, a class that failed to compile), then `keyof` of it collapses to `string`. The override interface silently widens to accept every string as a valid key. All the compile-time protection disappears without any warning - the code still compiles, it just no longer catches typos. This is the most dangerous failure mode of the mechanism, because nothing looks wrong until a real typo makes it into production.

## Where the augmentation lives

Augmentation should live in one place per application - either the file that constructs the application, or a dedicated ambient declaration file included by the TypeScript config - so it isn't scattered and forgotten.

## Verifying with @ts-expect-error

Because a broken augmentation looks identical to a working one until someone mistypes a key, the only reliable proof is a compile-time check. Place a `// @ts-expect-error` directive immediately above a call that uses a key which is deliberately not declared. If the augmentation is working, that line is a real type error and the directive is satisfied. If the augmentation silently failed - wrong target module, `any`-widening, a declaration file outside the build's `include`, or a non-module `.d.ts` with no top-level `import`/`export` - the directive itself becomes an "unused ts-expect-error" error, which is the signal that something is wrong. Editor tooltips are not sufficient for this check since editors sometimes resolve declaration files that the actual build does not include; only running the real build proves the augmentation took effect.

## Related

See [DI in the browser](/architecture/di-in-the-browser.md) for how bindings and keys are registered at runtime, and [Binding key namespaces](/conventions/binding-key-namespaces.md) for how to name the keys.
