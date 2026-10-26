# ARDOR examples

Runnable projects for ARDOR. Each folder has its own README.

| Example | What it shows |
| :--- | :--- |
| [5-mins-qs](5-mins-qs/) | The smallest app that runs: sign-in, a resource list, a service resolved by key, against a stub API |
| [vert-admin](vert-admin/) | An admin console over IGNIS's `vert` API: its auth component, token refresh, a CRUD list |
| [ipc-data-provider](ipc-data-provider/) | `DefaultRestDataProvider.send` over a transport that is not HTTP, the pattern of a desktop shell |

The examples run against the local packages, so build those first:

```bash
bun install && make build
cd examples/5-mins-qs
bun run server:dev    # the stub API on :3100 (sign in with admin / admin) and Vite on :5173
```

The [Quickstart](https://ardor.venizia.ai/guides/get-started/5-minute-quickstart) builds `5-mins-qs` file by file.
