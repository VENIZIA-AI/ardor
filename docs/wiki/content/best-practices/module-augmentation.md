---
title: Typing your keys
description: Type the values you bind by hand with BindingKeys.build, type your translation keys through TypeScript module augmentation, where to put the augmentation file, and how to prove it works.
---

# Typing your keys

A class you registered is resolved by `{ target }` through its namespace hook, and it never needs a key. `Ardor.useService({ target: PricingService })` finds the binding from the class and returns the class's own type. Two other things need typing: a value bound by hand under a key you own, and the messages `useTranslate` accepts.

```tsx
import { Ardor, service } from '@venizia/ardor';

@service()
export class PricingService {
  total(opts: { quantity: number }): number {
    return opts.quantity * 3;
  }
}

export function Total() {
  const pricing = Ardor.useService({ target: PricingService });

  return <span>{pricing.total({ quantity: 2 })}</span>;
}
```

`@service()` registers the class when `start()` runs, because its module was imported. The hook reads the key that registration recorded on the class, checks the class sits under `services.`, and returns `PricingService`. Pass no generic: one you write is your claim, and nothing checks it. `Ardor.useX` and `useX` are the same function; this page writes `Ardor.useX`.

A value with no class has only its key. A key carries the type of its value: make it with `BindingKeys.build<T>`, and `useInjectable({ key })` returns `T` with no generic and no augmentation. The three providers of `CoreBindings` are already typed: `Ardor.useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })` returns `IDataProvider` with nothing to declare. `useTranslate` does not accept any string either; it takes a union of dotted paths, and you extend it by merging your own paths into an interface that the package leaves empty for you.

## Quick Reference

| Export | Declared in | Role |
| --- | --- | --- |
| `BindingKeys.build<T>` | `@venizia/ignis-inversion`, re-exported by `@venizia/ardor` | Makes a binding key that carries the type `T` of its value |
| `TBindingKey<T>` | `@venizia/ignis-inversion` | The type of such a key; `TBindingKeyValue<typeof key>` names `T` |
| `useInjectable` | `@venizia/ardor-react` | Resolves a binding from the container by `target` class, or by a typed `key` for a binding with no class |
| `useTranslate` | `@venizia/ardor-admin` | Returns a typed `translate` function |
| `IUseTranslateKeysOverrides` | `@venizia/ardor-admin` | Empty interface - augment it to add translation keys |
| `TUseTranslateKeysDefault` | `@venizia/ardor-admin` | `TFullPaths<typeof englishMessages>` - the built-in keys |
| `TUseTranslateKeys` | `@venizia/ardor-admin` | `TUseTranslateKeysDefault \| keyof IUseTranslateKeysOverrides` |
| `TUseTranslateFn` | `@venizia/ardor-admin` | `(key: TUseTranslateKeys, options?) => string` |
| `TFullPaths` | `@venizia/ardor-kernel` | Turns a nested object type into a union of dotted paths |

All of these are re-exported from `@venizia/ardor`, and that is the module to augment for translation keys.

## Type a value bound by hand

Make each key once, in a `static readonly` class, with the type of its value. Use the same constant where the binding is made and where it is read, so a rename is one edit and a wrong value does not compile.

### Do

```ts
import { BindingKeys, configuration, provide } from '@venizia/ardor';

export class AppBindings {
  static readonly SOCKET_URL = BindingKeys.build<string>({ key: '@app/socket/url' });
  static readonly FORMATTER = BindingKeys.build<(opts: { value: number }) => string>({
    key: '@app/formatter',
  });
}

@configuration()
export class SocketConfiguration {
  @provide({ key: AppBindings.SOCKET_URL })
  socketUrl(): string {
    return 'wss://example.com/socket';
  }

  @provide({ key: AppBindings.FORMATTER })
  formatter(): (opts: { value: number }) => string {
    return (opts) => opts.value.toFixed(2);
  }
}
```

A component then reads them with no generic:

```tsx
import { Ardor, BindingKeys } from '@venizia/ardor';

class AppBindings {
  static readonly SOCKET_URL = BindingKeys.build<string>({ key: '@app/socket/url' });
}

export function SocketAddress() {
  const url = Ardor.useInjectable({ key: AppBindings.SOCKET_URL });

  return <code>{url}</code>;
}
```

`Ardor.useInjectable({ key })` throws when nothing is bound under the key, so bind it in a configuration the application discovers or in `bindContext()`. `@inject({ key })` is not checked against the parameter it decorates: annotate that parameter with `TBindingKeyValue<typeof AppBindings.SOCKET_URL>`, which names the type the key carries.

> [!WARNING]
> Do not derive the keys from the application's `bindingList()`. `bindingList()` binds classes, and a class resolves by `{ target }`.

See [Binding keys](./binding-keys) for how to name and group the keys themselves.

### Do not

Do not pass a plain string as a key: `useInjectable({ key: '@app/socket/url' })` does not compile, because only a key made by `BindingKeys.build` carries a type. Do not write `build<unknown>` for a key whose value has a real type; it types nothing.

Do not make a key for a class. A class resolves with its namespace hook (`Ardor.useService`, `Ardor.useRepository`, `Ardor.useProvider`, `Ardor.useComponent`, `Ardor.useConfiguration`, or `Ardor.useInjectable({ target })`): the type is inferred and the namespace is checked.

## Derive translate keys from the message object

`TUseTranslateKeysDefault` is `TFullPaths<typeof englishMessages>`. Apply the same helper to your own message object so every leaf path becomes a valid key.

```ts no-check
export interface IUseTranslateKeysOverrides {}
export type TUseTranslateKeysDefault = TFullPaths<typeof englishMessages>;
export type TUseTranslateKeys = TUseTranslateKeysDefault | keyof IUseTranslateKeysOverrides;
```

Only the `keyof` of `IUseTranslateKeysOverrides` is used. The property values are ignored, so the convention is to type every value as `true`. Out of the box, `useTranslate()` accepts the dotted paths of `englishMessages` and nothing else. A key you registered yourself is a compile error until you augment.

### Do

```ts
import type { TFullPaths } from '@venizia/ardor';

const messages = { app: { products: { title: 'Products' } } };

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, true> {}
}
```

The `messages` object must be typed from its literal shape (a plain object literal, or `as const`) for `TFullPaths` to produce paths. A value typed as `Record<string, unknown>` gives you no useful union. Treat a key compile error as a signal that the augmentation is missing, not that the type is wrong.

### Do not

Do not list translation keys by hand. The message object is already the source of truth for the [i18n provider](../references/i18n); the type should come from it. Do not cast the key (`key: 'x' as TUseTranslateKeys`): that hides a real typo.

## Augment the umbrella

TypeScript merges interface declarations by module identity. `IUseTranslateKeysOverrides` is declared in `@venizia/ardor-admin`, and `@venizia/ardor` re-exports it with `export *`. TypeScript follows an `export *` chain to the module that declares an interface, so a `declare module '@venizia/ardor'` block merges into the real interface and `TUseTranslateKeys` sees your keys. `@venizia/ardor-admin` uses the same mechanism for the values of `CoreBindings` that live in it: it merges them into `ICoreBindingTypes` of the kernel in its own declaration files.

Measured with TypeScript 6, under both of Bun's linkers (`hoisted` and `isolated`): a declared key is accepted and an undeclared one is rejected.

### Do

Augment `@venizia/ardor`, the one package an application depends on.

### Do not

Do not augment `@venizia/ardor-admin` unless the application lists that package in its own `package.json`. A linker that does not hoist (Bun's `isolated` linker, pnpm) leaves a package that only `@venizia/ardor` depends on out of the application's reach. The block then fails with `TS2664: Invalid module name in augmentation, module '@venizia/ardor-admin' cannot be found`, and your keys are missing, so every `translate` call that uses one is a compile error. The same block compiles under a hoisting linker, which is how it goes unnoticed.

## Keep the augmentation in one file

Augmentations merge from anywhere in the program, which makes them easy to scatter and hard to find. Pick one location.

### Do

Use one of these two layouts and stick to it:

- `src/application.ts` - the file that builds the application. Keys, registration, and augmentation live together.
- `src/types/augmentation.d.ts` - a dedicated declaration file. Make sure it is covered by `include` in `tsconfig.json`.

In either case the file must be a module. A file with no top-level `import` or `export` is a script, and `declare module` in a script declares an ambient module instead of augmenting the real one. An `import type` at the top, or a trailing `export {};`, is enough.

```ts
import type { TFullPaths } from '@venizia/ardor';

const messages = { app: { products: { title: 'Products' } } };

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, true> {}
}

export {};
```

### Do not

Do not put a second augmentation in a feature folder "just for this key". Later readers will not find it, and the two declarations must stay compatible with each other.

## Verify with a compile error

An augmentation that silently does nothing looks identical to one that works, until someone mistypes a key. Prove it once with `// @ts-expect-error`. If the directive itself errors as unused, the augmentation is not being picked up.

### Do

Keep a small check next to the augmentation. Both are shown in one file here so the sample is self-contained; in a project the augmentation lives in the file described above.

```tsx
import { Ardor, BindingKeys, type TUseTranslateFn } from '@venizia/ardor';

class ClockKeys {
  static readonly NOW = BindingKeys.build<() => number>({ key: '@app/clock/now' });
}

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'app.products.title': true;
  }
}

export const VerifyKeys = () => {
  // A typed key - accepted, and typed with no generic.
  const now: () => number = Ardor.useInjectable({ key: ClockKeys.NOW });

  // @ts-expect-error - a plain string is not a binding key
  Ardor.useInjectable({ key: '@app/clock/missing' });

  const translate: TUseTranslateFn = Ardor.useTranslate();
  const title = translate('app.products.title');

  // @ts-expect-error - 'app.products.missing' is not a declared translation key
  translate('app.products.missing');

  return <h1 title={String(now())}>{title}</h1>;
};
```

`Ardor.useTranslate()` returns a `TUseTranslateFn` whether or not an i18n provider is mounted (without one it answers the key), so the unknown-key line is an error with or without the annotation. The annotation documents the type.

### Do not

Do not verify by reading the hover tooltip in the editor. Editors can resolve a `.d.ts` that `tsc` never includes. Only the build proves it.

## Common pitfalls

- **Augmenting a declaring package the application does not depend on.** `declare module '@venizia/ardor-admin'` fails with TS2664 under a linker that does not hoist, and the keys are missing. Augment `@venizia/ardor`.
- **A `.d.ts` that is not a module.** Without an `import` or `export {}` the `declare module` block is an ambient declaration, not an augmentation.
- **Augmentation file outside `tsconfig` `include`.** The editor may see it while the build does not. The `@ts-expect-error` check catches this.
- **Message object typed too loosely.** `TFullPaths<Record<string, unknown>>` does not give you literal paths. Keep `messages` as a literal object.
- **A key for a class.** A class resolves by `{ target }`: the hook reads the key recorded on the class and returns the type of the class.
- **A generic on a typed key.** `useInjectable<Other>({ key })` compiles when `Other` is a subtype or a supertype of the key's type, and then returns `Other`. Leave the generic out.
- **A key built at run time.** A plain `string` is not a `TUseTranslateKeys`; type the value as `TUseTranslateKeys` where it is made (a label map), or narrow it before the call.

## Related

- [Binding keys](./binding-keys) - naming and grouping the keys you register
- [Hooks reference](../references/hooks) - `useService`, `useInjectable`, `useTranslate`, and the other hooks
- [Binding keys reference](../references/binding-keys) - `CoreBindings` and the default key set
- [i18n reference](../references/i18n) - `DefaultI18nProvider`, `englishMessages`, `vietnameseMessages`
- [Types reference](../references/types) - `TFullPaths`, `ValueOf`, and the other kernel type helpers
- [Application reference](../references/application) - where bindings are registered
