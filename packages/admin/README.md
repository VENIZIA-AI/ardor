# @venizia/ardor-admin

The [react-admin](https://marmelab.com/react-admin/) adapter of
[ARDOR](https://github.com/VENIZIA-AI/ardor): every place the framework touches `ra-core`.

```bash
bun add @venizia/ardor-admin @venizia/ardor-kernel @venizia/ardor-react ra-core
```

Most applications install [`@venizia/ardor`](https://www.npmjs.com/package/@venizia/ardor) instead,
which re-exports this package.

## What is in it

| Area | Exports |
|---|---|
| Data | `DefaultRestDataProvider`, `CountRestDataProvider`, `BaseCrudService` |
| Auth | `DefaultAuthProvider` |
| i18n | `DefaultI18nProvider`, `englishMessages`, `vietnameseMessages` |
| Component | `ArdorApplication` - the `CoreAdmin` root, wired from the container |
| Hooks | `useTranslate`, `useNotifyError`, `useRefreshToken`, `useRequestHeaderLocale` |
| Types | `IDataProvider`, `IAuthProvider`, `II18nProviderOptions`, `IApplication`, `TUseTranslateKeys` |

The data provider speaks the `@venizia/ignis-filter` vocabulary - react-admin pagination, sort and
filter are mapped onto `{ where, order, limit, skip, fields, include }`.

## Typing your own message keys

`IUseTranslateKeysOverrides` is declared here, so augment this package:

```typescript
declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, unknown> {}
}
```

## License

MIT - see [LICENSE.md](./LICENSE.md).
