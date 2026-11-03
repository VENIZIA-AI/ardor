---
title: The fetcher no longer logs secrets, and four request bugs are fixed
description: NodeFetcher stops logging request headers and bodies, keeps your abort signal with a timeout, sends bodies as they are, and joins params to a url with a query.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-24

## The fetcher no longer logs secrets, and four request bugs are fixed

<Badge type="danger" text="Security" /> <Badge type="info" text="Bug Fix" />

**In one line.** `NodeFetcher`, the one HTTP fetcher of `@venizia/ardor-kernel`, no longer prints the Authorization header and the request body to the browser console, and three smaller request bugs are fixed.

## What changed

- **No secrets in the console.** `send` logged the whole request at info level: every header, an Authorization token included, and the body, the sign-in password included. It now logs at debug level, never logs the body, and redacts the headers.
- **A timeout keeps the caller's signal.** With a `timeout` set, the `signal` you passed was dropped, so you could not cancel the request. The two are now combined: the request aborts on either, also when your signal was already aborted.
- **Bodies are sent as they are.** A `Blob`, an `ArrayBuffer`, a typed array or a `ReadableStream` was sent as `{}` or as an object of its indexes, and a string was encoded a second time. They now go out unchanged; a plain object or array is still JSON-encoded.
- **Params on a url with a query.** `params` were appended with `?` even when the url already had a query string. They are now joined with `&`, and an empty `params` leaves the url as given.

## Who is affected

- **Every application on ARDOR 0.4.0 or older.** Update `@venizia/ardor` (or `@venizia/ardor-kernel`) to 0.4.1 or newer. Until then, do not turn on a console that is collected or shared (a remote log collector, a screen recording of the console): it holds the tokens and passwords of the requests the app made.
- **Code that sent a string body expecting it to be quoted.** A string body is now sent as it is. Pass an object to have it JSON-encoded, or the exact text you want sent.
