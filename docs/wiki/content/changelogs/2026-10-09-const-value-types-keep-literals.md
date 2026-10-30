---
title: Const-value types keep their literals when copied
description: TConstValue, TStringConstValue, TNumberConstValue and TStatusFromClass keep their literals when copied into an object literal or a let.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-09

## Const-value types keep their literals when copied

<Badge type="warning" text="Behavior Change" /> <Badge type="warning" text="Breaking Change" />

**In one line.** A value typed with `TConstValue` and its siblings now keeps its literal union when you copy it into an object literal or a `let`, instead of widening to `string` or `number`.

## What changed

- **The types.** `TStatusFromClass`, `TStringConstValue`, `TNumberConstValue` and `TConstValue` keep the literal members of a class's `static readonly` values. `rows.map(row => ({ value: row.value }))` now gives `{ value: '12h' | '24h' }`, not `{ value: string }`.
- **What stays the same.** The union itself is unchanged. A member declared `: string` still gives `string`. The result is still assignable to `string` or `number`.
- **Also affected.** `TRequestMethod`, `TEnvironment`, `TRequestType` and `TRequestBodyType` keep their literals too.

## Who is affected

- **Most code.** No action needed.
- **Code that relied on the widening.** A variable inferred from one of these types and later assigned a string that is not a member now fails to compile. Annotate it as `string` if it must hold any string.
- **Tests that compare against a non-member.** `expect(value).toBe('other')` no longer compiles when `value` has one of these types. Write `expect<string>(value).toBe('other')`.

## Breaking changes

> [!WARNING]
> Narrow: only code that leaned on the old widening is affected.

**Before:**

```typescript no-check
// TimeModes has static readonly HALF_DAY = '12h' and FULL_DAY = '24h'
declare const modes: TConstValue<typeof TimeModes>[];
// ...

let current = modes[0]; // string
current = 'any text'; // compiled
```

**After:**

```typescript no-check
declare const modes: TConstValue<typeof TimeModes>[];
// ...

let current = modes[0]; // '12h' | '24h'
current = 'any text'; // error: not assignable to '12h' | '24h'

let anyText: string = modes[0]; // write the wider type when you mean it
```

See [Types and constants](../references/types).
