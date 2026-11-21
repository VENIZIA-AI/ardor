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

A const class whose statics are only its values extends `ConstClass` from
`@venizia/ignis-helpers/common`. It reads its own values with `X.values()` (base class first) and checks
a candidate with `X.isValid(value)`, which narrows `value` to the union. It keeps no set and no
`isValid` of its own. `RequestTypes` in `packages/kernel/src/common/constants.ts`:

```typescript
import { ConstClass } from '@venizia/ignis-helpers/common';

export class RequestTypes extends ConstClass {
  static readonly SEND = 'SEND';

  // react-admin
  static readonly GET_LIST = 'GET_LIST';
  static readonly GET_ONE = 'GET_ONE';
  // ... GET_MANY, GET_MANY_REFERENCE, CREATE, UPDATE, UPDATE_MANY, DELETE, DELETE_MANY
}

// packages/kernel/src/common/types.ts
export type TRequestType = TStringConstValue<typeof RequestTypes>;
```

`ConstClass` is imported from the `/common` subpath, never from the helpers root barrel: the root
loads Node built-ins, and the browser packages import this class. ARDOR does not re-export it.

All four prebuilt unions (`TRequestType`, `TRequestBodyType`, `TRequestMethod`, `TEnvironment`) are
`TStringConstValue` of their class and inherit the `& {}`.

The value type is a closed union - no `| (string & {})` escape - because ARDOR owns this vocabulary
(see [narrowing authority](/conventions/narrowing-authority.md)). The `Extract<..., string>` inside
`TStringConstValue` drops the methods and `prototype` from the union by type.

`RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `Environments`, `RequestCountData`,
`RequestChannel` and `UnresolvedPolicies` (`@venizia/ardor/vite`) extend `ConstClass`; a new class
of only values does too. A class with more than its values keeps its own shape: `LocalStorageKeys`
has a `SCHEME_SET` of the three session keys (the prefixes are not in it) and `scoped()`, and
`CodemodFlags` has a set that leaves out `--hooks` and an `isValid` that takes `extraFlags`. `App`
holds runtime defaults, so it has neither.

A list of property names is not a value domain, so it stays a `Pick` or an `as const satisfies ReadonlyArray<keyof T>` list: `Pick<DataProvider, 'getList' | ...>` and `ArtifactIndexKinds` name keys of an interface, and the compiler checks them against it, which a const class would lose.

## Related

- [Binding key namespaces](/conventions/binding-key-namespaces.md)
- [Coding style](/conventions/coding-style.md)
- [Narrow only what the framework owns](/conventions/narrowing-authority.md)
- [Options objects](/conventions/options-objects.md)
