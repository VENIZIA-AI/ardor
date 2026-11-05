---
title: Testing - prove the application boots
description: assertArdorApplicationBoots starts an application and resolves its bindings with no browser or network; FakeResizeObserver delivers a size to observing code.
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
- A wrong API url, a server that is down, an expired token: nothing here reaches the network.

## Test a ResizeObserver

happy-dom and some other test hosts have a `ResizeObserver` whose `observe()` does nothing, so a hook such as `useElementSize` never gets a size. `FakeResizeObserver` replaces it and delivers the size you choose.

```ts
import { FakeResizeObserver } from '@venizia/ardor/testing';

declare const element: Element; // the element the component under test observes

const restore = FakeResizeObserver.install();
// render the component, then:
FakeResizeObserver.flush({ element, width: 320, height: 200 });
restore();
```

- **`FakeResizeObserver.install()`** puts the fake on `globalThis.ResizeObserver` and returns a function that leaves `ResizeObserver` as it was before that call. Call it before the code under test creates its observer. It does not nest: an inner `install()` forgets the observers of the outer one, so install once per test.
- **`FakeResizeObserver.flush({ element, width, height })`** calls every observer of `element` at once, with one entry whose content box and border box have that size. An element nobody observes, an element that was unobserved and a disconnected observer get nothing.
- **Animation frames are yours.** `useElementSize` and `useResizeEffect` apply a size on the next animation frame (`useResizeEffect` with `beforePaint: true` calls inside the observer callback, with no frame), so the test also runs its frames, with a fake `requestAnimationFrame` or its runner's timers, inside `act`.
- It needs no DOM of its own. Call the function `install` returned in `afterEach`.
