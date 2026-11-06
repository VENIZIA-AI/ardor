# @venizia/ardor-kernel

The isomorphic core of [ARDOR](https://github.com/VENIZIA-AI/ardor). No React, no react-admin - the
layer a browser data client and a plain TypeScript consumer can both use.

```bash
bun add @venizia/ardor-kernel @venizia/ignis-inversion @venizia/ignis-filter @venizia/ignis-helpers @venizia/ignis-kernel reflect-metadata
```

`@venizia/ignis-connectors` is an optional peer, needed only for `./repository`.

`@venizia/ardor-kernel/testing` holds fakes of `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `Storage` and `navigator.clipboard` for your tests; the main entry does not include them.

Most applications install [`@venizia/ardor`](https://www.npmjs.com/package/@venizia/ardor) instead,
which re-exports this package.

## What is in it

| Area | Exports |
|---|---|
| Application | `AbstractArdorApplication`, `BaseArdorApplication` - an IGNIS inversion `Container` with `injectable()`, `service()`, `repository()`, `dataSource()` and `component()` helpers |
| Services | `BaseService`, `DefaultAuthService`, `DefaultNetworkRequestService` |
| Providers | `BaseProvider` |
| Decorators | `api()` - logs and rethrows a failing API method; the IGNIS stereotypes it re-exports (`component`, `configuration`, `datasource`, `inject`, `injectable`, `model`, `provide`, `repository`, `service`) |
| Bindings | `CoreBindings`, `LocalStorageKeys`, `BindingKeys`, `BindingNamespaces` |
| Constants | `RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `RequestCountData`, `HeaderConstants`, `Environments`, `App`, `Authentication`, `StorageAreas`, `RequestChannel` |
| Network | `NetworkHeaders`, `RequestBodyEncoder`, `ResponseReader`, `AuthRecovery`, `AuthTokenStore` (the fetch transport is IGNIS's `NodeFetchNetworkRequest`) |
| Utilities | `ValueUtility` (`isDefined`, `isString`, `isNumber`, `isObject`, `isValidDate`), `BrowserUtility.isBrowser`, `FileUtility.toDataUrl`, `RuntimeConfig.get` (with `RUNTIME_CONFIG_GLOBAL` and `RUNTIME_CONFIG_REQUIRED_CODE`), `BrowserStorage`, `BrowserClipboard`, `StorageCodecs`; the earlier bare names are removed (`bun run ardor codemod namespace` moves your code) |
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
