---
title: ardor-react and ardor-admin no longer depend on lodash
description: The six lodash calls are replaced by rest destructuring, an existing check and two small helpers, which takes about 10 KB off an app bundle that carried those lodash modules.
packages: ['@venizia/ardor-react', '@venizia/ardor-admin']
---

# Changelog - 2026-11-04

## ardor-react and ardor-admin no longer depend on lodash

<Badge type="tip" text="Enhancement" />

**In one line.** `@venizia/ardor-react` and `@venizia/ardor-admin` used `lodash` for six small calls. Together those four modules (`merge`, `omit`, `isEqual`, `isPlainObject`) are about 10.3 KB brotli (31.9 KB minified) in an app bundle, and no size budget could see them. They are gone: the packages no longer list `lodash` or `@types/lodash`, and ARDOR adds about 170 B of its own code in their place.

## What changed

- **`omit`** (the list and read requests of the REST data provider, and the list filter) became rest destructuring. The two reads in the provider now share the one `filter` that is left, instead of omitting `params` twice.
- **`isPlainObject`** (the feature message keys) became a plain `typeof` check.
- **`merge`** (feature messages, and the application's messages over them) became a small deep merge: a later source wins, plain objects merge recursively, an array or a string replaces, an `undefined` never overwrites a value, and `__proto__` is dropped. The sources are not changed.
- **`isEqual`** (the `useDeepEqualSelector` that `SelectorHooks.create()` returns) became a small deep comparison of primitives, plain objects, arrays and dates. Any other object, such as a `Map`, a `Set` or a class instance, is now equal only to itself, where `isEqual` compared it by content. Data a selector returns from a Redux store is plain, so a selector over state behaves as before.
- **Size.** `@venizia/ardor-react` grows by 146 B and `@venizia/ardor-admin` by 24 B, measured with `size-limit`. An app that did not already bundle those four lodash modules saves about 10.1 KB brotli.

## Who is affected

- **An app that imported `lodash` and relied on ARDOR to install it.** Add `lodash` to your own `package.json`; ARDOR no longer brings it.
- **A `useDeepEqualSelector` selector that returns a `Map`, a `Set` or a class instance.** It now re-renders whenever the instance changes, as the default selector does. Return plain data, or compare in the selector.
- **A message source that relied on `merge` combining arrays by index.** An array in a later source now replaces the earlier one. Message bundles are strings and nested objects, so this does not arise in practice.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#redux) and [Internationalization](../references/i18n).
