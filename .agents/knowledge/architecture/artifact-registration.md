---
type: Concept
title: Artifact registration
description: How a class gets from a stereotype decorator to a React component - declared with @service() and the rest, discovered at import time, bound by registerArtifacts() before bindingList() and bindContext(), resolved by useInjectable and the per-stereotype hooks.
resource: packages/kernel/src/base/applications/abstract.ts
tags: [architecture, dependency-injection, stereotypes, registration, hooks, ignis]
---

# Artifact registration

A class reaches a component in four steps, and each step lives in a different place: the stereotype
**declares** it (IGNIS, `@venizia/ignis-kernel/metadata`), the import **discovers** it, the
application **binds** it (`packages/kernel/src/base/applications/abstract.ts`), and a hook
**resolves** it (`packages/react/src/hooks/use-injectable.ts` and `use-artifact.ts`). The container
itself - what a binding is, scopes, `@inject` - is in [DI in the browser](/architecture/di-in-the-browser.md).

## Declare

`packages/kernel/src/base/metadata/index.ts` re-exports, name by name, from
`@venizia/ignis-kernel/metadata`: the class stereotypes `service`, `component`, `configuration`,
`model`, `repository`, `datasource` and the root `injectable({ type })` they all call; the `provide`
method decorator and `inject`; the constants `BindingNamespaces`, `ArtifactNamespaces`,
`ArtifactTypes`, `BindingKeys`; and the types `IArtifactMetadata`, `IArtifactRegistrationOptions`,
`TBindingNamespace`, `TBindingScope`. ARDOR defines no stereotype of its own, so a class written for
a worker and one written for a browser register the same way. They are legacy TypeScript decorators
(`@inject` decorates constructor parameters), so an application compiles with
`experimentalDecorators`, as every example does.

The list is explicit rather than `export *` so that a name added upstream is published on purpose,
and a collision with ARDOR's own surface is caught at that line. **`CoreBindings` is the collision
that already happened**: IGNIS's and ARDOR's are different dictionaries sharing the member
`APPLICATION_INSTANCE` with different values (`'@app/instance'` against
`'@app/application/instance'`). Upstream dropped its own from `./metadata` for that reason, and only
ARDOR's is reachable from ARDOR. `MetadataRegistry` and `pickRegistrationOptions` are left out too.

At decoration time - which is import time - a stereotype:

1. Checks an explicit `binding.namespace` with `BindingNamespaces.assertArtifactNamespace` - shape
   only (one segment, no `.`, no whitespace) - and throws on the spot.
2. Appends the class to the discovery list.
3. Records a binding key on the class through `reflect-metadata`: `<namespace>.<key>` from an
   explicit `binding: { namespace, key }`, else the kind's namespace from `ArtifactNamespaces`
   (`services`, `components`, `configurations`, `models`, `repositories`, `datasources`) plus
   `Class.name`. No stereotype maps to `providers`.

The key is read as the class's own metadata, never inherited: an undecorated subclass of a
stereotyped class carries no key and is not discovered.

## Discover

There is no filesystem scan - a class exists at run time only because something imported it, which is
why a browser bundle needs nothing extra. A file nobody imports registers nothing, and neither does an
`import type`, which the compiler erases.

The list lives on ignis-kernel's `MetadataRegistry`, whose `getInstance()` anchors one instance on
`globalThis` under a `Symbol.for` key, so every copy of `@venizia/ignis-kernel` in a realm shares it.
It is process-wide, not per application: two applications in one process bind the same classes. A
page never runs two; a test run does - see [testing](/process/testing.md) for isolating it. The
container's own registry (`getMetadataRegistry()`, from `@venizia/ignis-inversion`) reads the key
the stereotype wrote but has no discovery list, which is why the application base imports
`MetadataRegistry` directly.

## Bind

`preConfigure()` binds `APPLICATION_INSTANCE` and `APPLICATION_INFO`, then registers from least
explicit to most explicit - a later `bind` on the same key replaces the earlier one:

```
registerArtifacts()  ->  bindingList()  ->  bindContext()
```

A stereotype is what a class declares about itself; `bindingList()` is what this application decided
by hand for this build; a `this.bind(...)` in `bindContext()` overrides both. An override that lost to
a decorator would be ignored with nothing to show it. The full boot sequence is [application lifecycle](/architecture/application-lifecycle.md).

`registerArtifacts()` reads each discovered class's key, skips a class with none, and binds the rest
`toClass()` under the scope the stereotype declares, `BindingScopes.SINGLETON` by default. It is not
IGNIS's boot sequence. From `IArtifactRegistrationOptions` it honours **the key and the scope**;
`when`, `order`, `after` and `allowOverride` are ignored, and a `@provide({ key })` method is never bound, even
though `provide` is re-exported. For a transient, a conditional binding or a provider, bind by hand
in `bindContext()`.

The list is read once, inside `preConfigure()`. A class whose module is first imported after
`start()` - a lazy route chunk - is never bound. Calling `registerArtifacts()` again is not the fix:
it replaces every discovered binding, so the next resolve of each builds a second instance, and it
overrides any `bindingList()` or `bindContext()` binding on the same key. Import the class before
`start()`, or bind it by hand.

Registration by hand is the second mode, as in IGNIS. Every path records the key on the class
(`setBindingKey`), so `{ target }` resolves it like a stereotyped class:

- `service(X)`, `repository(X)`, `dataSource(X)`, `component(X)` - bind under
  `opts.binding` > the stereotype's `binding` > `<namespace>.<ClassName>`, with `scope` (default
  singleton) and `allowOverride: false` to refuse an existing key. They return the `Binding`. Call
  them inside `bindContext()`.

- `bindingList()` - a record of literal key to class, bound as singletons. Literal keys survive a
  minifier, and `keyof ReturnType<Application['bindingList']>` is what an application feeds into
  `IUseInjectableKeysOverrides`.
- `injectable(scope, Class, tags?)` - binds `` `${scope}.${Class.name}` `` as a singleton with optional
  tags. Prefer the per-kind methods.

Singleton is the default on every path, unlike IGNIS's server: a hook resolves on every render, and a
transient repository would hand each render a new instance. A class registered twice under different
keys is bound twice, as two singletons, and `{ target }` reaches the key recorded last. How keys are named, and the minifier and same-name traps of a derived key, are in
[binding key namespaces](/conventions/binding-key-namespaces.md).

## Resolve

`useInjectable` takes `{ key }` or `{ target }`, never both, plus an optional `container`. The
container comes from `useInjectableContainer`: the option, else `ApplicationContext.container`.

- **`{ key }`** calls `container.get({ key })`. The key is typed as `TUseInjectableKeys` - every
  `CoreBindings` value plus the keys an application adds, see [module augmentation](/architecture/module-augmentation.md).
- **`{ target }`** looks up the key recorded on the class with
  `container.getMetadataRegistry().getBindingKey({ target })`, then resolves that key. It never
  guesses a key from the class name.

`useService`, `useRepository`, `useProvider`, `useComponent` and `useConfiguration` (`use-artifact.ts`) take the same
two shapes as an options object, never a positional class. With `{ target }` the return type is
inferred from the class; with `{ key }` the caller supplies it. They are not aliases: for a `target`
each asserts the recorded key starts with `services.`, `repositories.`, `providers.`,
`components.` or `configurations.` and otherwise throws naming both. A `key` is not checked - its namespace is in the
string, the caller's to get wrong - and a `target` with no recorded key skips the check and throws
from `useInjectable`. The check reads the container through `useInjectableContainer` with the same
inputs as the resolve, so the two can never disagree.

Since no stereotype maps to `providers`, `useProvider({ target })` passes only for a class declaring
`binding: { namespace: BindingNamespaces.PROVIDER, key }`. ARDOR's default providers sit under
`CoreBindings` keys: `useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })`.

## Reading a failed resolve

| Error says | Cause | Fix |
|---|---|---|
| `Failed to resolve binding key for target` | No key on the class: neither stereotyped nor registered, or a subclass of a registered class | Add a stereotype, or register it by hand |
| `is not bounded in context` | A key nobody bound: a typo, a module imported after `start()`, a `bindContext()` binding never made | Fix the key, import before `start()`, or bind it |
| `is bound as "...", not under "..."` | The hook does not match the class's namespace | Use the hook for that namespace |
| `Failed to determine injectable container` | No container on `ApplicationContext` and none passed | Render under `ArdorApplication`, or pass `container` |


## Related

- [DI in the browser](/architecture/di-in-the-browser.md)
- [Application lifecycle](/architecture/application-lifecycle.md)
- [Binding key namespaces](/conventions/binding-key-namespaces.md)
- [Hooks and context](/architecture/hooks-and-context.md)
- [kernel](/packages/kernel.md) and [react](/packages/react.md)
