<div align="center">

# <img src="https://ardor.venizia.ai/logo.svg" alt="" height="32" align="top"> ARDOR - @venizia/ardor-docs

**Documentation site for the ARDOR framework**

[![License](https://img.shields.io/badge/License-MIT-3DA639.svg?style=flat-square)](LICENSE.md)

VitePress site with the guides, references, extensions, best practices and changelogs of ARDOR.
It is a private workspace package, not published to npm.

[Online docs](https://ardor.venizia.ai) &#8226; [Main repository](https://github.com/VENIZIA-AI/ardor)

</div>

---

## Development

```bash
bun run docs:dev       # dev server
make docs              # build, with the sidebar and snippet gates
bun run docs:preview   # preview the build
make lint-wiki         # lint the site and its scripts
```

## Structure

```
docs/wiki/
├── content/
│   ├── guides/          # get-started (quickstart, philosophy), migration
│   ├── references/      # application, features, binding keys, data provider, network, auth, i18n, hooks
│   ├── extensions/      # socket client, count provider, custom transport
│   ├── best-practices/  # module augmentation, binding keys, services, auth recovery
│   └── changelogs/      # one entry per significant change
├── site/.vitepress/     # config (the sidebar) and theme
└── scripts/             # check-sidebar.mts, check-snippets.mts, docs-build.sh
```

Every page must be reachable from the sidebar in `site/.vitepress/config.mts`; `scripts/check-sidebar.mts`
fails the build on an orphan page or a dead link, and `scripts/check-snippets.mts` compiles every
```` ```ts ```` fence against the built packages.

## MCP

`vulcan sync` registers `atlas` in your `.mcp.json` (a per-machine file, ignored by git): VULCAN's atlas (`vulcan x atlas mcp`) run
against this checkout, which searches this site, its changelogs and the agent knowledge bundle.

## License

MIT - see [LICENSE.md](LICENSE.md).

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
