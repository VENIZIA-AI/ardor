# scripts/

Root tooling of the ARDOR monorepo, grouped by purpose. Each group keeps its tests in its own
`__tests__/`. `scripts/tsconfig.json` type-checks all of it (`make lint-scripts`). The wiki's own
VitePress scripts are not here: they live in `docs/wiki/scripts/`.

| Group | Script | What it does | Called by |
|---|---|---|---|
| `release/` | `release.ts` | Plans and dispatches the NPM Release workflow one package at a time, in dependency order | `make release`, `make release-plan`, `bun scripts/release/release.ts` (dry run first) |
| `release/` | `release-scope.ts` | Decides which files make a package need a release | `release.ts` |
| `release/` | `release-version.ts` | The release version (a semver bump or an explicit one) and the dist-tag rule | `release.ts`, `package-release.yml`, step "Resolve release target" |
| `release/` | `release-wait.ts` | Waits until a published tarball answers 200 | `release.ts` |
| `release/` | `release-gates.ts` | The gates between build and publish: artifacts, links, pack, protocols, registry, and healing the `next` tag | `package-release.yml`, `preset/preset-smoke.ts` (imports it) |
| `preset/` | `vulcan-preset.ts` | Writes the VULCAN presets (`presets/app`, `presets/lib`) into `packages/ardor/dist/presets` with exact versions | `make preset-build`, `package-release.yml`, `preset-smoke.ts` |
| `preset/` | `preset-smoke.ts` | Creates an app and a library from the packed preset and runs their checks | `make preset-smoke` (CI, release workflow) |
| `checks/` | `check-catalog.ts` | Every shared dependency is `catalog:` and every catalog entry is used | `make catalog-check` (CI, release workflow) |
| `checks/` | `layer-boundaries.ts` | No package imports a layer above it | `make layer-check` (CI) |
| `checks/` | `module-cycles.ts` | Lists import cycles in a built ESM directory; `--max 0` makes it a gate | `make cycles-check` (CI), `split-report.ts` |
| `checks/` | `split-report.ts` | Reports hub files, stray types files and oversized files; never a gate | `make split-report` |
| `checks/` | `atlas-smoke.ts` | Proves the atlas MCP server answers over this checkout | `make atlas-smoke` (CI, build job) |
| `checks/` | `purity/` | Bundles every entry claimed browser-pure and fails on a node builtin or global | `make purity`, `make purity-<pkg>` (CI, release workflow) |
| `checks/` | `clean-install/` | Loads each package's published sub-paths from packed tarballs in an empty project | `make clean-install`, `make clean-install-<pkg>` (CI, release workflow) |
| `build/` | `force-update.sh` | Raises a package's `@venizia/*` dependencies to the registry's highest | the `force-update` script of each package and of the wiki, `make update-<pkg>`, `package-release.yml` |
| `build/` | `refresh-catalog.ts` | Moves every `@venizia/*` entry of the root catalog to the highest published version | `package-release.yml`, by hand |
| `wiki/` | `wiki-anchors.ts` | Every `#fragment` the wiki links to exists on its page | `make wiki-anchors-check` (CI) |
| `wiki/` | `wiki-source-links.ts` | Every source path the wiki and the knowledge bundle name is tracked by git | `make wiki-links-check` (CI) |

`make test-scripts` runs the `__tests__/` of `release/`, `preset/`, `checks/` and `wiki/`. The tests of
`checks/purity/` run under `make purity-test`. The test of the preset's entrypoint script
(`preset/__tests__/runtime-config-entrypoint.test.ts`) and the manifest check
(`release/__tests__/sibling-versions.test.ts`) sit with the group they protect.
