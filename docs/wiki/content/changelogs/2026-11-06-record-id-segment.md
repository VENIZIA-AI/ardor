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
- **`.` and `..` are rejected.** They are dot segments even when encoded, so the call rejects before any request.

- **`doRequest` refuses a path that leaves the base.** A path with a `.` or `..` segment (also written `%2E`), a backslash, or a leading `//` rejects with `[doRequest] Invalid path to send request!` before any request.

## Who is affected

- **An app whose ids hold `/`, `?`, `#` or `%`.** Your server now receives them encoded: a framework that decodes path parameters, such as an IGNIS server, hands the route the original id. A server that does not decode must do so.
- **All other apps.** No action needed.
