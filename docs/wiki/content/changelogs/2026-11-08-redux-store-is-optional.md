---
title: reduxStore is optional
description: ArdorApplication no longer needs a Redux store; without one it mounts no Redux provider.
packages: ['@venizia/ardor', '@venizia/ardor-admin']
---

# Changelog - 2026-11-08

## reduxStore is optional

<Badge type="tip" text="New Feature" />

**In one line.** The `reduxStore` prop of `ArdorApplication` is now optional instead of required. An app that does not use Redux can stop passing a store.

```tsx
import { ArdorApplication, type BaseArdorApplication } from '@venizia/ardor';

export const renderShell = (application: BaseArdorApplication) => {
  // No reduxStore: the shell mounts no Redux provider.
  return <ArdorApplication container={application} suspense={<div>Loading...</div>} />;
};
```

## What changed

- **`reduxStore` is optional.** Without it, `ArdorApplication` mounts no Redux provider, and the rest of the application mounts as before.
- **With a store, nothing changes.** Passing `reduxStore` works exactly as before. `react-redux` is still a peer dependency of the admin package.

## Who is affected

- **An app that does not use Redux.** It can drop its store, with no other change.
- **An app that uses `useAppSelector` or `useAppDispatch`.** No change is needed, but it must keep passing a store: without one, those hooks throw when they run.

See [Application](../references/application).
