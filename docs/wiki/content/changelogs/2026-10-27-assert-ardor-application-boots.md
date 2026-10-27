---
title: assertArdorApplicationBoots proves an application boots, and the preset ships a boot test
description: The new entry @venizia/ardor/testing exports assertArdorApplicationBoots, which starts an application, resolves every binding it made and what the first render resolves, with no browser and no network; a new app from the preset gets src/boot.test.ts that calls it.
packages: ['@venizia/ardor', '@venizia/ardor-admin']
---

# Changelog - 2026-10-27

## assertArdorApplicationBoots proves an application boots, and the preset ships a boot test

<Badge type="tip" text="New Feature" />

**In one line.** A service whose injection nobody registered used to fail at the first render, in a browser. `assertArdorApplicationBoots` fails the same way in a unit test, with no browser and no network. Available in 0.4.4.

```ts
import { assertArdorApplicationBoots } from '@venizia/ardor/testing';

await assertArdorApplicationBoots(() => new Application());
```

## What changed

- **`@venizia/ardor/testing`, a new entry.** `assertArdorApplicationBoots(application | factory, options?)` starts the application, resolves every binding in the namespaces `services`, `repositories`, `datasources`, `components` and `configurations`, then resolves what opening the app resolves: the data, auth and i18n providers, the features and the messages of the first locale. A failure is the error the app would raise; the check over the bindings reports every failure at once, naming the key or class each one needed. The entry is browser-pure and has its own row in the purity and size gates (831 B brotli).
- **Options.** `skipBindings` (a class, a class name or a key; one that matches nothing rejects), `locale`, and `allowEmpty` (an application with nothing to check and no feature rejects by default).
- **No network.** `fetch` is replaced for the run by a function that rejects, and put back afterwards.
- **The preset has `src/boot.test.ts`.** A new app calls the helper on its real `Application`.
- **`@venizia/ardor-admin` exports three functions** that `ArdorApplication` and the helper share, so the helper resolves exactly what the component resolves: `resolveApplicationProviders`, `hasPendingFeatureMessages` and `loadFeatureMessages`. The component behaves as before; the admin bundle grows by about 60 B.
- **The shared check lives in IGNIS.** The helper calls `assertBindingsResolve` from `@venizia/ignis-inversion` 0.4.4, the same function IGNIS's `assertApplicationBoots` and its kernel use. `@venizia/ardor` therefore asks for `@venizia/ignis-inversion` `^0.4.4`; `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin` keep `^0.4.1`.

## Who is affected

- **An app on ARDOR 0.4.3.** Nothing breaks. To use the helper, move IGNIS to 0.4.4 (`@venizia/ignis-inversion` is enough) and `@venizia/ardor` to 0.4.4.
- **A new app from the preset.** Nothing to do: it has the test.
- **An app already generated from the preset.** Optional: copy `src/boot.test.ts` from the new preset.

## What it cannot catch

CSS, layout, routing and the rendering of a page; a request a service makes with its own transport or a socket it opens when it is built (name that binding in `skipBindings`); a wrong API url or a server that is down.

## Details

- The wiki page [Testing](../references/testing) has the steps, the options and the limits.
