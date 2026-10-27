---
title: The size cost of strictExecutionOrder is documented
description: The Vite setup guide now says what output.strictExecutionOrder costs, that the ordering class is still reproducible on Vite 8.3.5, how to measure the cost for an app and when it is safe to turn the flag off; the preset keeps it on.
packages: []
---

# Changelog - 2026-10-27

## The size cost of strictExecutionOrder is documented

<Badge type="info" text="Documentation" />

**In one line.** The preset keeps `output.strictExecutionOrder: true`, and the Vite setup guide now states what it costs, how to measure it for your app and when it is safe to turn it off. Nothing changes in the preset or the packages. Planned for 0.4.5.

## What changed

- **The cost.** About +3.4% gzip on a small four-chunk app; more on an app with hundreds of lazy chunks (a team measured 5 to 8% raw and 10 to 12% gzip).
- **The upstream status.** One reported ordering case was fixed in Vite 8.0.6; the class is by design, and a four-file case still fails on Vite 8.3.5 with the flag off.
- **How to decide.** Build with the flag on and off, compare the sizes, open the built app in a browser, and turn it off only with a built-app check in CI.

## Who is affected

- **An app from the preset.** Nothing to do.
- **A large app that wants the size back.** Follow "Decide for your app" in [Vite setup](../guides/get-started/vite-setup).
