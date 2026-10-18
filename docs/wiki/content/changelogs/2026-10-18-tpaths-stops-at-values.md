---
title: TPaths stops at a Date, a Set, a function and an any field
description: TPaths no longer names the members of a Date, RegExp, Set, Map, Promise, function or any field as paths, so createdAt.getTime is not a state path.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-18

## TPaths stops at a Date, a Set, a function and an any field

<Badge type="tip" text="Bug Fix" />

**In one line.** `TPaths` treated every object type as a tree, so the members of a value type passed as paths; it now stops at those values (issue #92).

```typescript
import type { TPaths } from '@venizia/ardor';

interface IOrder {
  createdAt: Date;
  tags: Set<string>;
  customer: { name: string };
}

export const accepted: Array<TPaths<IOrder>> = ['createdAt', 'tags', 'customer', 'customer.name'];
```

## What changed

- **A leaf stops the path.** A `Date`, `RegExp`, `Set`, `Map`, `Promise`, function or `any` field is named by its own key only. Before, `createdAt.getTime`, `tags.size` and a path under an `any` field type-checked.
- **Nothing else changes.** Arrays still stop the walk, nested objects are still walked, and the default depth is still 10. `tsc` and `bun check` give the same answer.

## Who is affected

- **A caller that used a path into one of those values.** It no longer compiles; use the key of the field.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `src/common/types.ts` | kernel |
