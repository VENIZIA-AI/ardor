---
title: BrowserClipboard writes and reads the clipboard outside React
description: BrowserClipboard.writeText and readText answer false or undefined on every refusal; useCopyToClipboard calls it and no longer throws on a server.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## BrowserClipboard writes and reads the clipboard outside React

<Badge type="tip" text="New Feature" />

**In one line.** `BrowserClipboard.writeText({ text })` and `BrowserClipboard.readText()` write and read the text on the clipboard from any code, a service, a util or a toast action, and answer `false` or `undefined` where the browser refuses. They never throw and never reject.

The example is in [Browser clipboard](../references/index#browser-clipboard).

## What changed

- **`BrowserClipboard.writeText({ text })`** answers `true` when the text is on the clipboard.
- **`BrowserClipboard.readText()`** answers the text, or `undefined`. Reading needs a permission and a user gesture, and some browsers do not offer it, so `undefined` is a normal answer.
- **Every refusal is an answer, not an error.** No `navigator` (a server render), no `navigator.clipboard` (an insecure context, an old WebView), a denied permission, no user gesture, a document that is not focused, and a thrown error all give `false` or `undefined`.
- **No fallback and no logging.** The helper does not use `document.execCommand('copy')` (deprecated, needs a DOM node) and logs nothing, so the caller decides what to show.
- **`useCopyToClipboard` calls the helper.** It returns `{ copy, isCopied }` (see [the `isCopied` entry](./2026-11-04-copy-is-copied)), and still logs a warning when the text is not copied. It also no longer throws a `ReferenceError` where `navigator` is not declared, such as a server render.

## Who is affected

- **An app that calls `navigator.clipboard` itself outside React**, with its own handling of the cases above. You can call `BrowserClipboard` instead and delete that handling.
- **An app that renders `useCopyToClipboard` on a server.** `copy` now resolves `false` there instead of throwing.
- **All other apps.** No action needed.

See [Browser clipboard](../references/index#browser-clipboard) and [Hooks](../references/hooks#usecopytoclipboard).
