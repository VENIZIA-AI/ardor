---
title: The kernel logger is deprecated for 0.5
description: The kernel logger classes and BaseHelper are marked deprecated and stay until 0.5; they point to IGNIS's.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-30

## The kernel logger is deprecated for 0.5

<Badge type="warning" text="Behavior Change" />

**In one line.** The kernel's logger classes and `BaseHelper` are marked `@deprecated`: your editor strikes them through and says what to use instead. Nothing is removed or changes behaviour now; they go in 0.5.

## What changed

| Deprecated | Use instead |
|---|---|
| `Logger`, `LogLevels`, `ILogger`, `TLogLevel`, `BaseHelper` of `@venizia/ardor-kernel` | the same names from `@venizia/ignis-helpers/core` (`ConsoleLogger` for the logger, the one a browser bundle can reach) |

`BaseService` still extends the kernel's `BaseHelper` and `useApplicationLogger` still returns the kernel's `Logger`: both keep working until 0.5.

## Who is affected

- **An application or a package that imports one of these.** No action is needed now. Switch before 0.5 (the table above), or tell us if you need one to stay.
- **Everyone else.** No action needed.
