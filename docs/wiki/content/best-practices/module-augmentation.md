---
title: Typing your keys with module augmentation
description: How to extend the typed key sets of useInjectable and useTranslate through TypeScript module augmentation, where to put the augmentation file, and how to prove it works.
---

# Typing your keys with module augmentation

`useInjectable` and `useTranslate` do not accept any string. Each takes a union of string literals. The default union is small on purpose. You extend it by merging your own keys into an override interface that the package leaves empty for you.

## Prerequisites

An ARDOR application that registers its own bindings and, if you use i18n, a message object of your own - see [Quickstart](../guides/get-started/quickstart).

## Quick Reference

| Export | Declared in | Role |
| --- | --- | --- |
| `useInjectable` | `@venizia/ardor-react` | Resolves a binding from the container by `key` or by `target` class |
| `IUseInjectableKeysOverrides` | `@venizia/ardor-react` | Empty interface - augment it to add injectable keys |
| `TUseInjectableKeysDefault` | `@venizia/ardor-react` | `Extract<ValueOf<typeof CoreBindings>, string>` - the built-in keys |
| `TUseInjectableKeys` | `@venizia/ardor-react` | `TUseInjectableKeysDefault \| keyof IUseInjectableKeysOverrides` |
| `useTranslate` | `@venizia/ardor-admin` | Returns a typed `translate` function |
| `IUseTranslateKeysOverrides` | `@venizia/ardor-admin` | Empty interface - augment it to add translation keys |
| `TUseTranslateKeysDefault` | `@venizia/ardor-admin` | `TFullPaths<typeof englishMessages>` - the built-in keys |
| `TUseTranslateKeys` | `@venizia/ardor-admin` | `TUseTranslateKeysDefault \| keyof IUseTranslateKeysOverrides` |
| `TUseTranslateFn` | `@venizia/ardor-admin` | `(key: TUseTranslateKeys, options?) => string` |
| `TFullPaths` | `@venizia/ardor-kernel` | Turns a nested object type into a union of dotted paths |

All of these are re-exported from `@venizia/ardor`. The "Declared in" column matters for augmentation - read on.

## Know what the key types are

The two hooks build their accepted keys the same way: a default set, plus whatever keys you merge in.

```ts no-check
export interface IUseInjectableKeysOverrides {}
export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;
export type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;
```

```ts no-check
export interface IUseTranslateKeysOverrides {}
export type TUseTranslateKeysDefault = TFullPaths<typeof englishMessages>;
export type TUseTranslateKeys = TUseTranslateKeysDefault | keyof IUseTranslateKeysOverrides;
```

Only the `keyof` of the override interface is used. The property values are ignored, so the convention is to type every value as `true`.

Out of the box, `useInjectable({ key })` accepts the string values of `CoreBindings` and nothing else. `useTranslate()` accepts the dotted paths of `englishMessages` and nothing else. A key you registered yourself is a compile error until you augment.

### Do

Treat a key compile error as a signal that the augmentation is missing, not that the type is wrong.

### Do not

Do not cast the key (`key: 'x' as TUseInjectableKeys`). That hides a real typo and defeats the purpose of the union.

## Augment the package that declares the interface

TypeScript merges interface declarations by module identity. `IUseInjectableKeysOverrides` is declared in `@venizia/ardor-react`. `IUseTranslateKeysOverrides` is declared in `@venizia/ardor-admin`. The `@venizia/ardor` umbrella only re-exports them.

An augmentation aimed at `@venizia/ardor` creates a new, unrelated interface inside the umbrella module. It never merges with the original, and `TUseInjectableKeys` never sees your keys.

### Do

Target the declaring package, even if the rest of your code imports from `@venizia/ardor`.

```ts
import type { TFullPaths } from '@venizia/ardor';

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': true;
  }
}

declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, true> {}
}
```

### Do not

Do not augment the umbrella. This compiles, does nothing, and the hooks still reject your keys.

```ts
// Wrong - a re-export does not merge.
declare module '@venizia/ardor' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': true;
  }
}
```

## Derive injectable keys from the application

Do not retype your binding keys by hand in the augmentation. Derive them from the same place the application registers them, so adding a binding updates the hook type in one edit.

### Do

Keep the key map as a `const` object next to the application and derive the union from it.

```ts
export const ApplicationBindings = {
  PRODUCT_API: 'services.ProductApi',
  PRODUCT_LIST: 'components.ProductList',
} as const;

type TApplicationBindingKey = (typeof ApplicationBindings)[keyof typeof ApplicationBindings];

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides extends Record<TApplicationBindingKey, true> {}
}
```

If your application class exposes its key map through a `bindingList()` method, derive from that instead so the type follows the runtime registration:

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    for (const [key, target] of Object.entries(this.bindingList())) {
      this.bind({ key }).toClass(target);
    }
  }

  bindingList() {
    return {
      'services.ProductApi': ProductApi,
      'services.OrderApi': ProductApi,
    };
  }
}

type TApplicationBindingKey = keyof ReturnType<Application['bindingList']>;

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides extends Record<TApplicationBindingKey, true> {}
}
```

> [!WARNING]
> Derive from a type that resolves. If `Application` fails to import (a wrong path, a build that
> has not run), it is `any`, `keyof ReturnType<any>` is `string`, and the augmentation silently
> widens **every** injectable key to `string` - the compile errors you rely on disappear without a
> warning. The `@ts-expect-error` probe in "Verify it" is how you notice.

See [Binding keys](./binding-keys) for how to name and group the keys themselves.

### Do not

Do not duplicate literals. Two lists drift, and the compile error you get later points at the wrong one.

Note that `useInjectable({ target: ProductApi })` does not go through the key union at all. The hook resolves the key from the container's metadata registry for the class. Augmentation only affects the `key` form.

## Derive translate keys from the message object

`TUseTranslateKeysDefault` is `TFullPaths<typeof englishMessages>`. Apply the same helper to your own message object so every leaf path becomes a valid key.

### Do

```ts
import type { TFullPaths } from '@venizia/ardor';

declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, true> {}
}
```

The `messages` object must be typed from its literal shape (a plain object literal, or `as const`) for `TFullPaths` to produce paths. A value typed as `Record<string, unknown>` gives you no useful union.

### Do not

Do not list translation keys by hand. The message object is already the source of truth for the [i18n provider](../references/i18n); the type should come from it.

## Keep the augmentation in one file

Augmentations merge from anywhere in the program, which makes them easy to scatter and hard to find. Pick one location.

### Do

Use one of these two layouts and stick to it:

- `src/application.ts` - the file that builds the application. Keys, registration, and augmentation live together.
- `src/types/augmentation.d.ts` - a dedicated declaration file. Make sure it is covered by `include` in `tsconfig.json`.

In either case the file must be a module. A file with no top-level `import` or `export` is a script, and `declare module` in a script declares an ambient module instead of augmenting the real one. An `import type` at the top, or a trailing `export {};`, is enough.

```ts
import type { TFullPaths } from '@venizia/ardor';

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': true;
  }
}

declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, true> {}
}

export {};
```

### Do not

Do not put a second augmentation in a feature folder "just for this key". Later readers will not find it, and the two declarations must stay compatible with each other.

## Verify with a compile error

An augmentation that silently does nothing looks identical to one that works, until someone mistypes a key. Prove it once with `// @ts-expect-error`. If the directive itself errors as unused, the augmentation is not being picked up.

### Do

Keep a small check next to the augmentation. Both the augmentation and the check are shown in one file here so the sample is self-contained; in a project the augmentation lives in the file described above.

```tsx
import { useInjectable, useTranslate, type TUseTranslateFn } from '@venizia/ardor';

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': true;
  }
}

declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides {
    'app.products.title': true;
  }
}

export const VerifyKeys = () => {
  // Declared key - accepted.
  const productApi = useInjectable<ProductApi>({ key: 'services.ProductApi' });

  // @ts-expect-error - 'services.Missing' is not a declared injectable key
  useInjectable<ProductApi>({ key: 'services.Missing' });

  const translate: TUseTranslateFn = useTranslate();
  const title = translate('app.products.title');

  // @ts-expect-error - 'app.products.missing' is not a declared translation key
  translate('app.products.missing');

  return <h1 title={String(productApi)}>{title}</h1>;
};
```

Annotate the local as `TUseTranslateFn`. `useTranslate()` returns the typed function when an i18n provider is mounted and an identity fallback otherwise, and the fallback's `any` parameter widens the union if you let inference pick the type. The annotation is what makes the unknown-key line an error.

### Do not

Do not verify by reading the hover tooltip in the editor. Editors can resolve a `.d.ts` that `tsc` never includes. Only the build proves it.

## Common pitfalls

- **Augmenting `@venizia/ardor`.** The umbrella re-exports the interfaces; it does not declare them. Target `@venizia/ardor-react` for injectable keys and `@venizia/ardor-admin` for translation keys.
- **A `.d.ts` that is not a module.** Without an `import` or `export {}` the `declare module` block is an ambient declaration, not an augmentation.
- **Augmentation file outside `tsconfig` `include`.** The editor may see it while the build does not. The `@ts-expect-error` check catches this.
- **Message object typed too loosely.** `TFullPaths<Record<string, unknown>>` does not give you literal paths. Keep `messages` as a literal object.
- **Expecting `target` to be typed by the augmentation.** `useInjectable({ target })` resolves the key from class metadata and ignores the key union.
- **Inferring the `translate` type.** Assign `useTranslate()` to a `TUseTranslateFn` local; otherwise the identity fallback widens the key parameter.

## Related

- [Binding keys](./binding-keys) - naming and grouping the keys you register
- [Hooks reference](../references/hooks) - `useInjectable`, `useTranslate`, and the other hooks
- [Binding keys reference](../references/binding-keys) - `CoreBindings` and the default key set
- [i18n reference](../references/i18n) - `DefaultI18nProvider`, `englishMessages`, `vietnameseMessages`
- [Types reference](../references/types) - `TFullPaths`, `ValueOf`, and the other kernel type helpers
- [Application reference](../references/application) - where bindings are registered
