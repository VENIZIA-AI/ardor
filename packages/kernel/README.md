# @venizia/ardor-kernel

The isomorphic core of [ARDOR](https://github.com/VENIZIA-AI/ardor). No React, no react-admin - the
layer a browser data client and a plain TypeScript consumer can both use.

```bash
bun add @venizia/ardor-kernel @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-helpers @venizia/ignis-kernel reflect-metadata
```

`@venizia/ignis-connectors` is an optional peer, needed only for `./repository`.

Most applications install [`@venizia/ardor`](https://www.npmjs.com/package/@venizia/ardor) instead,
which re-exports this package.

## What is in it

| Area | Exports |
|---|---|
| Application | `AbstractArdorApplication`, `BaseArdorApplication` - an IGNIS inversion `Container` with `injectable()` and `service()` helpers |
| Services | `BaseService`, `DefaultAuthService`, `DefaultNetworkRequestService` |
| Providers | `BaseProvider` |
| Decorators | `api()` - logs and rethrows a failing API method |
| Bindings | `CoreBindings`, `LocalStorageKeys` |
| Constants | `RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `RequestCountData`, `HeaderConstants`, `Environments`, `App` |
| Network | `NetworkHeaders`, `RequestBodyEncoder`, `ResponseReader`, `AuthRecovery`, `AuthTokenStore` (the fetch transport is IGNIS's `NodeFetchNetworkRequest`) |
| Utilities | `ValueUtility` (`isDefined`, `isString`, `isNumber`, `isObject`, `isValidDate`), `BrowserUtility.isBrowser`, `FileUtility.toDataUrl`, `RuntimeConfig.get`; the earlier bare names are removed (`bun run ardor codemod namespace` moves your code) |
| Types | `IdType`, `AnyType`, `AnyObject`, `ValueOrPromise`, `ValueOf`, `TConstValue`, `TPaths`, `TFullPaths`, `ISendParams`, `IRestDataProviderOptions`, `IApplicationInfo`, ... |

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
  <sub><code>@venizia/ardor-kernel</code> is part of ARDOR, built and maintained by <a href="https://venizia.ai">VENIZIA</a>.</sub>
</p>
