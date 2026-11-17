---
title: useInjectableContainer is now useApplicationContainer
description: The hook that returns the application's container is renamed to say what it returns; there is no alias, and the upgrade is a find and replace.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useInjectableContainer is now useApplicationContainer

<Badge type="warning" text="Breaking Change" />

**In one line.** `useInjectableContainer` returns IGNIS's `Container`, which is the application's own container (`AbstractApplication extends Container`). The hook is renamed `useApplicationContainer`, in `@venizia/ardor-react`, `@venizia/ardor` and the `Ardor` namespace. There is no alias.

```tsx
import { useApplicationContainer } from '@venizia/ardor';

export function BindingCount() {
  const container = useApplicationContainer();
  return <span>{container.isBound({ key: 'services.Orders' }) ? 'bound' : 'missing'}</span>;
}
```

## What changed

- **The name.** `useInjectableContainer` is `useApplicationContainer`. Its behavior is the same: it answers the container passed in, else the one of `ApplicationContext`, and throws where there is neither.
- **The error.** The throw reads `[useApplicationContainer] Failed to determine the application container!`. It is also what `useInjectable` and the artifact hooks (`useService`, `useRepository` and the others) throw when they find no container.
- **`Ardor`.** `Ardor.useApplicationContainer` replaces `Ardor.useInjectableContainer`, and the codemod's hook table follows, so `ardor codemod namespace --hooks` moves the new name.

## Upgrade

Replace the name in your code. One find and replace does it:

```bash
grep -rl useInjectableContainer src | xargs sed -i 's/useInjectableContainer/useApplicationContainer/g'
```

The codemod does not rename it, but `ardor codemod namespace --check` lists it, so a leftover shows up.

## Who is affected

- **An app that calls `useInjectableContainer`, or `Ardor.useInjectableContainer`.** Run the replacement above.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#useapplicationcontainer).
