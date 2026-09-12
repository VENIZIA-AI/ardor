# ipc-data-provider

`DefaultRestDataProvider.send` overridden for a transport that is not HTTP - the pattern a desktop
shell (Tauri's `invoke`, an Electron bridge, a Worker port) uses while keeping the same
`IDataProvider` shape every hook and service expects. Runs as a plain Bun script:

```bash
cd examples/ipc-data-provider
bun run start
```

Only `send()` is replaced. Filter mapping, `value()` and the react-admin methods still come from
the base class; a shell with no HTTP at all overrides those the same way.
