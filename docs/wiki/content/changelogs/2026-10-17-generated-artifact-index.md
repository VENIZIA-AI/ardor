---
title: A generated artifact index for the application
description: artifacts() takes the index ignis-artifacts generate emits, so a bundler keeps every stereotyped class and start() fails on a class that was never discovered.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-17

## A generated artifact index for the application

<Badge type="tip" text="New Feature" />

**In one line.** An application returns the index `ignis-artifacts generate` emits from `artifacts()`, the same file an IGNIS backend passes to `createAppConfig` (issue #35).

```typescript
import { BaseArdorApplication, type IApplicationInfo, type IArtifactIndex } from '@venizia/ardor';

const GeneratedArtifacts: IArtifactIndex = { services: [] }; // from src/_artifacts.ts

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [GeneratedArtifacts];
  }

  bindContext(): void {}
}
```

## What changed

- **`artifacts()` on the application.** It returns `Array<IArtifactIndex>` and defaults to `[]`. An index holds each stereotyped class by value, so a bundler keeps the module instead of dropping a side-effect import.
- **`start()` checks the index.** It throws `[artifacts] '<kind>' lists <Class>, which was never discovered` when a listed class has no stereotype or the index is stale.
- **An IGNIS artifact group is accepted.** `start()` checks the flat index a group carries as `content` and skips a group without one, instead of reading its kind fields.
- **`IArtifactIndex` is exported** from `@venizia/ardor` and `@venizia/ardor-kernel`. It has the six fields the generator emits, `configurations` to `controllers`.

## Who is affected

- **An application that imports a hand-written `register-artifacts` file.** Nothing breaks. To move to the shared generator, run `ignis-artifacts generate --root src --out src/_artifacts.ts --source-module @venizia/ardor` and return its export from `artifacts()`.
- **Everyone else.** No action needed. Discovery binds the same classes as before.

| File | Package |
|------|---------|
| `src/base/applications/abstract.ts`, `src/common/types.ts` | kernel |
