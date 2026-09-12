---
type: Convention
title: Options objects
description: Every function takes a single options object, never positional parameters.
resource: packages/kernel/src/common/constants.ts
tags: [conventions, api-design]
---

ARDOR functions and constructors take one options object, never a positional argument list.
Write `fn(opts: { key: string })`, not `fn(key: string)`. This applies everywhere across the
kernel, react, and admin packages: services, providers, hooks, the application base class, and
internal utilities alike.

## A single parameter is not an exception

The rule holds at one parameter. Write `isValidName({ name })`, never `isValidName(name)`.

One positional parameter reads fine until the second one arrives. By then the method is published,
and the cost lands on every caller instead of on the one person writing it. A helper that starts
life as `isValidPath(path)` and later needs a second flag either grows a positional parameter -
breaking every call site - or gets awkwardly overloaded. Starting with `isValidPath({ path })`
avoids the choice entirely.

Mixing the two shapes inside one interface is itself the defect. A reader cannot tell which shape a
method takes without opening it, and neither can a tool.

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

Application-level services follow the same rule for construction: a service registered through
`application.service(Class)` and resolved under the `services.<ClassName>` binding key (see
[binding keys](/reference/binding-keys.md)) takes its configuration as one options object rather
than a positional constructor argument list, matching how [dependency injection in the
browser](/architecture/di-in-the-browser.md) resolves constructor parameters by type and decorator,
not by position.

## Errors follow the same shape

`getError` from `@venizia/ignis-inversion` takes an options object describing the error - code,
message, cause - rather than positional arguments. This keeps the shape consistent with how
`useNotifyError` reads `error.normalized.code` off the resulting object. See [error
handling](/conventions/error-handling.md) and [error flow](/architecture/error-flow.md).

## The one place this matters most for DI

Anything registered with the container must not take a raw, undecorated `opts` constructor
parameter alongside injected ones - see [coding style](/conventions/coding-style.md) and
[gotchas](/conventions/gotchas.md) for why the container cannot mix decorated and undecorated
constructor parameters. Configuration a service needs should be pulled from its own fields inside
the constructor body, not smuggled in as an extra positional argument.

## Related

- [Coding style](/conventions/coding-style.md)
- [Const classes](/conventions/const-classes.md)
- [Gotchas](/conventions/gotchas.md)
- [Dependency injection in the browser](/architecture/di-in-the-browser.md)
