# @venizia/ardor-react

The React bindings of [ARDOR](https://github.com/VENIZIA-AI/ardor): the application context, the
hooks that resolve out of it, and the UI hooks. No react-admin.

```bash
bun add @venizia/ardor-react @venizia/ardor-kernel @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-kernel @venizia/ignis-helpers reflect-metadata
```

Most applications install [`@venizia/ardor`](https://www.npmjs.com/package/@venizia/ardor) instead,
which re-exports this package.

## What is in it

| Area | Exports |
|---|---|
| Context | `ApplicationContext`, `useApplicationContext`, `useApplicationLogger` |
| Injection | `useInjectable` - resolve a binding by key or by class |
| Redux | `createAppDispatch`, `createAppSelectors` - factories that bind your `RootState` and `AppDispatch` |
| UI hooks | `useDebounce`, `useAutosave`, `useConfirm`, `useBeforeUnload`, `useCopyToClipboard`, `useSizer`, `useWindowDimensions` |
| Types | `ISyncFC`, `TUseInjectableKeys` |

## Typing your own binding keys

`IUseInjectableKeysOverrides` is declared here, so augment this package - an interface merges only
into the module that declares it, never through a re-export:

```typescript
declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.PricingService': unknown;
  }
}
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
