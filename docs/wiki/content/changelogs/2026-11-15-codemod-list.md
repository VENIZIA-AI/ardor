---
title: ardor codemod --list prints the codemod names
description: The ardor command now prints the name of each codemod with ardor codemod --list, so a script or a tool can check a name before it runs it.
packages: ['@venizia/ardor']
---

# Changelog - 2026-11-15

## ardor codemod --list prints the codemod names

<Badge type="tip" text="Enhancement" />

**In one line.** `ardor codemod --list` prints the name of each codemod, one per line, and exits 0. Today the only name is `namespace`.

```bash
bun run ardor codemod --list
```

## Who is affected

A script or a tool that needs to know which codemods the installed version has, before it runs `ardor codemod <name>`. Other apps need no change. `ardor codemod namespace` behaves as before.
