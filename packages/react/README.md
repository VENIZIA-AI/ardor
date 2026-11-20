# @venizia/ardor-react

The React bindings of [ARDOR](https://github.com/VENIZIA-AI/ardor): the application context, the
hooks that resolve out of it, and the UI hooks. No react-admin.

```bash
bun add @venizia/ardor-react @venizia/ardor-kernel @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers reflect-metadata react react-redux
```

`@reduxjs/toolkit` is an optional peer: only the types of `DispatchHooks` use it.

Most applications install [`@venizia/ardor`](https://www.npmjs.com/package/@venizia/ardor) instead,
which re-exports this package.

## What is in it

| Area | Exports |
|---|---|
| Context | `ApplicationContext`, `useApplicationContext`, `useApplicationLogger` |
| Injection | `useInjectable` - resolve a binding by key or by class; the artifact hooks `useApplicationContainer`, `useService`, `useProvider`, `useComponent`, `useConfiguration`, `useRepository` |
| Redux | `DispatchHooks.create`, `SelectorHooks.create` - factories that bind your `RootState` and `AppDispatch` (the old `createAppDispatch` and `createAppSelectors` are removed; `bun run ardor codemod namespace` moves your code) |
| UI hooks | `useDebounce`, `useAutosave`, `useConfirm`, `useBeforeUnload`, `useCopyToClipboard`, `useWindowDimensions`, `useElementSize`, `useResizeEffect`, `useIntersection`, `useStoredState`, `useMediaQuery`, `useBreakpoint`, `useDocumentVisibility`, `useOnlineStatus` |

## Typing your own binding keys

A key carries the type of its value: make it with `BindingKeys.build<T>` and `useInjectable({ key })` returns `T`, with no generic and no augmentation.

```typescript
import { BindingKeys } from '@venizia/ignis-inversion';

export const PRICING_OPTIONS = BindingKeys.build<{ currency: string }>({
  key: '@app/pricing/options',
});
```

## License

MIT - see [LICENSE.md](./LICENSE.md).

---

<p align="center">
  <a href="https://venizia.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://venizia.ai/assets/logo-white.svg">
      <img src="https://venizia.ai/assets/logo.svg" alt="VENIZIA" height="28">
    </picture>
  </a>
  <br>
  <sub><code>@venizia/ardor-react</code> is part of ARDOR, built and maintained by <a href="https://venizia.ai">VENIZIA</a>.</sub>
</p>
