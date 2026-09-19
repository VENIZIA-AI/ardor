---
type: Convention
title: Binding key namespaces
description: An ARDOR binding key is either a fixed CoreBindings constant or a `<namespace>.<key>` string - `<namespace>.<ClassName>` when a stereotype or the application's injectable() derives it, a literal when a stereotype's `binding` or bindingList() declares it; only the stereotype checks its namespace, and only a stereotyped class resolves by target.
resource: packages/kernel/src/common/keys.ts
tags: [conventions, di, bindings]
---

An ARDOR application is an IGNIS `Container`, so everything it owns is reachable by a string key.
Those keys come in exactly two shapes, and knowing which one you are looking at tells you who bound
it and what breaks when it is wrong.

## The two shapes

**Fixed framework keys** live in `packages/kernel/src/common/keys.ts` as a
[const class](/conventions/const-classes.md). They are paths under `@app/`, not namespaced by
artifact kind:

```typescript
export class CoreBindings {
  static readonly APPLICATION_INSTANCE = '@app/application/instance';
  static readonly APPLICATION_INFO = '@app/application/info';

  static readonly DEFAULT_AUTH_PROVIDER = '@app/application/auth/default';
  static readonly DEFAULT_I18N_PROVIDER = '@app/application/i18n/default';
  static readonly DEFAULT_REST_DATA_PROVIDER = '@app/application/data/rest/default';
  // ... options and service keys in the same file
}
```

The framework binds the first two itself in `preConfigure()`; every other `CoreBindings` key is the
application's to bind inside `bindContext()`. Which is which is listed per key in
[binding keys](/reference/binding-keys.md).

**Per-artifact keys** have the shape `<namespace>.<ClassName>`, and two things build them. A
stereotype with no explicit `binding` builds one from its artifact kind, taking the namespace from
`ArtifactNamespaces` - `services`, `components`, `configurations`, `models`, `repositories`,
`datasources`, `controllers` - and the key from `Class.name`; a stereotype that declares
`binding: { namespace, key }` is bound under exactly that literal instead. The hand-written form is the application's `injectable()` method in
`packages/kernel/src/base/applications/abstract.ts` - not the `injectable` stereotype of the same
name:

```typescript
injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>) {
  this.bind({ key: `${scope}.${value.name}` })
    .toClass(value)
    .setScope(BindingScopes.SINGLETON)
    .setTags(...(tags ?? []));
}

service<T>(value: TClass<T>) {
  this.injectable('services', value);
}
```

So `application.service(ProductApi)` binds `services.ProductApi`. An application passing its own
scope to `injectable()` is inventing vocabulary, and should keep it to the artifact kind
(`providers`, `configurations`) rather than a feature name.

Both methods bind as `BindingScopes.SINGLETON`. That is a deliberate default: one instance per
application is what every consumer set by hand before the default existed.

## Only the stereotype checks its namespace

A stereotype that declares an explicit `binding.namespace` has it checked at decoration time by
`BindingNamespaces.assertArtifactNamespace` - for shape (one segment, no `.`, no whitespace), not
against a list of known namespaces. On resolve, `useService`, `useProvider`, `useComponent` and
`useConfiguration` in `packages/react/src/hooks/use-artifact.ts` assert that a `{ target }` is bound
under `services`, `providers`, `components` or `configurations` respectively; a `{ key }` is the
caller's to get right.

The application's `injectable()` and `bindingList()` check nothing. A typo in the scope binds the
class under a key that simply nobody asks for, and the failure surfaces later and elsewhere, as an
unresolved binding inside `useInjectable`, never at the registration that caused it. Treat a
hand-written scope as a literal you copy, not one you type from memory.

## Declare with a stereotype, and no key is typed at all

The preferred form writes no key: a stereotype from `@venizia/ignis-kernel/metadata`, re-exported by
`packages/kernel/src/base/metadata/index.ts`, marks the class and the application binds it. How the
class gets discovered and bound is in [DI in the browser](/architecture/di-in-the-browser.md).

```typescript
import { BaseApiService, service } from '@venizia/ardor';

@service()
export class ProductApi extends BaseApiService {
  constructor() {
    super({ scope: 'ProductApi', resource: 'products' });
  }
}
```

The constructor is not optional: the container passes nothing to an undecorated constructor (see
[DI in the browser](/architecture/di-in-the-browser.md)), so a bare
`class ProductApi extends BaseApiService {}` registers fine and throws on first resolve.

`BindingNamespaces` comes with the stereotypes - `SERVICE` is `'services'`, `PROVIDER` is
`'providers'`, and so on - so the namespace is a constant rather than a string a caller retypes.
`ArtifactNamespaces`, `ArtifactTypes` and `BindingKeys` are re-exported beside it.

`CoreBindings` is **not** re-exported from IGNIS, and that is deliberate on both sides: IGNIS's and
ARDOR's are different dictionaries that share the member `APPLICATION_INSTANCE` with different
values (`'@app/instance'` against `'@app/application/instance'`). Only ARDOR's is reachable from
ARDOR.

## The minifier trap

Every per-artifact key that is derived - by `injectable()` and `service()`, or by a stereotype with
no explicit `binding` - is read off `Class.name`, and a production minifier rewrites class names. A
bundle that renames `ProductApi` to `t` binds `services.t` - through `service(ProductApi)` and
`@service()` alike - while code asking for `'services.ProductApi'` resolves nothing, and the
development build works perfectly. Three forms survive it: literal keys in `bindingList()`, a
stereotype that declares `binding: { namespace, key }` with a literal key, and a stereotyped class
resolved by `{ target }`.

```typescript
override bindingList() {
  return { 'services.ProductApi': ProductApi };
}
```

`preConfigure()` binds every entry of that record as a singleton before `bindContext()` runs, so a
binding declared there is available to anything `bindContext()` constructs. The literal keys are
also what types the hook: `keyof ReturnType<Application['bindingList']>` is the union an
application feeds into `IUseInjectableKeysOverrides`.

## Why the class, and not the string

Resolving by class removes the mismatch instead of working around it. The stereotype records the key
on the class object and the hook reads it back from that same object, so a mangled name still agrees
with itself:

```typescript
const productApi = useService({ target: ProductApi });
```

It has two limits:

- **Only a stereotyped class resolves by `target`.** `bindingList()` and `this.service(X)` record no
  key on the class, so a class bound that way is resolved by `{ key }`. They remain correct for a
  class that cannot carry a decorator.
- **By default the key is still `<namespace>.<Class.name>`**, taken at decoration time, and the
  container stores bindings by that string. Two classes with the same name in one namespace share one
  binding: the last one registered wins, and resolving the first by `target` silently returns the
  second. Two same-named classes in different feature folders hit this, and so can a minified build
  whose separate chunks reuse a short name. A stereotype that declares an explicit
  `binding: { namespace, key }` avoids it.

## How a key becomes a type

`packages/react/src/hooks/use-injectable.ts` builds the accepted key union from two halves:

```typescript
export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;
export type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;
```

The first half is every `CoreBindings` value, free. The second half is empty until an application
augments `IUseInjectableKeysOverrides` - see [module augmentation](/architecture/module-augmentation.md)
for the declaration and for the `any`-widening trap that silently turns the union back into
`string`.

## Storage keys are the same idea, different registry

`LocalStorageKeys` in the same `keys.ts` names browser storage rather than container bindings:
`@app/auth/token`, `@app/auth/identity`, `@app/auth/permission`. The prefix is load-bearing.
`DefaultAuthService.cleanUp()` in `packages/kernel/src/base/services/auth.ts` clears only keys
starting with `@app/auth/` or `@app/oauth2/`, so anything an application stores outside those two
prefixes survives a logout - intentional for a UI preference, a leak for anything user-scoped.

## Related

- [Const classes](/conventions/const-classes.md)
- [DI in the browser](/architecture/di-in-the-browser.md)
- [Application lifecycle](/architecture/application-lifecycle.md)
- [Module augmentation](/architecture/module-augmentation.md)
- [Binding keys reference](/reference/binding-keys.md)
