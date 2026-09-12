---
type: Convention
title: Const classes over string unions
description: Enumerable string values are a const class plus TConstValue, not a raw string-literal union.
resource: packages/kernel/src/common/constants.ts
tags: [conventions, type-safety]
---

For a fixed set of string values, ARDOR uses a class of `static readonly` fields plus the
`TConstValue` helper type, not a bare string-literal union (`'a' | 'b' | 'c'`).

```typescript
// packages/kernel/src/common/types/const-value.ts
export type TConstValue<T extends TClass<any>> = Extract<ValueOf<T>, string | number>;
```

## Why

A string-literal union only exists at compile time - there is nothing to iterate, log, or validate
against at runtime. A const class gives both: the values are real runtime properties (usable in a
`Set`, a `switch`, a loop) and `TConstValue<typeof X>` derives the exact literal union for typing,
so the two never drift apart.

## Real examples in source

`RequestMethods` in `packages/kernel/src/common/constants.ts`:

```typescript
export class RequestMethods {
  static readonly GET = 'GET';
  static readonly POST = 'POST';
  static readonly PUT = 'PUT';
  static readonly DELETE = 'DELETE';
}
export type TRequestMethod = TConstValue<typeof RequestMethods>;
```

`RequestTypes` in the same file goes further: it derives a runtime `Set` from its own static
fields so callers can validate an incoming string without a chain of `===` checks, which a
string-literal union could never do:

```typescript
export class RequestTypes {
  static readonly JSON = 'json';
  static readonly FORM_DATA = 'form-data';
  static readonly SCHEME_SET = new Set([this.JSON, this.FORM_DATA]);
  static isValid(value: string) { return this.SCHEME_SET.has(value); }
}
export type TRequestType = TConstValue<typeof RequestTypes> | (string & {});
```

`Environments` and `HeaderConsts` in the same file use the same pattern - a fixed set of
`static readonly` values plus a `SCHEME_SET` and `isValid()` attached directly to the class, so
the data provider pipeline and the [header protocol](/architecture/header-protocol.md) can check
membership at runtime instead of relying on a type that disappears after compilation.

## Related

- [Binding key namespaces](/conventions/binding-key-namespaces.md)
- [Coding style](/conventions/coding-style.md)
- [Options objects](/conventions/options-objects.md)
