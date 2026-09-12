---
type: Convention
title: Coding style
description: Hard style rules that apply to every file in the ARDOR monorepo.
resource: packages/kernel/src/base/applications/abstract.ts
tags: [conventions, style]
---

These are hard rules, not suggestions. A change that violates one of these should be called out in
review, not waved through.

## Verb prefixes

A function name opens with the verb that says what it does: `generate` `build` `to` `is` `has`
`assert` `extract` `enrich` `get` `resolve`.

`is*` and `assert*` answer the same question and differ in what happens next. `is*` returns a boolean
and leaves the branch to the caller; `assert*` throws and returns `void`, so the code after it needs
no branch. Reach for `assert*` when every caller would throw on `false` anyway - otherwise one
condition ends up with a different error message at each call site. The const classes in
`packages/kernel/src/common/constants.ts` (`RequestMethods`, `RequestTypes`, `RequestBodyTypes`) lean
on `isValid` for exactly this reason: a provider checks `RequestMethods.isValid(method)` and decides
what to do with `false`, rather than the const class deciding for it.

`has*` is the ownership question: `hasSession`, never `hasSession` - the second is not English.

This list covers UTILITY functions. Service and hook methods in a consuming application lean on a
wider set - `fetch`, `create`, `update`, `delete`, `validate`, `load`, `count` - the same verbs a data
provider method (`getList`, `getOne`, `update`, `delete`) already uses. Do not force those into this
list.

## No silent catch

Every `catch` block logs, or surfaces the error through the error flow. A provider or hook that talks
to the REST data provider should log the failure through its scoped logger, then re-throw or hand the
error to `getError` so [error handling](/conventions/error-handling.md) and `useNotifyError` can do
their job:

```typescript
try {
  await dataProvider.getOne(resource, { id });
} catch (error) {
  this.logger.for(this.fetchOne.name).error('Error fetching %s#%s: %s', resource, id, error);
  throw getError({ message: 'Failed to fetch record', cause: error });
}
```

## Always use braces

No single-statement `if` without `{ }` - it removes a whole class of dangling-else bugs.

## Early return over nesting

Guard clauses at the top of a function, not a pyramid of nested `if`. An application's `stop` method
in `packages/kernel/src/base/applications/abstract.ts` bails out before touching anything it never
started:

```typescript
if (!this.isBooted) {
  this.logger.for(this.stop.name).info('Application was not booted | Nothing to stop');
  return;
}
```

## switch + default over if-else chains

Dispatch on a const class value with a `switch`, whose `default` throws via
[`getError`](/conventions/error-handling.md) rather than falling through silently:

```typescript
switch (method) {
  case RequestMethods.GET: { return this.handleGet(); }
  case RequestMethods.POST: { return this.handlePost(); }
  default: { throw getError({ message: '[dispatch] Invalid RequestMethod!' }); }
}
```

## Strict TypeScript, avoid any

No `any` unless truly unavoidable. When a cast cannot be avoided, prefer a simple `as any` over a
baroque `as unknown as SomeType` - the simple cast is honest about being an escape hatch.

## State belongs to a class, not to the module

A `let`, a cache `Map` or a `WeakMap` at module scope with exported arrows reading it is state with
no owner: nothing names it, nothing bounds who may mutate it, and a test cannot reach it to reset
it. Put the state and the operations on it in a class, as `static` members. A service registered under
its `services.<ClassName>` binding key is the shape to follow: state lives on the class instance that
DI resolves, not on a module-level variable next to it.

Two limits on this. A pure exported function that holds nothing stays a function - a class around it
buys nothing. And a name that is already published stays exported, as a one-line delegate to the
class, the way `getError` delegates to `ApplicationError.getError`.

Inside a class, reach for statics by class name, not `this` - a static called through a detached
reference has no `this`.

## Comments state constraints, not history or narration

A comment earns its place only by stating something the code cannot show: an invariant, a
non-obvious constraint, why a shortcut is safe. Not a changelog entry, not a restatement, not a
note to a reviewer.

## Related

- [Error handling](/conventions/error-handling.md)
- [Options objects](/conventions/options-objects.md)
- [Testing conventions](/conventions/testing-conventions.md)
- [Gotchas](/conventions/gotchas.md)
