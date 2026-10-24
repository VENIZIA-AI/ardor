---
title: Correctness fixes in the kernel, the admin and the hooks
description: Number parsing reads text as 0 instead of NaN and a float keeps its decimal point, and a series of smaller fixes in the data providers, the network service and the React hooks.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## Correctness fixes in the kernel, the admin and the hooks

<Badge type="info" text="Bug Fix" />

**In one line.** A series of small fixes where the code did not do what its documentation said; none changes a public signature.

## What changed

- **Number parsing.** `toInteger` and `toFloat` return `0` for text that is not a number, as documented, instead of `NaN`. `getNumberValue` with `NumberParseMethods.FLOAT` keeps the decimal point: `'10.50'` reads `10.5`, not `1050`. The integer method still strips dots, so `'1.234'` reads `1234`.

## Who is affected

- **Code that relied on `NaN` from `toInteger` or `toFloat`.** It now gets `0`.
- **Code that parsed a decimal with `getNumberValue` and `FLOAT`.** It now gets the decimal; the old result was a number 100 times too large for two decimals.
