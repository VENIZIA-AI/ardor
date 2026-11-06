---
title: Testing - prove the application boots
description: assertArdorApplicationBoots resolves an application's bindings with no browser; fakes for ResizeObserver, IntersectionObserver, matchMedia, storage and the clipboard.
---

# Testing - prove the application boots

A service whose injection nobody registered fails when something first resolves it, which in the browser is the first render. `assertArdorApplicationBoots` finds it in a unit test instead. Available in 0.4.4; it needs `@venizia/ignis-inversion` 0.4.6-1 or newer.

```ts
import { assertArdorApplicationBoots } from '@venizia/ardor/testing';

await assertArdorApplicationBoots(() => new Application());
```

`Application` is your application class; the call goes in a `bun:test` test, after `import 'reflect-metadata'`. An app made from the preset has it as `src/boot.test.ts`.

## What it does

In order, and it stops at the first failure with the error the app would raise:

1. Calls `start()`: the artifact index, the stereotype bindings, the features, `bindContext()`.
2. Resolves every binding of the namespaces `services`, `repositories`, `datasources`, `components` and `configurations`, collects every failure and throws once. The message names each binding that failed and the key or class it needed.
3. Resolves what `ArdorApplication` resolves on mount: the data provider, the auth provider (optional) and the i18n provider, through the same function the component calls.
4. Reads and mounts the features, and loads the messages of the first locale, so a key two features define fails here.

`fetch` is replaced for the run by a function that rejects, so nothing leaves the process, and put back afterwards. The helper returns the application it started.

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `skipBindings` | `Array<TClass \| string>` | none | Bindings left unresolved: an exact class, a class name or a binding key, among the five namespaces of step 2. A skip that matches no binding rejects, so a typo does not skip silently. It does not reach step 3: see below. |
| `locale` | `string` | the i18n provider's | The locale whose messages must load. |
| `allowEmpty` | `boolean` | `false` | An application with nothing to check and no feature rejects: the artifact index is usually empty. |

`skipBindings` applies to step 2 only. Step 3 builds the data, auth and i18n providers the application bound, so a bound auth provider that cannot be built fails the check even when you name its key, and the key, outside the five namespaces, rejects as a skip that matched nothing. An application that never signs in, such as a guest app that builds its own react-admin tree, leaves `CoreBindings.DEFAULT_AUTH_PROVIDER` unbound (see [Authentication (No Sign-In)](../guides/core-concepts/providers#authentication-no-sign-in)).

The first argument is an instance or a function that returns one. Pass a function: a failed start leaves a half-started instance, and the same instance cannot be passed twice.

## What it cannot catch

- Anything that fails only in a real browser: CSS, layout, the router, a page's own rendering.
- A request a service makes with its own transport, or a socket it opens when it is built. Name such a binding in `skipBindings`.
- A wrong API url, a server that is down, an expired token: nothing here reaches the n## Fake the browser APIs your code reads

happy-dom and some other test hosts have a `ResizeObserver` or `IntersectionObserver` whose `observe()` does nothing, no `matchMedia`, a `localStorage` that never fails and a `navigator.clipboard` that does not exist. ARDOR's hooks and helpers read all of them, so the same entry holds a fake of each. Each `install` returns a function that puts back what was there; call it in `afterEach`.

```ts
import {
  FakeClipboard,
  FakeIntersectionObserver,
  FakeMatchMedia,
  FakeResizeObserver,
  FakeStorage,
} from '@venizia/ardor/testing';

declare const element: Element; // an element the component under test observes

const restore = [
  FakeResizeObserver.install(),
  FakeIntersectionObserver.install(),
  FakeMatchMedia.install(),
  new FakeStorage().install(),
  new FakeClipboard().install(),
];
// render the component, then:
FakeResizeObserver.flush({ element, width: 320, height: 200 });
FakeIntersectionObserver.flush({ element, isIntersecting: true });
FakeMatchMedia.set({ query: '(min-width: 600px)', matches: true });
restore.forEach((undo) => undo());
```

The same classes are in `@venizia/ardor-kernel/testing`, for a project that uses the kernel without the umbrella. They need no DOM of their own.

- **`FakeResizeObserver.install()` and `FakeIntersectionObserver.install()`** put the fake on `globalThis` and forget the observers of an earlier install, so install once per test. `FakeResizeObserver.all` and `FakeIntersectionObserver.all` list the observers the code created; each has its `callback`, `targets` (the elements observed now), `isDisconnected`, and `options` (the `FakeResizeObserver` one has an entry per `observe` call, and an `unobserved` list).
- **`flush`** calls every observer of `element` at once: `FakeResizeObserver.flush({ element, width, height })` with one entry whose content box and border box have that size, `FakeIntersectionObserver.flush({ element, isIntersecting, ratio })` with one entry (`ratio` is 1 or 0 by `isIntersecting` unless you give it). An element nobody observes, an element that was unobserved and a disconnected observer get nothing. For an entry of your own, call `FakeResizeObserver.all[0].callback`.
- **Animation frames are yours.** `useElementSize` and `useResizeEffect` apply a size on the next animation frame (`useResizeEffect` with `beforePaint: true` calls inside the observer callback, with no frame), so the test also runs its frames, with a fake `requestAnimationFrame` or its runner's timers, inside `act`.
- **`FakeMatchMedia.install()`** replaces `matchMedia` with a function that answers one list per query, `false` until `FakeMatchMedia.set({ query, matches })` sets it and tells the listeners with a `change` event. `FakeMatchMedia.queries` holds the queries the code asked about, so `size === 0` shows that it never asked.
- **`new FakeStorage()`** is a `Storage` that keeps its keys as own properties, as the real one does. `storage.install()` makes it `localStorage`; `storage.install('session')` makes it `sessionStorage`. Set `failWrites = true` for a full or blocked storage (`setItem` throws `QuotaExceededError`, `removeItem` throws `SecurityError`) and `failReads = true` for a blocked one (reads throw `SecurityError`); `writes` lists the values it accepted. Flip them at any time to see the code recover.
- **`new FakeClipboard()`** replaces `navigator.clipboard` with one that keeps the text: `written` lists every `writeText`, `text` is what `readText` answers, and `isDenied = true` makes both reject with `NotAllowedError`. To test a missing clipboard, or one that throws before it returns a promise, replace `navigator.clipboard` yourself.
