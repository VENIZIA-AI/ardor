# @venizia/ardor-kernel

The isomorphic core of [ARDOR](https://github.com/VENIZIA-AI/ardor). No React, no react-admin - the
layer a browser data client and a plain TypeScript consumer can both use.

```bash
bun add @venizia/ardor-kernel @venizia/ignis-inversion @venizia/ignis-filter reflect-metadata
```

Most applications install [`@venizia/ardor`](https://www.npmjs.com/package/@venizia/ardor) instead,
which re-exports this package.

## What is in it

| Area | Exports |
|---|---|
| Application | `AbstractArdorApplication`, `BaseArdorApplication` - an IGNIS inversion `Container` with `injectable()` and `service()` helpers |
| Services | `BaseService`, `BaseApiService`, `DefaultAuthService`, `DefaultNetworkRequestService` |
| Providers | `BaseProvider` |
| Decorators | `api()` - logs and rethrows a failing API method |
| Bindings | `CoreBindings`, `LocalStorageKeys` |
| Constants | `RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `RequestCountData`, `HeaderConsts`, `Environments`, `App` |
| Network | `AxiosNetworkRequest`, `NodeFetchNetworkRequest`, `AxiosFetcher`, `NodeFetcher` |
| Helpers | `Logger`, `BaseHelper`, `SocketIOClientHelper` |
| Utilities | `isDefined`, `isString`, `isNumber`, `isBrowser`, `isValidDate`, `isEditableTarget`, `int`, `float`, `toBoolean`, `toStringDecimal`, `getUID`, `keysToCamel`, `blobToBase64`, `stringify`, `parse` |
| Types | `IdType`, `AnyType`, `AnyObject`, `ValueOrPromise`, `ValueOf`, `TConstValue`, `TPaths`, `TFullPaths`, `ISendParams`, `IRestDataProviderOptions`, `IApplicationInfo`, `ICrudService`, ... |

## License

MIT - see [LICENSE.md](./LICENSE.md).
