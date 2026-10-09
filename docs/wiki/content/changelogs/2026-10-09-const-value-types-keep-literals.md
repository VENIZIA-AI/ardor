---
title: Const-value types keep their literals when copied
description: TConstValue, TStringConstValue, TNumberConstValue and TStatusFromClass no longer widen to string or number when a value is copied into an object literal or a let.
---

# Changelog - 2026-10-09

## Const-value types keep their literals when copied

<Badge type="warning" text="Behavior Change" />

**In one line.** A value typed with `TConstValue` and its siblings now keeps its literal union when you copy it into an object literal or a `let`, instead of widening to `string` or `number`.

## What changed

- **The types.** `TStatusFromClass`, `TStringConstValue`, `TNumberConstValue` and `TConstValue` now end with `& {}`.
- **Why.** A `static readonly X = '12h'` member has a widening literal type. The old `Extract<ValueOf<T>, string>` kept it widening, so `rows.map(row => ({ value: row.value }))` produced `{ value: string }` and the result no longer fit `'12h' | '24h'`. `& {}` makes the literals regular.
- **What stays the same.** The union itself is unchanged (`'12h' | '24h'`). A member declared `: string` still gives `string`. The result is still assignable to `string` or `number`.
- **Who benefits.** `TRequestMethod` and `TEnvironment` are built on `TStatusFromClass`. `TRequestType` and `TRequestBodyType` are now `TStringConstValue` of their class instead of a plain `Extract`. All four keep their literals.

## Who is affected

- **Most code.** No action needed.
- **Code that relied on the widening.** A variable inferred from one of these types and later assigned a string that is not a member now fails to compile. Annotate it as `string` if it is meant to hold any string.
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

## Details

- A template literal such as `` `${...}` `` was rejected: it turns numbers into strings.
- The type tests are in `packages/kernel/src/__tests__/common/types.test.ts`.

| File | Package |
|------|---------|
| `src/common/types.ts` | kernel |
| `src/__tests__/common/types.test.ts` | kernel |

See [Types and constants](../references/types#tstatusfromclass-and-tconstvalue).
