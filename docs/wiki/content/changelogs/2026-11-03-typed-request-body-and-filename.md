---
title: RequestBodyEncoder types its body, and ResponseReader reads a file name
description: encode returns a FormData, a URLSearchParams or the body you passed, and readFilename returns the name in a Content-Disposition header.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-03

## RequestBodyEncoder types its body, and ResponseReader reads a file name

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" />

**In one line.** `RequestBodyEncoder.encode` now says what body it built, so a `FormData` goes to an API that takes `string | object` without a cast, and `ResponseReader.readFilename` gives you the file name of a download.

The example is in [Encode a body and read a file name yourself](../references/network#encode-a-body-and-read-a-file-name-yourself).

## What changed

- **A typed body.** `encode({ bodyType, body })` returns `body: FormData` for `form-data` and `body: URLSearchParams` for `x-www-form-urlencoded`. For `json`, `none`, `binary` or no `bodyType` it returns the body you passed, with its type. A `bodyType` that is only a `string` still gives `body: unknown`. Nothing changes at run time.
- **`ResponseReader.readFilename({ headers })`.** It returns the name in `Content-Disposition`, `filename*=` (UTF-8, decoded) before `filename=`, or `undefined`. `ResponseReader.read` still returns the name as `filename` and behaves as before.

## Who is affected

- **An app or a subclass of `DefaultNetworkRequestService` that calls `RequestBodyEncoder.encode`.** No action needed. If your code assigned the `body` to a variable typed `unknown`, it still compiles.
- **An app that parsed `Content-Disposition` itself.** You can call `ResponseReader.readFilename` instead.

See [Network](../references/network#encode-a-body-and-read-a-file-name-yourself).
