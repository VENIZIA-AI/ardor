---
title: The i18n provider takes lazy sources, so a catalogue stays out of the boot bundle
description: An entry of i18nSources can be a loader such as () => import('./vi'), called the first time its locale is used; a loader that fails leaves the locale on English.
packages: ['@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-01

## The i18n provider takes lazy sources, so a catalogue stays out of the boot bundle

<Badge type="tip" text="New Feature" />

**In one line.** An entry of `i18nSources` is the messages object, or now a function that returns a promise of it, called the first time its locale is used. An application that ships two catalogues no longer carries both in the boot bundle: one POS app cut 293 kB gzip (25%) from its boot by dropping one. Objects work as before.

```ts no-check
import { englishMessages, type II18nProviderOptions } from '@venizia/ardor';

const i18nProviderOptions: II18nProviderOptions = {
  i18nSources: {
    en: englishMessages,
    vi: () => import('./vi'), // a chunk, loaded when Vietnamese is picked
  },
  languages: [
    { locale: 'en', name: 'English' },
    { locale: 'vi', name: 'Tieng Viet' },
  ], // ...
};
```

## What changed

- **`TI18nSource`.** `II18nProviderOptions.i18nSources` is `Record<string, TI18nSource>`, where `TI18nSource` is `object | (() => Promise<object>)`.
- **What a loader returns.** The messages, or an ES module whose default export is the messages (`export default { ... }`, what `import('./vi')` resolves to). Anything else counts as a failed load.
- **First render.** When the starting locale is lazy, `ArdorApplication` shows `suspense` until its messages arrive, as it does for a feature's lazy messages.
- **A failed load does not stop the admin.** A file that does not download, or a chunk that did not arrive, is logged through the provider's `this.logger`; the locale shows the English messages and the features' messages. The failure is not remembered, so the next `changeLocale()` calls the loader again.
- **Loaded once.** After a loader delivers, the messages are kept.
- **Size.** The admin bundle grows by about 0.4 kB brotli for this; its budget is 10.5 kB (was 10 kB).

## Who is affected

- **An app with more than one catalogue in `i18nSources`.** Turn the ones the first screen does not need into loaders.
- **An app with one catalogue, or a custom i18n provider.** Nothing to do.

See [i18n](../references/i18n#lazy-sources).
