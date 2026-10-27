---
title: The kernel description says what the kernel holds, and the licence and the READMEs follow the company name
description: The kernel's npm description no longer promises a CRUD base, a socket client or fetchers, the LICENSE files name Venizia Co., Ltd. and list only the libraries ARDOR uses, and every package README carries the VENIZIA credit.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-26

## The kernel description says what the kernel holds, and the licence and the READMEs follow the company name

<Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" />

**In one line.** Three text files of each package changed: the npm description of the kernel stops describing code it no longer has, the LICENSE names the company correctly, and the README ends with the VENIZIA credit. No code changes in this entry. Available in 0.4.4.

## What changed

- **The kernel's `description` and keywords match its code.** It said the kernel holds "CRUD bases" and a "socket client" with "network fetchers". The kernel has no CRUD base, and since 0.4.1 the fetcher and the socket client come from IGNIS (ARDOR carries no socket client). The description now lists the application base on IGNIS inversion, the service and provider bases, the binding keys, the logger, the network request service, runtime config and the HTTP repository from IGNIS; the keyword `crud` is removed. This is what npm shows on the package page and in search.
- **The LICENSE of each package names the company as Venizia Co., Ltd.** The line read "VENIZIA Ltd. Co." The MIT terms are unchanged.
- **The libraries table of each LICENSE lists only what ARDOR uses.** Axios, Socket.IO Client, Radix UI, Lucide, Day.js and the LoopBack credit are removed: no ARDOR package uses them.
- **Each package README ends with a VENIZIA credit** (the logo, light and dark, and one sentence saying the package is part of ARDOR, built and maintained by VENIZIA).

## Who is affected

- **An application on ARDOR.** No action needed. Nothing a build reads changed.
- **A reader of the npm page.** The kernel's page now describes the package as it is.

## Details

- The four packages move to 0.4.4 together, so each carries the new text. The `react` and `admin` packages change only their LICENSE and README.
- The same credit and the shorter README shape are on the repository's root README and on the three examples (documentation only).
- Issues: #325 (kernel description), #329 (LICENSE tables), #333 (company name), #323 and #335 (README credit and shape).
