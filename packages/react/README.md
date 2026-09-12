# @venizia/ardor-react

The React bindings of [ARDOR](https://github.com/VENIZIA-AI/ardor): the application context, the
hooks that resolve out of it, and the UI hooks. No react-admin.

```bash
bun add @venizia/ardor-react @venizia/ardor-kernel @venizia/ignis-inversion
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
| Types | `SyncFC`, `TUseInjectableKeys` |

## Typing your own binding keys

`IUseInjectableKeysOverrides` is declared here, so augment this package - an interface merges only
into the module that declares it, never through a re-export:

```typescript
declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.ProductApi': unknown;
  }
}
```

## License

MIT - see [LICENSE.md](./LICENSE.md).
