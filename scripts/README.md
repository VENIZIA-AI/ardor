# scripts/

Root tooling of the ARDOR monorepo, grouped by purpose. Each group keeps its tests in its own
`__tests__/`. `scripts/tsconfig.json` type-checks all of it (`make lint-scripts`). The wiki's own
VitePress scripts are not here: they live in `docs/wiki/scripts/`.

| Group | Script | What it does | Called by |
|---|---|---|---|
| `release/` | `release.ts` | Plans one release run, sends the one dispatch of the NPM Release workflow, then checks the registry and pulls | `make release`, `make release-plan`, `bun scripts/release/release.ts` (dry run first) |
| `release/` | `release-plan.ts` | What one run releases: the packages in dependency order and the one version (`resolve`), and the dispatch | `release.ts`, `package-release.yml`, step "Plan the run" |
| `release/` | `release-chain.ts` | Releases the packages of a run in order: the checks, then per package the clean-install, bump, pack, publish, wait, commit, push and tag; `report` prints the stop report from its state file | `package-release.yml`, steps "Release the packages" and "Report the run" |
| `release/` | `release-verify.ts` | After a run: the registry holds a new version of every package, then `develop` is pulled | `release.ts` |
| `release/` | `release-scope.ts` | Decides which files make a package need a release (a run now releases the four packages, so `release.ts` no longer reads it) | its test only |
| `release/` | `release-version.ts` | The release version (a semver bump or an explicit one) and the dist-tag rule | `release-plan.ts`, `release-chain.ts`, `package-release.yml`, step "Plan the run" |
| `release/` | `release-wait.ts` | Waits until a published tarball answers 200, and for a run to complete (a run that waits is waited for, and reported) | `release-chain.ts` (the tarball), `release.ts` (the run) |
| `release/` | `release-gates.ts` | The gates between build and publish: artifacts, links, pack, protocols, registry, and healing the `next` tag | `release-chain.ts`, `package-release.yml`, `preset/preset-smoke.ts` (imports it) |
| `preset/` | `vulcan-preset.ts` | Writes the VULCAN presets (`presets/app`, `presets/lib`) into `packages/ardor/dist/presets` with exact versions | `make preset-build`, `release-chain.ts`, `preset-smoke.ts` |
| `preset/` | `preset-smoke.ts` | Creates an app and a library from the packed preset and runs their checks | `make preset-smoke` (CI, release workflow) |
| `checks/` | `layer-boundaries.ts` | No package imports a layer above it | `make layer-check` (CI) |
| `checks/` | `atlas-smoke.ts` | Proves the atlas MCP server answers over this checkout | `make atlas-smoke` (CI, build job) |
| `checks/` | `purity/manifest.ts` | The claims only: which entries are browser-pure and what each leaves external. The engine is `devz check purity` | `make purity`, `make purity-<pkg>` (CI, release workflow) |
| `checks/` | `clean-install/` | Loads each package's published sub-paths from packed tarballs in an empty project under `.agents/local/tmp`; every bare import must come from that project (`sandbox-guard.ts`, `bun-probe.ts`, `node-guard.mjs`) | `make clean-install`, `make clean-install-<pkg>` (CI, release workflow) |
| (root) | `scratch.ts` | `makeScratch`: a new folder under the repo's gitignored `.agents/local/tmp`, never the system temp folder | `preset/preset-smoke.ts`, `checks/clean-install/cli.ts` |
| (root) | `const-value.ts` | `TConstValue`: the union of the string values of a const class (V-C-08), the scripts' copy of the type the packages use | `release/release-version.ts`, `preset/preset-smoke.ts` |
| `build/` | `force-update.sh` | Raises a package's `@venizia/*` dependencies to the registry's highest | the `force-update` script of each package and of the wiki, `make update-<pkg>`, `package-release.yml` |
| `build/` | `refresh-catalog.ts` | Moves every `@venizia/*` entry of the root catalog to the highest published version | `package-release.yml`, by hand |

The cycles, split-report, catalog and purity gates are the shared `devz check <name>` commands of
`@venizia/dev-configs`; this repository keeps their data (`checks/purity/manifest.ts`) and the positive
controls that run the engines on fixtures. `make test-scripts` runs the `__tests__/` of `release/`, `preset/` and
`checks/`. The tests of `checks/purity/` run under `make purity-test`. The test of the preset's entrypoint script
(`preset/__tests__/runtime-config-entrypoint.test.ts`) and the manifest check
(`release/__tests__/sibling-versions.test.ts`) sit with the group they protect.
