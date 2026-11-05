---
title: ISendResponse and IListFilter.offset are removed
description: ISendResponse was a second name for INetworkResponse, and IListFilter.offset an alias of skip; both are removed, and the codemod renames or lists them.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-05

## ISendResponse and IListFilter.offset are removed

<Badge type="warning" text="Breaking Change" />

**In one line.** `ISendResponse<T>` is removed; use `INetworkResponse<T>`, the same type. `IListFilter.offset` is removed; use `skip`. Neither is kept as an alias.

```diff
-import type { ISendResponse } from '@venizia/ardor';
+import type { INetworkResponse } from '@venizia/ardor';

-const reply: ISendResponse<Product[]> = await dataProvider.send({ resource, params });
+const reply: INetworkResponse<Product[]> = await dataProvider.send({ resource, params });

-const filter: IListFilter = { where: {}, offset: 20 };
+const filter: IListFilter = { where: {}, skip: 20 };
```

## What changed

- **`ISendResponse` is gone** from `@venizia/ardor-kernel` and `@venizia/ardor`. It was `INetworkResponse`; `IDataProvider.send` now names `INetworkResponse<TResult>` in its signature, which is the same type.
- **`IListFilter.offset` is gone.** `skip` is the field `ListFilterBuilder.build` sets, and nothing in ARDOR read `offset`. A list filter still carries any other key you put on it.
- **The codemod follows.** `ardor codemod namespace --write` renames `ISendResponse` to `INetworkResponse` in your imports and uses. It cannot tell a list filter from another object without types, so in a file that imports `IListFilter` or `ListFilterBuilder` it lists each `.offset` with its line, and `--check` exits 1 until you change it to `skip`.

## Who is affected

- **An app that names `ISendResponse`.** Run `bun run ardor codemod namespace src --write`, or replace the name by hand.
- **An app that sets or reads `offset` on a list filter.** Use `skip`.
- **All other apps.** No action needed.

See [Upgrading ARDOR](../guides/migrations/upgrading-ardor).
