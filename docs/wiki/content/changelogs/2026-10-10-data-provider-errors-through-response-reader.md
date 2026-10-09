---
title: The data provider throws an ApplicationError, and reads Content-Range like IGNIS
description: A failed request through the REST data providers now rejects with an ApplicationError instead of the raw response body, and a malformed Content-Range falls back to the row count.
---

# Changelog - 2026-10-10

## The data provider throws an ApplicationError, and reads Content-Range like IGNIS

<Badge type="warning" text="Behavior Change" />

**In one line.** On a non-2xx response `DefaultRestDataProvider`, `CountRestDataProvider` and `send` now reject with an `ApplicationError` built from the server's error envelope, where they used to rethrow the parsed body; the list total comes from the same IGNIS reader.

## What changed

- **A real error.** `doRequest` reads the body with IGNIS `HttpResponseReader.readError`, under the `error` root key, and throws an `ApplicationError` (from `@venizia/ignis-inversion`, an `Error`). It is mapped like IGNIS `HttpDataSource`, so a repository and the data provider throw the same fields. `useNotifyError` already typed its argument as an `ApplicationError`; it now gets one.
- **What the fields hold.**
  - `statusCode` is the HTTP status, always set.
  - `message` and `normalized.text` are the server's `normalized.text`, else its `message`, else `HTTP <status>`. Unlike `HttpDataSource`, `message` is the server's text and not a log line, because react-admin shows `error.message`.
  - `normalized.code` is the server's code, lower-cased, or `core.system_error` when it sent none. `normalized.args` is the server's `args` or `{}`.
  - `extra` is the server's `extra` plus `requestId`, and `undefined` when both are empty. A relaying server's earlier `extra.requestId` moves to `extra.upstreamRequestIds`, nearest first.
  - `cause` is the server's `details.cause`, such as a `422`'s per-field issues.
- **What is dropped.** Any other key of the body (`type`, `path`, `url`, the rest of `details`, ad hoc fields such as `field`), and the top-level `requestId`, which is in `extra.requestId` now.
- **Bodies that are not an envelope.** A body that is not JSON, is empty, is an array, or holds a string under `error` no longer leaks a `SyntaxError` or throws a bare string. It becomes `HTTP <status>` with the default code.
- **`Content-Range`.** `convertResponse` reads the total with `HttpResponseReader.parseContentRange` for `getList` and `getManyReference`. `records a-b/N` and `records */N` give `N`, and an absent header gives the page's row count, as before. A malformed header now gives the row count too.

| `Content-Range` | `total` before | `total` now |
|---|---|---|
| `records 0-24/137` | 137 | 137 |
| `records */137` | 137 | 137 |
| (absent) | row count | row count |
| `records 0-24/*` | `NaN` | row count |
| `137` | 137 | row count |
| (empty string) | `NaN` | row count |

## Who is affected

- **Code that reads `error.statusCode`, `error.normalized.code`, `error.normalized.args` or `error.extra`.** No action needed.
- **Code that reads `error.requestId`.** Read `error.extra?.requestId`.
- **Code that reads `type`, `path`, `url`, `details` or an ad hoc field off a caught error.** These are no longer on it. `details.cause` is `error.cause`.
- **Code that checks for a string, or catches a `SyntaxError`, from a failed request.** An error body that is not an envelope is an `ApplicationError` with `HTTP <status>`.
- **A `checkError` that matches on `status`.** An `ApplicationError` has `statusCode` and no `status`, so a server body that carried a `status` key no longer reaches `DefaultAuthProvider.checkError` as one. The IGNIS envelope sends `statusCode`, which `checkError` does not read.
- **Lists whose server sends a malformed `Content-Range`.** `total` is the page's row count instead of `NaN`. Fix the header, or use `CountRestDataProvider`.

## Breaking changes

> [!WARNING]
> Narrow: only code that reads a field the old body carried but the envelope does not, or that depends on the thrown value not being an `Error`.

**Before:**

```typescript no-check
// The server answered 409 with:
// { error: { statusCode: 409, message: 'Order already paid', requestId: 'req-1', type: 'ConflictError' } }
// ...
try {
  await dataProvider.update('orders', { id: 7, data, previousData });
} catch (error) {
  // `error` was the parsed `error` object, whatever it held
  error.requestId; // 'req-1'
  error.type; // 'ConflictError'
  error instanceof Error; // false
  const copy = { ...error }; // has `message`
}
```

**After:**

```typescript no-check
// The same response
// ...
try {
  await dataProvider.update('orders', { id: 7, data, previousData });
} catch (error) {
  // `error` is an ApplicationError
  error.statusCode; // 409
  error.message; // 'Order already paid'
  error.extra?.requestId; // 'req-1'
  error.type; // undefined: dropped
  error instanceof Error; // true
  const copy = { ...error }; // no `message`: an Error keeps it as a non-enumerable own property
}
```

## Migration guide

1. Replace `error.requestId` with `error.extra?.requestId`.
2. Replace a read of `error.details.cause` with `error.cause`. The other `details` keys, `type`, `path` and `url` are not on the error.
3. If you spread an error to copy it (`{ ...error }`), copy `message` explicitly: `{ ...error, message: error.message }`.
4. If a `catch` branch tested `typeof error === 'string'` or `error instanceof SyntaxError` for a failed request, test `error.statusCode` instead.

## Details

- The mapping lives in `toResponseError` in `packages/kernel/src/base/services/network-request.ts`. `ERROR_ROOT_KEY` (`'error'`) is the same key `getDataSourceAuth()` hands an `HttpDataSource`.
- A body without the `error` key is read as it stands, so `{ message: 'Validation failed' }` still gives that message.
- The tests are in `packages/kernel/src/__tests__/base/services/network-request.test.ts`.

| File | Package |
|------|---------|
| `src/base/services/network-request.ts` | kernel |
| `src/__tests__/base/services/network-request.test.ts` | kernel |

See [Network](../references/network#error-shape-on-non-2xx) and [Data provider](../references/data-provider#totals).
