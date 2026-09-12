---
type: Convention
title: Binding key namespaces
description: Every DI binding key in ARDOR is namespaced by artifact kind - services.X, providers.X, and so on.
resource: packages/kernel/src/common/bindings.ts
tags: [conventions, di, bindings]
---

Every binding key registered in ARDOR's browser container is namespaced by the kind of artifact it
names. `BindingNamespaces` in `packages/kernel/src/common/bindings.ts` defines the namespace
constants as a [const class](/conventions/const-classes.md):

```typescript
export class BindingNamespaces {
  static readonly COMPONENT = BindingNamespaces.createNamespace({ name: 'components' });
  static readonly MODEL = BindingNamespaces.createNamespace({ name: 'models' });
  static readonly SERVICE = BindingNamespaces.createNamespace({ name: 'services' });
  static readonly MIDDLEWARE = BindingNamespaces.createNamespace({ name: 'middlewares' });
  static readonly PROVIDER = BindingNamespaces.createNamespace({ name: 'providers' });
  static readonly CONFIGURATION = BindingNamespaces.createNamespace({ name: 'configurations' });
}
```

`createNamespace` throws on a name holding `.` or whitespace, and on an empty or missing one.
`Binding` tags itself with the first dot-separated segment of its key, so `'acme.services'` would be
tagged `acme` and no boot step would ever drain it - a failure that is otherwise silent. The check
runs while the class initializes, so `NAME_PATTERN` is declared above the constants.

The same rule (`BindingNamespaces.isValid`) guards **every artifact registration** through
`assertArtifactNamespace`, called from `injectable` for a declared `binding` and from
`registerArtifact` for a call-site one. Without it a raw string reached `binding.namespace` and
skipped the check: `Binding` only tags when the key has more than one dot-separated part, so a
namespace-less key binds untagged - `registerDynamicBindings` never drains it and
`bootChecks.binding.doVerify` never resolves it.

A binding key is namespace + `.` + class name: `services.AuthService`,
`providers.RestDataProvider`, `components.HeaderComponent`, `configurations.AppConfiguration`. This
is what the registration methods on the [application lifecycle](/architecture/application-lifecycle.md)
derive when a class declares no `binding`, and what `@inject({ key })` targets when a dependency
needs an explicit key rather than relying on auto-injection through
[DI in the browser](/architecture/di-in-the-browser.md).

**The resolved key is recorded on the class**, under `Symbol.for('ignis:binding-key')`, so
`@inject({ target: SomeService })` can read it back. Two writers, later wins:

- `@injectable` (and every stereotype through it) records the key it can derive at import time -
  `binding` if declared, else `<ArtifactNamespaces.resolve(type)>.<Class>`. Marked *provisional*.
- `registerArtifact` overwrites it with the key actually bound.

The second write is not redundant. Only it sees a `TMixinOpts.binding` passed at the call site, and
only it fires for a class registered by hand (`application.service(X)`), which carries no stereotype
metadata to derive anything from. `ArtifactNamespaces` is the `ArtifactTypes → BindingNamespaces`
map that the first writer needs, and lives in the same file.

A second *registration* under a different key logs a warning naming both - the shape only arises when
two applications in one process bind the same class differently, and a silent last-writer-wins there
would redirect every `@inject({ target })` in the process. In ARDOR this matters most for services
consumed by [hooks and context](/architecture/hooks-and-context.md), since a hook that resolves the
wrong instance silently reads stale state.

**Keys stay with their owner.** A component's binding-key const class lives in that component's own
`common/` folder, an application's in its own `common/keys.ts`; there is no repo-wide key file to keep
in sync. The repo-wide view is the generated catalog below.

`CoreBindings` in the same file is the other binding class: fixed, non-namespaced keys for
fundamental framework singletons (`@app/instance`, `@app/config`, and so on) rather than per-artifact
bindings. These are the keys the [kernel package](/packages/kernel.md) exposes to the
[react](/packages/react.md) and [admin](/packages/admin.md) packages that build ARDOR's
[data provider pipeline](/architecture/data-provider-pipeline.md) on top of them.

Errors raised during registration or resolution flow through `getError` /
`ApplicationError` from `@venizia/ignis-inversion`, following the shared
[error handling](/conventions/error-handling.md) convention and surfacing through
[error flow](/architecture/error-flow.md).

The full generated list of every key currently registered lives at
[binding keys](/reference/binding-keys.md).

## Related

- [Const classes](/conventions/const-classes.md)
- [DI in the browser](/architecture/di-in-the-browser.md)
- [Application lifecycle](/architecture/application-lifecycle.md)
- [Binding keys reference](/reference/binding-keys.md)
