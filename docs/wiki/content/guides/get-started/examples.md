---
title: Examples
description: The three runnable ARDOR examples in the repository, what each one shows, and how to run the smallest one.
---

# Examples

Three examples live in [`examples/`](https://github.com/VENIZIA-AI/ardor/tree/main/examples). Start with `5-mins-qs`: the [Quickstart](./5-minute-quickstart) builds it file by file.

| Example | What it shows |
| :--- | :--- |
| [5-mins-qs](https://github.com/VENIZIA-AI/ardor/tree/main/examples/5-mins-qs) | The smallest app that runs: sign-in, a resource list, a service resolved by key, against a stub API |
| [vert-admin](https://github.com/VENIZIA-AI/ardor/tree/main/examples/vert-admin) | An admin console over IGNIS's `vert` API: its auth component, token refresh, a CRUD list |
| [ipc-data-provider](https://github.com/VENIZIA-AI/ardor/tree/main/examples/ipc-data-provider) | `DefaultRestDataProvider.send` over a transport that is not HTTP, the pattern of a desktop shell |

Run the smallest one from a clone of the repository:

```bash
bun install
cd examples/5-mins-qs
bun run server:dev    # the stub API on :3100 (sign in with admin / admin) and Vite on :5173
```

The examples run against the local packages, so build them first with `make build` at the repository root.
