---
title: The REST data provider sends the record id as one path segment
description: getOne, update and delete percent-encode the id, so an id with a slash, a question mark or a hash reaches the server whole; doRequest refuses dot segments.
packages: ['@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-06

## The REST data provider sends the record id as one path segment

<Badge type="info" text="Bug Fix" />

**In one line.** `getOne`, `update` and `delete` of `DefaultRestDataProvider` now percent-encode the record id, so `/posts/a%2Fb` carries the id `a/b` instead of a path of two segments.

## What changed

- **The id is encoded.** An id with `/`, `?`, `#`, a space or `%` is sent as one segment. A numeric or a UUID id is unchanged.
- **`.`, `..` and a lone surrogate are rejected.** The first two are dot segments even when encoded, and a lone surrogate cannot be encoded, so the call rejects before any request.

- **`doRequest` refuses a request that leaves the base.** A `paths` entry with a control character, `?`, `#`, a backslash or a `.` or `..` segment (also written `%2E`), and any request whose resolved URL has another origin than `baseUrl` or a path outside it (a base of `/` with a `//` joined in front of a name, for example), rejects with `[doRequest] Invalid path to send request!` before any request. Query parameters go in `query`, not in `paths`.

## Who is affected

- **An app whose ids hold `/`, `?`, `#` or `%`.** Your server now receives them encoded: a framework that decodes path parameters, such as an IGNIS server, hands the route the original id. A server that does not decode must do so.
- **All other apps.** No action needed.
