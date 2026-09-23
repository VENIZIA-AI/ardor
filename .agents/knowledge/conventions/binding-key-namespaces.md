---
type: Convention
title: Binding key namespaces
description: An ARDOR binding key is either a fixed CoreBindings constant or a `<namespace>.<key>` string, built by a stereotype (discovery) or by the application's service/repository/dataSource/component methods (by hand); both record the key on the class, so both resolve by target.
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

**Per-artifact keys** have the shape `<namespace>.<key>`, with the namespace from
`BindingNamespaces` (`services`, `repositories`, `datasources`, `components`, `providers`,
`configurations`, ...). Two registration modes build them, as in IGNIS:

| Mode | How | Key |
|---|---|---|
| Discovery | a stereotype (`@service()`, `@repository(...)`, `@datasource()`, `@component()`) and `registerArtifacts()` in `preConfigure()` | the stereotype's `binding`, else `<namespace>.<ClassName>` |
| By hand | `this.service(X)`, `this.repository(X)`, `this.dataSource(X)`, `this.component(X)` in `bindContext()` | `opts.binding` > the class's stereotype `binding` > `<namespace>.<ClassName>` |

Both live in `packages/kernel/src/base/applications/abstract.ts`. The by-hand methods take
`IArtifactRegistration { binding?, scope?, allowOverride? }` and return the `Binding`, so a caller
can chain on it:

```typescript
this.dataSource(ApiDataSource);                        // datasources.ApiDataSource
this.repository(ProductRepository);                    // repositories.ProductRepository
this.service(AuditService, { binding: { namespace: 'services', key: 'audit' } }); // services.audit
```

`allowOverride: false` throws when the key is already bound instead of silently replacing it.

Every kind defaults to `BindingScopes.SINGLETON`, discovery included. IGNIS's server defaults
services and repositories to transient; ARDOR does not, because a React hook resolves on every
render and a transient repository would hand each render a new instance (an effect keyed on it
loops). `scope` overrides it per registration.

The older `injectable(scope, X, tags?)` still binds `<scope>.<ClassName>` as a singleton and records
the key; prefer the per-kind methods, whose namespace is a constant rather than a string you type.

## Only the stereotype and the hooks check the namespace

A stereotype that declares an explicit `binding.namespace` has it checked at decoration time by
`BindingNamespaces.assertArtifactNamespace`, for shape (one segment, no `.`, no whitespace). On
resolve, `useService`, `useRepository`, `useProvider`, `useComponent` and `useConfiguration` in
`packages/react/src/hooks/use-artifact.ts` assert that a `{ target }` is bound under their
namespace; a `{ key }` is the caller's to get right.

`bindingList()` and `injectable()` check nothing. A typo there binds the class under a key nobody
asks for, and the failure surfaces later as an unresolved binding inside `useInjectable`.

## Discovery: declare with a stereotype

A stereotype from `@venizia/ignis-kernel/metadata`, re-exported by
`packages/kernel/src/base/metadata/index.ts`, marks the class and `preConfigure()` binds it. How the
class gets discovered is in [DI in the browser](/architecture/di-in-the-browser.md).

```typescript
import { BaseService, service } from '@venizia/ardor';

@service()
export class PricingService extends BaseService {
  constructor() {
    super({ scope: 'PricingService' });
  }
}
```

The constructor is not optional: the container passes nothing to an undecorated constructor, so a
bare `class PricingService extends BaseService {}` registers fine and throws on first resolve.

IGNIS's `@repository` requires a `model` today, which an `HttpRepository` does not have; IGNIS's
next prerelease adds `RepositoryTypes.REMOTE` for it. Until then register repositories by hand.

`CoreBindings` is **not** re-exported from IGNIS, and that is deliberate on both sides: IGNIS's and
ARDOR's are different dictionaries that share the member `APPLICATION_INSTANCE` with different
values (`'@app/instance'` against `'@app/application/instance'`). Only ARDOR's is reachable from
ARDOR.

## The minifier trap

A derived key is read off `Class.name`, and a production minifier rewrites class names. A bundle
that renames `PricingService` to `t` binds `services.t`, while code asking for
`'services.PricingService'` resolves nothing, and the development build works perfectly.

Resolving by class removes the mismatch: both modes record the key on the class object
(`setBindingKey`), and `@inject({ target })` and the `use*({ target })` hooks read it back from that
same object, so a mangled name still agrees with itself:

```typescript
const products = useRepository({ target: ProductRepository });
```

Literal keys in `bindingList()`, or an explicit `binding: { namespace, key }`, also survive. The
literal keys in `bindingList()` are what types `useInjectable({ key })`:
`keyof ReturnType<Application['bindingList']>` is the union an application feeds into
`IUseInjectableKeysOverrides`.

One limit remains: **a derived key is still `<namespace>.<Class.name>`**, and the container stores
bindings by that string. Two classes with the same name in one namespace share one binding, the last
registered wins, and resolving the first by `target` returns the second. Two same-named classes in
different feature folders hit this, and so can a minified build whose chunks reuse a short name. An
explicit `binding` avoids it.

## How a key becomes a type

`packages/react/src/hooks/use-injectable.ts` builds the accepted key union from two halves:

```typescript
export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;
export type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;
```

The first half is every `CoreBindings` value, free. The second half is empty until an application
augments `IUseInjectableKeysOverrides` - see [module augmentation](/architecture/module-augmentation.md)
for the declaration and for the `any`-widening trap that silently turns the union back into
`string`. Resolving by `{ target }` needs no augmentation at all.

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
