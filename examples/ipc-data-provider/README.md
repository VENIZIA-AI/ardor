# ipc-data-provider

`DefaultRestDataProvider.send` overridden for a transport that is not HTTP - the pattern a desktop
shell (Tauri's `invoke`, an Electron bridge, a Worker port) uses while keeping the same
`IDataProvider` shape every hook and service expects. Runs as a plain Bun script:

```bash
cd examples/ipc-data-provider
bun run server:dev
```

Only `send()` is replaced. Filter mapping, `value()` and the react-admin methods still come from
the base class; a shell with no HTTP at all overrides those the same way.

---

<p align="center">
  <a href="https://venizia.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://venizia.ai/assets/logo-white.svg">
      <img src="https://venizia.ai/assets/logo.svg" alt="VENIZIA" height="28">
    </picture>
  </a>
  <br>
  <sub>ARDOR is built and maintained by <a href="https://venizia.ai">VENIZIA</a>.</sub>
</p>
