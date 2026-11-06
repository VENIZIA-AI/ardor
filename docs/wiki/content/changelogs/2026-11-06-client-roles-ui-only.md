---
title: Client-side roles only show or hide interface
description: The roles ARDOR keeps in the browser, and the permission provider, are not an access check; the docs and the TSDoc now say the backend must check every permission.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-06

## Client-side roles only show or hide interface

<Badge type="tip" text="Enhancement" />

**In one line.** The roles in `@app/auth/permission`, `getRoles`, `canAccess` and the permission provider decide what the interface shows. They run in the browser and can be changed there, so the backend must check every permission on every request.

## What changed

- **The docs say it.** The Permission provider and Auth provider references carry a warning, and the auth best practice says that stored roles and identity prove nothing.
- **The TSDoc says it.** `DefaultAuthService.getRoles`, `IAuthProvider.getRoles`, `DefaultAuthProvider.getRoles` and `IPermissionProvider` state the same.
- **No code changes.**

## Who is affected

- **An app whose only check is the interface.** Add the check to the backend.
- **All other apps.** No action needed.
