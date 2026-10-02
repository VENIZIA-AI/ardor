---
title: HttpRepository writes and shares the data provider's auth; BaseCrudService is gone
description: HttpRepository writes on IGNIS 0.2.1, shares the data provider's token and one 401 refresh, and replaces BaseCrudService. Providers bind as singletons.
---

# Changelog - 2026-10-02

## HttpRepository writes and shares the data provider's auth; BaseCrudService is gone

<Badge type="danger" text="Breaking" />

**In one line.** `HttpRepository` from `@venizia/ardor/repository` now writes as well as reads. It shares the data provider's token and its single 401 refresh, and it replaces `BaseCrudService`, which is removed. ARDOR builds on the IGNIS `0.2.1` prerelease line (`next`).

## What changed

- **Writes.** `HttpRepository` re-exports IGNIS connectors `0.2.1-2` unchanged, so it gains the writes:

| Call | Request |
|---|---|
| `create({ data })` | `POST /{resource}` |
| `updateById({ id, data })` | `PATCH /{resource}/{id}` |
| `updateBy({ where, data })` (also `updateAll`) | `PATCH /{resource}`, `where` in the body |
| `deleteById({ id })` | `DELETE /{resource}/{id}` |
| `deleteBy({ where })` (also `deleteAll`) | `DELETE /{resource}`, `where` in the body |

- **What a write answers.** Each write answers `{ count, data }`. `count` comes from the server's `x-response-count` header, and `options: { shouldReturn: false }` answers `data: null`.
- **What a write refuses.** An empty bulk `where` throws before a request is sent. There is no `createAll`.
- **Ids in the URL.** The id is URL-encoded, for reads too.
- **The second type parameter.** `HttpRepository<E, P = Partial<E>>`: `P` is what a write sends.
- **Any other route.** `HttpDataSource.request()` takes a `body` and per-request `headers` on any method, `PUT` included, for routes the verbs do not cover.
- **Peers.** The IGNIS peers move to the 0.2.1 line:

| Package | Before | Now |
|---|---|---|
| `@venizia/ignis-connectors` | `^0.2.0` | `>=0.2.1-2 <0.3.0` |
| `@venizia/ignis-kernel` | `^0.2.0` | `>=0.2.1-1 <0.3.0` |
| `@venizia/ignis-filter`, `-helpers` | `^0.2.0` | `>=0.2.1-0 <0.3.0` |
| `@venizia/ignis-inversion` | `^0.2.0` | unchanged |

- **A long `getMany` reads through the body.** Once the encoded filter passes 6,000 characters, `getMany` sends `POST /{resource}/find` with `{ filter }` instead of a `GET`, which used to draw `414`/`431` at about 400 UUIDs. IGNIS controllers answer that route from `0.2.1-2`. Shorter lists stay on the `GET`. `HttpRepository` does the same for `find`, `findOne`, `count` and `existsWith`.
- **Error arguments.** A repository error now carries the server's `normalized.args`, so `useNotifyError` fills a translated message's placeholders.

`^0.2.0` does not admit a prerelease, so with the old peers a workspace kept a second, older copy of each IGNIS package beside the new one. The new ranges accept every 0.2.x stable from 0.2.1 on, and refuse 0.3.0.

- **Shared auth.** `DefaultNetworkRequestService.getDataSourceAuth()` returns `{ authTokenResolver, onUnauthorized }` (`IDataSourceAuth`). Spread it into an `HttpDataSource`, and the repository sends the data provider's token, including one set with `setAuthToken`. A burst of `401`s across the data provider and any repository then calls `refreshToken` once, and runs `onAuthFailure` once if that refresh fails. `resolveAuthToken()` is public: it is the token without a header built around it.
- **Framework bindings are declared with `@configuration` + `@provide`.** A `@configuration()` class holds one `@provide({ key })` method per binding, and `registerArtifacts()` binds each provided key as lazy and singleton - one data provider serves react-admin, `DefaultAuthProvider`, every hook and every datasource. The reason: a bare `bind().toProvider()` in `bindContext()` is transient, so each consumer got its own data provider, each with its own network service. Measured on a started application with that wiring: `locale=null` on react-admin's request, and a repository request with no `authorization` header.

### Removed

- **`BaseCrudService`, `ICrudServiceOptions`, `ICrudService`, `IService` and `EntityRelationType`.** `BaseCrudService` took positional arguments (`findById(id, filter)`), and its `updateAll` sent `where` in the query string, which an IGNIS bulk route answers with a `400`. Nothing in ARDOR or BANA used it. Use an `HttpRepository`.

## Who is affected

- **Code that imported `BaseCrudService` or `ICrudService`.** Extend `HttpRepository` instead. `find({ filter })`, `findById({ id })`, `count({ where })`, `create({ data })`, `updateById({ id, data })`, `updateBy({ where, data })` and `deleteById({ id })` cover what it did, with options objects. `replaceById` (PUT) has no verb: send it with `dataSource.request({ method: 'PUT', ... })`.
- **Every application that binds the default providers with a bare `bind()` in `bindContext()`.** Move those bindings into a `@configuration()` class: one `@provide({ key })` method per framework key, imported before `application.start()`. `registerArtifacts()` binds each provided key, singleton. An override of a provided key can stay in `bindContext()`.
- **Applications with an `HttpDataSource` and auth recovery.** Inject the data provider and spread `getNetworkService().getDataSourceAuth()` into the datasource settings. See [auth recovery](../best-practices/auth-recovery#where-tokens-live).
- **Applications on IGNIS `0.2.0`.** Move `@venizia/ignis-connectors` to `0.2.1-2`, `kernel` to `0.2.1-1`, and `filter` and `helpers` to `0.2.1-0`, together with ARDOR. Until IGNIS 0.2.1 is stable they install from `next`.
- **Servers older than IGNIS `0.2.1-2`, or not IGNIS.** A `getMany` or repository read long enough to leave the URL answers `404` there, because `POST /{resource}/find` does not exist. Add the route, or keep id lists short.
- **Code that matches a failed read by its message.** A failed request now throws with the server's message after the URL, `[http][read] 404 | <url> | Ticket not found`, and with the server's `normalized.code` and `normalized.args`. Match on the status or the code instead.
- **A server-side order entry with more than two tokens, or an empty one,** is now a `400` on an IGNIS backend. ARDOR's data provider always sends two (`field ASC`), so nothing changes there.

See [Repositories](../references/repository#writes).
