---
type: Convention
title: Const classes over string unions
description: Enumerable string values are a const class plus a derived value type (TConstValue and its siblings), not a raw string-literal union.
resource: packages/kernel/src/common/constants.ts
tags: [conventions, type-safety]
---

For a fixed set of string values, ARDOR uses a class of `static readonly` fields plus the
`TConstValue` helper type, not a bare string-literal union (`'a' | 'b' | 'c'`).

```typescript
// packages/kernel/src/common/types.ts
export type TConstValue<T extends ClassType<any>> = Extract<ValueOf<T>, string | number>;
```

## Why

A string-literal union only exists at compile time - there is nothing to iterate, log, or validate
against at runtime. A const class gives both: the values are real runtime properties (usable in a
`Set`, a `switch`, a loop) and `TConstValue<typeof X>` derives the exact literal union for typing,
so the two never drift apart.

## Real examples in source

`RequestCountData` in `packages/kernel/src/common/constants.ts` is the plain form - two
`static readonly` values, typed at the use site as `TConstValue<typeof RequestCountData>`.

`RequestTypes` in the same file goes further: it derives a runtime `Set` from its own static
fields so callers can validate an incoming string without a chain of `===` checks, which a
string-literal union could never do:

```typescript
export class RequestTypes {
  static readonly SEND = 'SEND';

  // react-admin
  static readonly GET_LIST = 'GET_LIST';
  static readonly GET_ONE = 'GET_ONE';
  // ... GET_MANY, GET_MANY_REFERENCE, CREATE, UPDATE, UPDATE_MANY, DELETE, DELETE_MANY

  static readonly SCHEME_SET = new Set([this.SEND, this.GET_ONE, this.GET_LIST /* ... */]);

  static isValid(input: string): boolean {
    return this.SCHEME_SET.has(input);
  }
}

// packages/kernel/src/common/types.ts
export type TRequestType = Extract<ValueOf<typeof RequestTypes>, string>;
```

The value type is a closed union - no `| (string & {})` escape - because ARDOR owns this vocabulary
(see [narrowing authority](/conventions/narrowing-authority.md)). The `Extract<..., string>` drops
`SCHEME_SET` and `isValid` from the union by type; `TStatusFromClass` does the same by omitting
`prototype`, `isValid`, `SCHEME_SET` and `TYPE_SET` by name.

`RequestMethods`, `RequestBodyTypes` and `Environments` carry the same `SCHEME_SET` plus `isValid()`
pair, typed as `TRequestMethod` and `TEnvironment` (via `TStatusFromClass`) and `TRequestBodyType`
(via `Extract<ValueOf<...>, string>`). `HeaderConsts`, the names behind the
[header protocol](/architecture/header-protocol.md), is plain `static readonly` constants with no
`SCHEME_SET` and no `isValid()`.

## Related

- [Binding key namespaces](/conventions/binding-key-namespaces.md)
- [Coding style](/conventions/coding-style.md)
- [Narrow only what the framework owns](/conventions/narrowing-authority.md)
- [Options objects](/conventions/options-objects.md)
