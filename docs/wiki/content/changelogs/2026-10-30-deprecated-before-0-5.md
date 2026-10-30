---
title: Symbols nothing uses, and the kernel logger, are deprecated for 0.5
description: A few kernel and react exports are marked deprecated and stay until 0.5; the kernel logger classes point to IGNIS's.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react']
---

# Changelog - 2026-10-30

## Symbols nothing uses, and the kernel logger, are deprecated for 0.5

<Badge type="warning" text="Behavior Change" />

**In one line.** Some exports are marked `@deprecated`: your editor strikes them through and says what to use instead. Nothing is removed or changes behaviour now; they go in 0.5.

## What changed

| Deprecated | Use instead |
|---|---|
| `Logger`, `LogLevels`, `ILogger`, `TLogLevel`, `BaseHelper` of `@venizia/ardor-kernel` | the same names from `@venizia/ignis-helpers/core` (`ConsoleLogger` for the logger, the one a browser bundle can reach) |
| `HeaderConstants.REQUEST_DEVICE_INFO`, `HeaderConstants.RESPONSE_FORMAT` | nothing: ARDOR sends and reads neither header |
| `App.DEFAULT_LOCALE` | nothing: the i18n provider defaults to `en` |
| `isEditableTarget` | check the event target in your own code |
| `NumberIdType`, `StringIdType`, `NullableType`, `TDataCount<T>` | `number`, `string`, `undefined \| null`, the shape you need |
| `ISyncFC<TProps>` of `@venizia/ardor-react` | `(props: TProps) => ReactNode` |

`BaseService` still extends the kernel's `BaseHelper` and `useApplicationLogger` still returns the kernel's `Logger`: both keep working until 0.5.

## Who is affected

- **An application or a package that imports one of these.** No action is needed now. Switch before 0.5 (the table above), or tell us if you need one to stay.
- **Everyone else.** No action needed.
