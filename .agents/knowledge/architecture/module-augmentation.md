---
type: Concept
title: Module augmentation
description: How ARDOR types the keys accepted by useInjectable and useTranslate through TypeScript module augmentation, and the traps that make it silently fail.
resource: packages/react/src/hooks/use-injectable.ts
tags: [architecture, typescript, module-augmentation, useInjectable, useTranslate, di]
---

# Module augmentation

`useInjectable` and `useTranslate` do not accept arbitrary strings. Each takes a union of string literals built from a default set plus whatever an application merges in through TypeScript's module augmentation. This is why registering a binding or a translation key and then reaching for it in a hook can fail at compile time until the key is declared - that failure is the point, not a bug.

## Why keys are typed

Both hooks follow the same pattern: a default union derived from something real (the core bindings, the default English messages) unioned with `keyof` of an empty override interface.

- `TUseInjectableKeysDefault` is the string values of `CoreBindings`.
- `TUseInjectableKeys` is `TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides`.
- `TUseTranslateKeysDefault` is the dotted-path union produced by `TFullPaths` over the default messages object.
- `TUseTranslateKeys` follows the same union-with-overrides shape.

Only the `keyof` of the override interface matters - property values are ignored, so the convention is to type them all as `true`. This gives applications compile-time protection against typo'd keys instead of accepting any string silently.

## The two override interfaces and their owning packages

- `IUseInjectableKeysOverrides` is declared in the [React package](/packages/react.md).
- `IUseTranslateKeysOverrides` is declared in the [Admin package](/packages/admin.md).

Both are re-exported from the [ARDOR umbrella package](/packages/ardor.md), but re-export is not declaration. To extend either interface you must target the package that owns it, even though the rest of your application code imports types and helpers from the umbrella.

## Why the umbrella cannot be augmented

TypeScript merges interface declarations by module identity, not by re-export chain. A `declare module '@venizia/ardor-package-name'` block only merges with an interface declared in that exact module specifier. Writing `declare module` against the umbrella package creates a brand-new, unrelated interface that happens to share a name - it compiles cleanly and does nothing. `TUseInjectableKeys` and `TUseTranslateKeys` never see the added keys, and the hooks keep rejecting them. The rule: always augment the declaring package (react for injectable keys, admin for translate keys), never the umbrella re-export.

## The any-widening footgun

Applications are expected to derive their key unions from something real - a `const` bindings map, an application's `bindingList()` method, or a message object - rather than typing literals by hand twice. This is efficient, but it has a sharp edge: if the type being derived from resolves to `any` (a broken import path, a stale build, a class that failed to compile), then `keyof ReturnType<any>` collapses to `string`. The override interface silently widens to accept every string as a valid key. All the compile-time protection the augmentation exists to provide disappears without any warning - the code still compiles, it just no longer catches typos. This is the single most dangerous failure mode of the whole mechanism, because nothing looks wrong until a real typo makes it into production.

## Retargeting legacy augmentation blocks

Code that predates this pattern, or that was written against the umbrella package by mistake, needs its `declare module` targets rewritten from the umbrella specifier to the owning package specifier - injectable overrides move to react's module, translate overrides move to admin's module. This retargeting is mechanical: the interface body and the derived key type stay the same, only the string after `declare module` changes. After retargeting, augmentation should live in one place per application - either the file that constructs the application, or a dedicated ambient declaration file included by the TypeScript config - so it isn't scattered and forgotten.

## Verifying with @ts-expect-error

Because a broken augmentation looks identical to a working one until someone mistypes a key, the only reliable proof is a compile-time check. Place a `// @ts-expect-error` directive immediately above a call that uses a key which is deliberately not declared. If the augmentation is working, that line is a real type error and the directive is satisfied. If the augmentation silently failed - wrong target module, `any`-widening, a declaration file outside the build's `include`, or a non-module `.d.ts` with no top-level `import`/`export` - the directive itself becomes an "unused ts-expect-error" error, which is the signal that something is wrong. Editor tooltips are not sufficient for this check since editors sometimes resolve declaration files that the actual build does not include; only running the real build proves the augmentation took effect.

## Related

See [DI in the browser](/architecture/di-in-the-browser.md) for how bindings and keys are registered at runtime, and [Binding key namespaces](/conventions/binding-key-namespaces.md) for how to name the keys before typing them.
