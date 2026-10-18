---
type: Convention
title: Options objects
description: New functions take one options object first, at most 5 parameters - when a second parameter is allowed, and the positional shapes that still ship.
resource: packages/react/src/hooks/use-injectable.ts
tags: [conventions, api-design]
---

ARDOR functions and constructors take one options object in the first position, never a positional
argument list. Write `fn(opts: { key: string })`, not `fn(key: string)`. It is rule V-C-02, and new code follows it
across the kernel, react, and admin packages: services, providers, hooks, and internal utilities
alike. The positional shapes that still ship are listed under known exceptions below.

## A single parameter is not an exception

The rule holds at one parameter. Write `isValidName({ name })`, never `isValidName(name)`.

One positional parameter reads fine until the second one arrives. By then the method is published,
and the cost lands on every caller instead of on the one person writing it. A helper that starts
life as `isValidPath(path)` and later needs a second flag either grows a positional parameter -
breaking every call site - or gets awkwardly overloaded. Starting with `isValidPath({ path })`
avoids the choice entirely.

Mixing the two shapes inside one interface is itself the defect. A reader cannot tell which shape a
method takes without opening it, and neither can a tool.

## A second parameter, and the cap

Fold everything you can into the first object. A second parameter is allowed only where that
object cannot carry it - V-C-02's example is a repository method that takes its data and its query
options separately. Never more than 5 parameters in all; VULCAN's `venizia/max-params-own` lint
(default 5) enforces the cap once the `@venizia/dev-configs` ARDOR installs ships it.

## Known exceptions

The kernel utilities take one options object (`isNumber({ value })`, `getNumberValue({ input, method })`),
except the type guards `isDefined(value)` and `isString(value)`: an options object would lose the
narrowing. The `Logger` methods (`debug(message, ...args)`) stay positional, console-style. Three more
shapes are positional on purpose:

- **Registration on the application.** `AbstractArdorApplication.injectable(scope, value, tags?)`
  and `service(value)` (`packages/kernel/src/base/applications/abstract.ts`) take positional
  arguments.
- **The react-admin contract.** The object `DefaultRestDataProvider.value()` hands to react-admin
  implements react-admin's own positional interface (`getList(resource, params)`). ARDOR does not
  own that contract, so `value()` only forwards to the options-object methods - see
  [data provider pipeline](/architecture/data-provider-pipeline.md).
- **Const-class validation.** Rule V-C-08 fixes `static isValid(value: string): boolean` on every
  const class - see [const classes](/conventions/const-classes.md).

## Why

- **Additive evolution without breaking call sites.** A new optional field on the options type
  never forces every caller to update. A new positional parameter does.
- **Self-documenting call sites.** `dataProvider.getList({ resource, params: { pagination, sort } })`
  reads correctly at the call site with no need to check the signature. `getList(resource,
  pagination, sort)` does not.
- **Overload-friendly.** Hooks and provider methods commonly need different return shapes
  depending on an option value, and TypeScript overloads on a single options parameter stay
  readable.

## In source

Constants used across the [data provider pipeline](/architecture/data-provider-pipeline.md), such
as `RequestMethods`, `RequestTypes`, `RequestBodyTypes` and `RequestCountData` in
`packages/kernel/src/common/constants.ts`, are consumed by functions that take a single options
object describing the request - method, type, body shape - rather than a run of positional flags.
This keeps call sites readable as the number of request-shaping concerns grows.

Hooks follow the same rule. `useInjectable` (`packages/react/src/hooks/use-injectable.ts`) takes
`{ key }` or `{ target }` as a discriminated union rather than two positional overloads, and
`useInjectableContainer` takes `{ container }` even though that is its only field.

## Errors follow the same shape

`getError` from `@venizia/ignis-inversion` takes an options object describing the error - code,
message, cause - rather than positional arguments. This keeps the shape consistent with how
`useNotifyError` reads `error.normalized.code` off the resulting object. See [error
handling](/conventions/error-handling.md) and [error flow](/architecture/error-flow.md).

## Options for a container-built class

A class the container constructs cannot take a raw, undecorated `opts` constructor parameter: the
container reads only `@inject` metadata, so every constructor parameter must carry `@inject` (rule
C-03, see [dependency injection in the browser](/architecture/di-in-the-browser.md)). The options
object keeps its shape - it is bound under its own key and injected like any other dependency.
`DefaultRestDataProvider` (`packages/admin/src/providers/rest-data.ts`) takes
`@inject({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })` for its options and passes its scope
through `super({ scope: DefaultRestDataProvider.name })`, never as an extra parameter.

## Related

- [Coding style](/conventions/coding-style.md)
- [Const classes](/conventions/const-classes.md)
- [Gotchas](/conventions/gotchas.md)
- [Dependency injection in the browser](/architecture/di-in-the-browser.md)
