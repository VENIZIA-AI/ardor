---
type: Convention
title: Narrow only what the framework owns
description: A closed union is a claim that no one else may extend the set - make it only where ARDOR owns the vocabulary, and prefer `unknown` over a type that pretends to know.
resource: packages/kernel/src/common/constants.ts
tags: [conventions, type-safety, public-api]
---

Narrowing a type is not only a statement about which values are valid. It is a statement that
**no one else may add one**. Make that second claim only where ARDOR genuinely owns the vocabulary.

## The two questions, asked separately

Before narrowing any type that reaches an application:

1. **Does a wrong value fail silently today?** If yes, narrowing earns its cost.
2. **Does ARDOR own the whole set?** If no, narrowing is a claim it has no standing to make.

A yes to the first and a no to the second means the answer is an **extensible seam**, not a closed
union: a default that is today's closed set, plus a way for an application to declare its own.

The const classes in `packages/kernel/src/common/constants.ts` - `RequestMethods`, `RequestTypes`,
`RequestBodyTypes`, `HeaderConsts`, `Environments` - each pair a fixed set of values with a
`SCHEME_SET` and an `isValid` check. ARDOR owns these vocabularies outright: an HTTP method, a
header name, an environment name are all closed by the protocols ARDOR talks to, not by ARDOR's own
preference. That is what makes narrowing them legitimate.

Contrast this with something ARDOR does not own, such as the shape of a consuming application's
resource records passed through the [data provider pipeline](/architecture/data-provider-pipeline.md).
Reject `TKnown | (string & {})` for this kind of field. It accepts every string, so it re-opens the
exact bug class the narrowing existed to close, while looking like a compromise. The honest move is
an extensible seam: a default set of known values plus an explicit way for an application to extend
it, not a union that silently accepts anything.

## `unknown` beats a type that pretends to know

Where ARDOR cannot see the shape - an application's resource metadata, an arbitrary payload handed to
a hook or a service - the honest declaration is `unknown`, and a runtime check that raises a
`getError` naming what arrived. `useNotifyError` reads `error.normalized.code` from exactly this kind
of check, so the error has to be structured, not just thrown.

A type that guesses at the shape is worse than `unknown`, because it **looks** safe. `unknown` forces
the caller to confront the boundary; a wrong-but-plausible type lets them walk past it.

## Why this is a convention and not a preference

The const classes in kernel narrow request methods and body types to the values ARDOR's network
layer and REST data provider actually understand. That narrowing answers question 1 correctly - a
misspelled method or header name fails silently as a rejected or ignored request otherwise, with
nothing in any log pointing at the typo.

It also answers question 2 correctly, which is why it can stay closed: HTTP methods and standard
headers are not vocabulary ARDOR invented, and no consuming application has standing to add a new
one. Contrast this with a field describing an application's own domain concepts flowing through
[hooks and context](/architecture/hooks-and-context.md) - there, ARDOR does not own the set, and the
same style of narrowing would break the first application that defines its own value.

## What narrowing a field also does

Tightening a type at a boundary rejects every loose type on the path that feeds it, and those
surface one layer at a time: a `Record<string, unknown>` accumulator, or a field restated as
`method?: string` across a few consecutive service methods. Each fix pushes the error out one layer,
so a change looks like a cascade of new failures when it is one pre-existing chain becoming visible.
Say so in the changelog under `docs/wiki/content/changelogs`; otherwise the patch is blamed for the
chain it revealed. See [error handling](/conventions/error-handling.md) for how these runtime checks
should be structured, and [testing conventions](/conventions/testing-conventions.md) for exercising
the boundary with bun test.
