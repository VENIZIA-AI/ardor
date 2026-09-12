---
type: Playbook
title: Adding a provider
description: Step-by-step process for creating a new provider in ARDOR by subclassing BaseProvider, injecting its options, and binding it into the IGNIS container.
resource: packages/kernel/src/base/providers/base.ts
tags: [providers, kernel, di, playbook, testing]
---

A provider in ARDOR is a small class that produces a value the rest of the app depends on - an i18n provider, a data provider, an auth provider, and so on. Providers are constructed by IGNIS's dependency injection container and consumed through [DI in the browser](/architecture/di-in-the-browser.md).

## 1. Subclass BaseProvider<T>

`BaseProvider<T>` lives in the kernel (`packages/kernel/src/base/providers/base.ts`) and extends `BaseHelper`, implementing IGNIS's `IProvider<T>` interface. It declares one abstract method:

```ts
export abstract class BaseProvider<T> extends BaseHelper implements IProvider<T> {
  abstract value(container: Container): T;
}
```

Your concrete provider extends this class and fills in `value`. The generic `T` is the type of thing you're producing - for example `I18nProvider` from `ra-core` for the i18n provider.

## 2. Inject the options

Providers take their configuration through `@inject`, not through ad hoc constructor arguments. Follow [Options objects](/conventions/options-objects.md): define an options interface (for example `II18nProviderOptions`), then inject it under a bindings key in the constructor:

```ts
constructor(
  @inject({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  protected i18nProviderOptions: II18nProviderOptions,
) {
  super({ scope: DefaultI18nProvider.name });
}
```

Always call `super({ scope: <ClassName> })` so the helper's logging/scope machinery works correctly.

## 3. Implement value(container)

`value` receives the live `Container` and returns the constructed value. Keep this method pure with respect to side effects beyond building the return value - pull whatever else you need from `this` (the injected options) rather than reaching into globals. The default i18n provider is a good template: it derives locale/messages from the injected options plus browser `navigator.language`, then returns a configured `polyglotI18nProvider`.

## 4. Bind under a CoreBindings key or a namespaced key

Every provider needs a binding key so the container can resolve it and so consumers can inject it. Use an existing `CoreBindings` key if the provider fills a well-known role (i18n, auth, data), or add a new namespaced key following [Binding key namespaces](/conventions/binding-key-namespaces.md) if it's a new kind of provider. Register the binding in the same package's bootstrap/registration code, consistent with how the rest of [Application lifecycle](/architecture/application-lifecycle.md) wires things up.

## 5. Write tests with a Bun.serve stub

Providers commonly call out to HTTP. Write unit tests using `Bun.serve` to stand up a local stub server that returns canned responses, then point the provider's options at that stub URL. This lets you exercise `value()` and any returned methods without a real backend, in line with [Testing conventions](/conventions/testing-conventions.md) and the general [Testing](/process/testing.md) process. Verify:

- the provider resolves correctly out of the container with injected options
- `value()` returns an object matching the expected shape/interface
- edge cases in the options (missing fields, fallback locale, etc.) behave as documented

## 6. Update docs, changelog, and the public surface

Once the provider works and is tested:

- Add or update a docs page describing the provider, its options, and its binding key, following [Docs writing style](/conventions/docs-writing-style.md).
- Add a changelog entry per [Release and publish](/process/release-publish.md).
- Re-run surface generation so the new provider and its exported types show up in [Public surface](/reference/public-surface.md) and [Providers](/reference/providers.md).

Skipping the surface-gen step is a common mistake - the provider will work at runtime but won't be discoverable in the reference docs, which breaks downstream consumers relying on the generated surface.
