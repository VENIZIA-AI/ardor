---
title: ArdorApplication takes a features prop, so a shell mounts a filtered list
description: ArdorApplication has a new optional features prop, the list of features to mount, so a shell can mount a filtered list.
packages: ['@venizia/ardor', '@venizia/ardor-admin']
---

# Changelog - 2026-10-27

## ArdorApplication takes a features prop, so a shell mounts a filtered list

<Badge type="tip" text="New Feature" />

**In one line.** `ArdorApplication` mounted every feature the application bound, with no way to mount fewer. A shell that serves an industry, a plan or a role now passes the list it wants. Available in 0.4.4.

```tsx
import { type Store } from '@reduxjs/toolkit';
import { ArdorApplication, type BaseArdorApplication, Features } from '@venizia/ardor';

export const renderShell = (application: BaseArdorApplication, reduxStore: Store) => {
  // Mount only the features this shell serves.
  const features = Features.read({ container: application }).filter(
    (feature) => feature.name !== 'back-office',
  );

  return (
    <ArdorApplication
      container={application}
      reduxStore={reduxStore}
      suspense={<div>Loading...</div>}
      features={features}
    />
  );
};
```

## What changed

- **`features`, an optional prop of `ArdorApplication`.** The features to mount: their `resources` and `routes` are mounted after the application's own, in the order given. Absent, every bound feature is mounted, as before.
- **ARDOR reads no context.** There is no predicate and no workspace concept. The shell decides which features it mounts and passes the result.

## Who is affected

- **An app that does not pass `features`.** Nothing changes.
- **A shell that wants a subset** (by industry, plan, role, tenant). Filter `Features.read({ container })` and pass the list. Keep the array the same until the rule's input changes, and remount the application with a `key` when it does: ARDOR does not re-read the list.

## What it does not do

A feature left out of `features` is not unbound. The container still holds the feature's configurations, and the i18n provider still holds its messages (a lazy bundle loads when a mounted feature needs the locale, or on a locale change). A message key two features both define still throws, even if one of them is not mounted.

See [Features](../references/features) and [Application](../references/application).
