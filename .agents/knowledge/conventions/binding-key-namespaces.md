---
type: Convention
title: Binding key namespaces
description: An ARDOR binding key is either a fixed CoreBindings constant or a `<scope>.<ClassName>` string built by injectable(); nothing validates the scope at runtime.
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

**Per-artifact keys** are built from a scope and a class name by `injectable()` in
`packages/kernel/src/base/applications/abstract.ts`:

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

So `application.service(ProductApi)` binds `services.ProductApi`. `services` is the only scope the
framework itself uses; an application passing its own scope to `injectable()` is inventing
vocabulary, and should keep it to the artifact kind (`providers`, `configurations`) rather than a
feature name.

Both methods bind as `BindingScopes.SINGLETON`. That is a deliberate default: one instance per
application is what every consumer set by hand before the default existed.

## Nothing validates the scope

ARDOR does **not** check the scope string. There is no `BindingNamespaces`, no `createNamespace`,
no namespace assertion on registration - a typo in the scope binds the class under a key that
simply nobody asks for. The failure surfaces later and elsewhere, as an unresolved binding inside
`useInjectable`, never at the registration that caused it. Treat the scope as a literal you copy,
not one you type from memory.

## The minifier trap

`injectable()` keys on `value.name`, and a production minifier rewrites class names. A bundle built
with mangled names binds `t.ProductApi` -> `services.t` and resolves `services.ProductApi` to
nothing, while the development build works perfectly. The build-proof form is `bindingList()`,
which the application overrides with literal keys:

```typescript
override bindingList() {
  return { 'services.ProductApi': ProductApi };
}
```

`preConfigure()` binds every entry of that record as a singleton before `bindContext()` runs, so a
binding declared there is available to anything `bindContext()` constructs. The literal keys are
also what types the hook: `keyof ReturnType<Application['bindingList']>` is the union an
application feeds into `IUseInjectableKeysOverrides`.

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
