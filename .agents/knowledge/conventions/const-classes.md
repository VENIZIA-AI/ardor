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
export type TConstValue<T extends TClass<any>> = Extract<ValueOf<T>, string | number> & {};
```

`TClass` comes from `@venizia/ignis-inversion`; ARDOR has no class type of its own. The trailing `& {}` is
on `TStringConstValue`, `TNumberConstValue` and `TConstValue`. A
`static readonly X = '12h'` member has a widening literal type; without `& {}`, a value copied into an object
literal (`rows.map(r => ({ value: r.value }))`) or a `let` widened to `string` or `number` and no longer fit
the union. With it the union is unchanged (`'12h' | '24h'`), a member declared `: string` still gives
`string`, and the result stays assignable to `string` or `number`. A template literal was rejected because it
turns numbers into strings. The narrow break: an inferred variable later assigned a non-member string no longer
compiles. Type tests: `packages/kernel/src/__tests__/common/types.test.ts`.

## Why

A string-literal union only exists at compile time - there is nothing to iterate, log, or validate
against at runtime. A const class gives both: the values are real runtime properties (usable in a
`Set`, a `switch`, a loop) and `TConstValue<typeof X>` derives the exact literal union for typing,
so the two never drift apart.

## Real examples in source

`RequestCountData` in `packages/kernel/src/common/constants.ts` is the smallest form - two
`static readonly` values plus `SCHEME_SET` and `isValid`, typed at the use site as
`TConstValue<typeof RequestCountData>`.

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

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

// packages/kernel/src/common/types.ts
export type TRequestType = TStringConstValue<typeof RequestTypes>;
```

All four prebuilt unions (`TRequestType`, `TRequestBodyType`, `TRequestMethod`, `TEnvironment`) are
`TStringConstValue` of their class and inherit the `& {}`. `TLogLevel` (from `LogLevels`) and
`TNumberParseMethod` (from `NumberParseMethods`) are `TConstValue` of theirs.

The value type is a closed union - no `| (string & {})` escape - because ARDOR owns this vocabulary
(see [narrowing authority](/conventions/narrowing-authority.md)). The `Extract<..., string>` inside
`TStringConstValue` drops `SCHEME_SET`, `isValid` and `prototype` from the union by type.

Every const class carries the `SCHEME_SET` plus `isValid(value: string)` pair: `RequestMethods`,
`RequestTypes`, `RequestBodyTypes`, `Environments`, `RequestCountData`, `RequestChannel`,
`Authentication`, `LocalStorageKeys`, `LogLevels` and `NumberParseMethods`. A new one does too, and
names the `isValid` parameter `value`. Two are exempt: `HeaderConstants`, the names behind the
[header protocol](/architecture/header-protocol.md), also holds regexes, and `App` holds runtime
defaults, so neither has a `SCHEME_SET` or `isValid()`.

## Related

- [Binding key namespaces](/conventions/binding-key-namespaces.md)
- [Coding style](/conventions/coding-style.md)
- [Narrow only what the framework owns](/conventions/narrowing-authority.md)
- [Options objects](/conventions/options-objects.md)
