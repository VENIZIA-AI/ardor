---
type: Convention
title: Error handling
description: Use getError and ApplicationError, never raw new Error, and check errors by shape.
resource: packages/kernel/src/common/constants.ts
tags: [conventions, errors]
---

Never throw a raw `new Error(...)`. Use `getError(opts: TError)` from `@venizia/ignis-inversion`
(or `ApplicationError.getError`). It builds an `ApplicationError`: a `message`, a `statusCode`
(defaults to `400`), a `normalized` message, and an optional `extra` payload.

The error module lives in `@venizia/ignis-inversion`, the same DI package that underpins
[DI in the browser](/architecture/di-in-the-browser.md). ARDOR is a browser application with no
server process behind it, but it still shares this error shape with every layer that touches
inversion - services, providers, hooks - so a failure raised deep in a data provider request looks
identical to one raised while booting the application container.

```typescript
throw getError({
  message: `Service ${cls.name} constructor parameter ${index} has no @inject`,
});
```

## Catalogue a domain failure, raise the rest free-form

The form above is right for a failure nobody translates: an invariant, a misconfiguration, a
missing binding. A **domain** failure - one a component localizes and branches on, like an auth
recovery step failing or a REST data provider request being rejected - is declared once as a
`TErrorDefinition`, then raised by reference:

```typescript
export const AuthErrors = {
  RECOVERY_TOKEN_EXPIRED: {
    message: {
      text: 'Your recovery link has expired.',
      code: 'client.auth.recovery.token_expired',
    },
    statusCode: 401,
  },
} as const satisfies Record<string, TErrorDefinition>;

throw getError({ error: AuthErrors.RECOVERY_TOKEN_EXPIRED });
```

A definition nests `message: { text, code, args? }` - the SAME shape the free-form input and
`normalized` use. That is why spreading one (`getError({ ...AuthErrors.X })`) resolves identically
to passing it as `error`, instead of silently degrading the way an older `key` shape did.

Retyping the code and status at each throw is how two call sites end up raising
`auth.recovery.expired` and `auth.recovery_expired` for the same failure, with nothing to catch the
drift.

`message.code` MUST be a literal string, not built dynamically - see
[gotchas](/conventions/gotchas.md). This is the one place a raw literal code is correct.

## Every ApplicationError carries `normalized`

`normalized = { text, code, args }` is always built, every field always populated, and it is the
ONLY home for the code and the interpolation args. `useNotifyError` renders any error with one
lookup on `error.normalized.code`, letting [i18n](/architecture/i18n.md) resolve the message from
the translation table. Pass `transform` to build `normalized` yourself from a snapshot
(`{ message: TErrorNormalized, statusCode, extra }`):

```typescript
transform: snapshot => ({ ...snapshot.message, text: renderVi(snapshot.message) });
```

The originating side never substitutes `%{name}` into the text - it ships the template plus `args`
and the RENDERING side (the notification hook, or a component) translates. That is why the input
carries `args` rather than a pre-formatted string.

`messageCode` and `messageArgs` are INPUTS only. There is no flat `error.messageCode` field and
`extra` never mirrors `messageArgs`. Read `normalized.code` / `normalized.args`.

## Unknown keys ride into `extra`

The input carries an index signature, so any key `getError` does not model lands in `extra` - that
is how a throw site attaches context the framework knows nothing about, for example a failed
[data provider pipeline](/architecture/data-provider-pipeline.md) request attaching the resource
and the request type it was handling.

```typescript
throw getError({ message: 'Cannot delete record', details: { resource: 'orders', count: 3 } }); // -> extra.details
throw getError({ message: 'Provider init failed', cause: originalError });                       // -> Error.cause
```

The trade, and it is deliberate: an index signature disables excess-property checking, so a
MISSPELLING goes the same way. `getError({ message, statuscode: 503 })` compiles, `statusCode`
stays `400`, and `503` sits in `extra.statuscode`. The framework cannot tell context from typo.

Spreading a definition is safe: `getError({ ...Errors.X })` resolves identically to
`getError({ error: Errors.X })`, because a definition's `message` object IS the free-form input
shape.

`error` is the catalogued form's discriminant and is REFUSED on the free-form branch
(`error?: never`). `getError({ message, error: caughtError })` reads like "wrap this" but `error`
is a consumed key, so the failure would vanish - the compiler now rejects it. Wrap with `cause`.

## Requests carry their own vocabulary, not their own error codes

`RequestMethods`, `RequestTypes`, `RequestBodyTypes` and friends in
`packages/kernel/src/common/constants.ts` describe the shape of a data provider request - the
verb, the record type, the body encoding. They are const classes with a `SCHEME_SET` and
`isValid`, not error catalogs. An invalid method or type surfaces through `getError` with a
`RequestErrors`-style definition, keeping the vocabulary and the failure separate: the constant
classes stay data, the catalog stays the single place a status and a code are paired.

## Log an expected failure below `error`

If a scoped logger is available, an expected failure - a `404`, a `409` a caller retries - should
not be logged at the same level as a real internal failure. Pass `logLevel` to place it correctly:

```typescript
throw getError({ message: 'Record not found', statusCode: 404, logLevel: 'warn' });
```

`logLevel` is one of `error | emerg | warn | info | debug` (`TErrorLogLevel`). An absent or
malformed value falls back to `error`, so nothing changes for call sites that never set it. It does
NOT reach the caller - it only steers where the failure is recorded.

## instanceof across packages is unreliable

There is only ONE `ApplicationError`, and `instanceof` still does not work reliably across a
package or bundling boundary - a CJS build and an ESM build of the same source yield two
constructor functions. Use `isApplicationError()` instead, which recognizes the error by shape:

```typescript
export const isApplicationError = (error: unknown): error is ApplicationError => {
  return error instanceof Error && typeof (error as AnyType).statusCode === 'number';
};
```

Code that must distinguish "an error the framework already shaped" from "a raw failure to
sanitize" - for example a hook deciding whether to wrap a network failure as a generic 503 before
notifying the user - has to use `isApplicationError()`. Skipping it lets a real `404` arrive at the
caller mislabeled as a bogus `503`.

## Never leak internals in a user-facing notification

A notification shown to a user must carry zero internal detail: no stack trace, no raw network
error text, no binding-key internals. Whatever detail is useful for debugging belongs in the
console or a scoped logger, not in the `extra` field surfaced through `useNotifyError`. Sanitize at
the boundary that turns an error into a rendered message, not deeper in the call stack.

## Related

- [Coding style](/conventions/coding-style.md)
- [Error flow](/architecture/error-flow.md)
- [Gotchas](/conventions/gotchas.md)
