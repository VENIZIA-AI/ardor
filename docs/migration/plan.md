# ARDOR roadmap - from a ported package to a framework at the IGNIS standard

Status: **M0-M4 delivered; M5 is the release itself and is in the owner's hands.** Section 4 records what shipped and section 7 what remains. Converting `ra-core-infra` was step zero.
This document is the whole distance between what ARDOR is today and what IGNIS already is, measured
pillar by pillar against the IGNIS checkout, with the exact IGNIS artifact to copy or adapt for each
one. It is deleted when milestone M5 closes.

## 1. The measuring stick: what makes IGNIS complete

Read from `/home/tanphat199/Workspace/save/venizia/ignis` on 2026-09-11. Every row is an artifact
that exists there today.

| Pillar | IGNIS artifact | What it guarantees |
|---|---|---|
| **P1 Code** | 10 packages in dependency order; `scripts/public-surface.ts` (+ `make surface-gen/check`); `scripts/module-cycles.ts`; `scripts/check-catalog.ts`; `scripts/purity/` (browser purity probe); `scripts/split-report.ts` | The public surface is a tracked snapshot, cycles and catalog drift are caught, browser-pure packages stay pure |
| **P2 Tests** | `src/__tests__/` per package mirroring modules, Bun runner only, `.env.test`, `make test-<pkg>` and `test-all`; 416 test files across packages; scripts have their own `scripts/__tests__` | Every behavior has a witness; downstream suites test `dist` |
| **P3 Wiki** | `docs/wiki` = VitePress package `@venizia/ignis-docs`: `content/{guides,references,extensions,best-practices,changelogs}` (319 md), `site/` theme, `DESIGN-SYSTEM.md` + design tokens, `scripts/check-sidebar.mts` gate in `docs-build.sh`, `scripts/wiki-source-links.ts`, `deploy-docs.yml` on push to `main` | Human docs are navigable (unlinked page = build failure), cite real source paths, and deploy themselves |
| **P4 Changelogs** | `content/changelogs/YYYY-MM-DD-<slug>.md` per release from `template.md` (title/description frontmatter, badges, "In one line", What changed, Who is affected, Breaking changes before/after), `index.md` | A consumer can read what a version changed and whether to act |
| **P5 Knowledge bundle** | `.agents/rules.md` (W/S/P/B/C, cited by id); `.agents/knowledge/` in OKF (74 files: overview, packages, architecture, conventions, process, examples, reference incl. generated), `log.md`; `.agents/knowledge-tools/` (`okf.ts gen/check/coverage/viz`, all repo-specifics in `config.ts`); `AGENTS.md` routing only, per-tool files symlinked by `.agents/plugin/setup.ts`; skills `knowledge-sync`, `update-wiki`; a session-start hook that prints the rules | An agent starts from curated truth, not from re-deriving the repo; the bundle is machine-checked for frontmatter, links, coverage, freshness |
| **P6 MCP** | `packages/atlas` = `@venizia/ignis-atlas`: `search`/`get` over wiki + changelogs + knowledge (bun:sqlite FTS5), `symbol` (from `scripts/atlas-symbols.ts`), `version`/`changes` (from `scripts/atlas-releases.ts`), `.mcp.json`, `scripts/atlas-pack-smoke.ts` | "What does the manual say" is a tool call with a citation, inside and outside the repo |
| **P7 Release & CI** | `ci.yml` (gates: `catalog-check`, `okf-check`, `purity-test`; then `build-all`, `test-<pkg>` each, `lint-all`); `package-release.yml` dispatch per package; `scripts/release.ts` runs the chain in dependency order and reads the registry back; `release-local.ts`; `force-update highest`; atlas tables regenerated at the tail of every chain; the downstream consumer measured with a symlinked build before dispatch | A release is a reproducible chain, not a sequence of clicks |
| **P8 Examples** | `examples/*` (12 runnable apps), each with a concept in the bundle and a row in the README, `make lint-examples` | The framework is demonstrated, not described |
| **P9 Governance** | README (badges, install, hello world, "what you get", packages table with latest/highest, "is it for you", examples, contributing, credits); `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE.md`; per-package README with badges + LICENSE.md; `.githooks/pre-commit`; `make help` | A stranger can install, judge fit, contribute and report a vulnerability without asking |

## 2. Where ARDOR stands against it

| Pillar | ARDOR today | Gap |
|---|---|---|
| P1 Code | 4 framework packages + ui-kit; build green; lint green; export + member parity with the legacy package proven | No surface snapshot, no cycle check, no catalog check, no purity probe (kernel and react MUST be browser-pure and `ra-core`-free - the same guarantee `ignis-kernel` carries), no size budgets |
| P2 Tests | 0 test files. Two throwaway smoke runs existed and were deleted | Everything. The legacy package shipped 10 months of data-layer behavior with no test |
| P3 Wiki | `docs/migration/ra-core-infra.md`; a dangling `deploy-docs.yml` expecting `packages/docs/site` + `make docs`. Legacy has a 130-file AI-written VitePress site that is stale (teaches removed APIs, misses ~8 months of features) | The whole site, on the IGNIS layout, written against the code, plus the gate scripts |
| P4 Changelogs | none | The convention, the template, the first entry (the migration itself) |
| P5 Knowledge | none - no rules, no bundle, no AGENTS.md, no plugin | The whole bundle. `knowledge-tools` is portable by design (`config.ts` is the only repo-specific file) |
| P6 MCP | none | Decision D8: make atlas multi-repo upstream in IGNIS and consume it, or fork |
| P7 Release & CI | `package-release.yml` (dropdown updated); no `ci.yml`; no chain script; no consumer measurement | `ci.yml`, `release.ts` adapted to the ARDOR chain, the BANA measurement procedure codified |
| P8 Examples | none | `5-mins-qs` and a reference app; the natural one is an ARDOR admin over IGNIS's `vert` API - the family demonstrated end to end |
| P9 Governance | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, root + per-package `LICENSE.md`/`README.md`, `.githooks/pre-commit` | `SECURITY.md`; README rewritten to the IGNIS shape (badges, packages table latest/highest, "is it for you") |

## 3. Workstreams

Each names its deliverables, the IGNIS source it derives from, and how it is verified. "Copy" means
byte-for-byte with the brand swapped; "adapt" means the shape is kept and the content is ARDOR's.

### WS1 - Rules, agent routing, plugin (P5, foundation for everything else)

| Deliverable | From IGNIS | Note |
|---|---|---|
| `.agents/rules.md` | `.agents/rules.md` | Adapt. W-06 keeps BANA read-only. C-18 hard stack becomes: React, react-admin (`ra-core`) as the admin adapter only, Tailwind + Radix in ui-kit, `@venizia/ignis-filter` as the only query vocabulary, `@venizia/ignis-inversion` as the only container. B-05 (`dist`, not `src`) unchanged - it already bit once in this migration (`BaseCrudService`) |
| `AGENTS.md` | `AGENTS.md` | Copy, brand swapped |
| `.agents/plugin/{setup.ts,PLUGIN.md,claude/*,skills/*}` | same paths | Copy. `session-start.ts` reads rules by id, so it works unchanged once rules exist |
| `make agent-setup` | Makefile target | Copy |

Verification: `make agent-setup` on a fresh clone creates the symlinks; the hook prints ARDOR rules.

### WS2 - Test harness and behavioral suite (P2)

| Deliverable | From IGNIS | Note |
|---|---|---|
| `src/__tests__/` per package, `tsconfig.build.json` excludes them (already does) | `packages/*/src/__tests__` | Adapt layout |
| `.env.test` per package; `test` / `test:watch` scripts; `make test-<pkg>`, `make test-all` | `packages/atlas/package.json`, Makefile | Copy shape |
| DOM for hooks: `happy-dom` + `@testing-library/react` (D1) | none in IGNIS (server) | ARDOR-specific |
| The suite from **Appendix A** - one `describe` per behavioral commitment, each watched red on a mutation before it is kept (P-15) | - | ARDOR-specific |
| Locale completeness test: both bundles satisfy `TranslationMessages` with identical key sets | - | catches the `ra.validation.unique` class of failure |
| `conventions/testing-conventions.md` in the bundle | same | Adapt (bracket notation for protected members, Bun only) |

Verification: `make test-all` green; per-file counts reported; the mutation log kept in the PR.

### WS3 - Code hardening and quality gates (P1)

| Deliverable | From IGNIS | Note |
|---|---|---|
| `types: []` override in kernel/react/admin; explicit return type on `getRequestHeader` | - | F1 from the audit: Bun's `Headers` is inlined into a browser `.d.ts` today |
| `scripts/purity/` probe: kernel and react import no Node builtin and no `ra-core`; admin imports no Node builtin | `scripts/purity/{cli,manifest,probe}.ts` | Adapt the manifest; the probe is generic |
| `scripts/public-surface.ts` + `make surface-gen/check`, snapshot committed | same | Copy; reads each package `exports` |
| `scripts/module-cycles.ts`, `scripts/check-catalog.ts` + `make catalog-check` | same | Copy |
| `size-limit` budget per package (D2) | legacy `rebuild.sh` | Restore a gate the legacy package had |
| `Logger` per scope (D3); `service()`/`injectable()` singleton by default (D4); `preConfigure` binds `APPLICATION_INSTANCE` (D5) | - | Behavior changes, each pinned by a WS2 test first |
| `split-report.ts` + `conventions/file-splitting.md` | same | Copy; `rest-data.ts` (600 lines) and `network-request.ts` (580) are the first hub candidates |

Verification: `make purity-test`, `make surface-check`, `make catalog-check` green and wired into CI (WS7).

### WS4 - Wiki (P3, P4)

| Deliverable | From IGNIS | Note |
|---|---|---|
| `docs/wiki` package `@venizia/ardor-docs`: `site/` (config, theme), `content/`, `scripts/{docs-build.sh,docs-clean.sh,check-sidebar.mts,force-update.sh}`, `DESIGN-SYSTEM.md` + design tokens | `docs/wiki/*` | Copy the package shape and the design system; ARDOR content. D6 moves the dangling workflow to this path |
| `content/guides`: get-started (install, 5-minute quickstart, philosophy - "react-admin's data contract, IGNIS's container"), tutorials (build an admin over an IGNIS API) | `content/guides` | Adapt structure |
| `content/references`: application, binding keys, data provider (filter mapping, header protocol, count modes, blob responses), auth provider + recovery + no-auth paths, i18n, React context and hooks, Redux factories, network layer, utilities, types, module augmentation | legacy `api-reference/*` **audited page by page against the code** | Every fenced `ts`/`tsx` block is compiled by a docs typecheck script; a page is done when it compiles |
| `content/extensions`: ui-kit, socket client, CountRestDataProvider, Tauri/IPC data provider pattern (from BANA's real use) | `content/extensions` | Adapt |
| `content/best-practices`: from legacy `guides/*/best-practices.md`, verified | legacy | Audit, rewrite |
| `content/changelogs/{template.md,index.md}` + the first entry `2026-09-11-ardor-from-ra-core-infra.md` | `content/changelogs` | Copy template; write the entry from `docs/migration/ra-core-infra.md` |
| `scripts/wiki-source-links.ts` + `make wiki-links-check` | same | Copy |
| `.github/workflows/deploy-docs.yml` fixed to `docs/wiki` | same | Copy |

Verification: `make docs` builds with the sidebar gate; the docs typecheck passes; `wiki-links-check` green; deployed preview reviewed.

### WS5 - Knowledge bundle (P5)

| Deliverable | From IGNIS | Note |
|---|---|---|
| `.agents/knowledge-tools/` | same | Copy `okf.ts`, `lib.ts`, `viz.ts`, `vendor/`; write `config.ts` for ARDOR (paths: `packages`, `examples`, `docs/wiki`, `kernel/src/common/keys.ts` as the bindings source, hooks dirs as the catalog sources) |
| `.agents/knowledge/index.md`, `log.md` | same | Adapt |
| `overview/`: what-is-ardor, onboarding, monorepo-layout, build-run-test, design-decisions (the 4-package split, the augmentation seam, why react-admin is confined to `admin`) | `overview/*` | Adapt |
| `packages/`: kernel, react, admin, ardor, ui-kit, docs | `packages/*` | Adapt |
| `architecture/`: application-lifecycle, di-in-the-browser, data-provider-pipeline, auth-recovery, no-auth-paths, header-protocol, i18n, hooks-and-context, module-augmentation, error-flow (from `getError` to `useNotifyError`) | `architecture/*` | ARDOR content |
| `conventions/`: copy options-objects, coding-style, error-handling, const-classes, binding-key-namespaces, docs-writing-style, gotchas; add react-hooks (options object, `use*`, no floating promises) | `conventions/*` | Copy + one ARDOR file |
| `process/`: build-system, testing, release-publish (the ARDOR chain and the BANA measurement), adding-a-provider, adding-a-hook, updating-the-wiki | `process/*` | Adapt |
| `reference/`: glossary, key-source-files, external-links; generated: source-map, binding-keys, hooks catalog, makefile-targets | `reference/*` | Renderers for hooks/providers added to `okf.ts` |

Verification: `make okf-check` and `make okf-coverage` green; `make okf-viz` renders.

### WS6 - MCP (P6)

Decision D8 chooses the path:

- **D8-a (recommended): make atlas multi-repo upstream.** In IGNIS, `packages/atlas/src/common/layout.ts` pins `WORKSPACE_PACKAGE_NAME = '@venizia/ignis-workspace'` and `constants.ts` pins `SERVER_NAME = 'ignis-atlas'`; the corpus roots are already a function of `repositoryRoot`. A small IGNIS change makes both configurable (`--workspace`/`--name`, or reading them from the root manifest), then ARDOR registers `bunx @venizia/ignis-atlas mcp` in `.mcp.json` with its own roots and ships `releases.json`/`symbols.json` generated by copies of `scripts/atlas-symbols.ts` and `atlas-releases.ts`. One implementation, two corpora (C-16).
- **D8-b: fork as `@venizia/ardor-atlas`.** Works today, but two copies of a 2 000-line server drift immediately.

Either way: `.mcp.json`, `make symbols-gen/check`, `make releases-gen/check`, `scripts/atlas-pack-smoke.ts`, and the atlas tail in the release chain (WS7).

Verification: `search({ query: "no-auth paths", corpus: "knowledge" })` returns the ARDOR concept with a citation; `symbol({ name: "useInjectable" })` resolves.

### WS7 - Release chain and CI (P7)

| Deliverable | From IGNIS | Note |
|---|---|---|
| `.github/workflows/ci.yml`: gates (`catalog-check`, `okf-check`, `purity-test`) then `build-all`, `test-<pkg>` each, `lint-all` | `ci.yml` | Copy, package list swapped |
| `scripts/release.ts`, `release-local.ts` with the ARDOR chain `kernel -> react -> admin -> ardor (-> docs) (-> atlas tail)` | same | Adapt the chain table; the registry read-back logic is generic |
| Release commit format aligned with what `atlas-releases.ts` parses (`chore(<package>): release v<version>`) | `package-release.yml` | Verify ARDOR's workflow writes the same message |
| `process/release-publish.md`: the BANA measurement - copy BANA without `node_modules`, symlink `node_modules` with every `@venizia/ardor*` pointed at the fresh build, `tsc --noEmit` per app, diff against the pinned run; every new error maps to a documented breaking change | same concept | Copy the procedure; it is exactly what a 4 900-file consumer needs |
| `make release-plan`, `make release` | Makefile | Copy |

Verification: `bun scripts/release.ts --dry-run` prints the ARDOR chain; CI green on `develop`.

### WS8 - Examples (P8)

| Example | What it shows | Backend |
|---|---|---|
| `examples/5-mins-qs` | The smallest ARDOR app: one resource, `ArdorApplication`, `useInjectable`, `useTranslate`; Vite | a `Bun.serve` stub in the example |
| `examples/vert-admin` | The family reference: an admin console over IGNIS's `examples/vert` API - CRUD, auth with recovery, RBAC-driven UI, i18n, a custom `BaseApiService`, an `AuthProvider` subclass, module augmentation | IGNIS `vert` |
| `examples/ipc-data-provider` | `DefaultRestDataProvider.send` overridden for a non-HTTP transport - the pattern BANA's Tauri app uses | none |

Each gets a concept in `knowledge/examples/`, a README row, and `make lint-examples`.

Verification: each example boots and its documented flow runs; `vert-admin` logs in against a running `vert`.

### WS9 - Governance and README (P9)

| Deliverable | From IGNIS |
|---|---|
| README rewritten to the IGNIS shape: badges, install, hello world (the quick start already verified), "what you get", packages table with latest/highest badges, "is ARDOR for you" (yes: a react-admin app that must scale with a team and share IGNIS's container; no: a marketing site or a 3-screen tool), examples, contributing, credits | `README.md` |
| `SECURITY.md` | `SECURITY.md` |
| Per-package README to the atlas README shape (badges, one-line role, install, the package's tools/exports, links) | `packages/atlas/README.md` |
| `make help` regenerated from targets | Makefile |

## 4. Milestones and order

Order is forced by dependencies: rules before anything an agent writes; tests before behavior
changes; behavior before docs describe it; docs before the bundle cites them; the bundle before
MCP serves it; everything before release.

| Milestone | Workstreams | Exit criterion |
|---|---|---|
| **M0 Foundations** | WS1, WS7 (ci.yml skeleton), WS3 (scripts copied, gates wired) | `make agent-setup`, `make catalog-check`, `make surface-gen`, `make purity-test` run; CI runs them |
| **M1 Proven code** | WS2, WS3 (D3/D4/D5 + F1 + size budgets) | `make test-all` green with the Appendix A suite; surface snapshot committed; parity scripts re-run after the changes |
| **M2 Documented** | WS4 | `make docs` green with the sidebar gate; every legacy page either rewritten against the code, replaced, or deleted with the reason in the changelog; first changelog published |
| **M3 Curated** | WS5, WS6 | `make okf-check` green; atlas answers over the ARDOR corpora |
| **M4 Demonstrated** | WS8 | three examples run; `vert-admin` talks to IGNIS `vert` |
| **M5 Shipped** | WS7 (chain), WS9, BANA migration (codemod `--apply`, inversion bump, per-app `tsc`, the hand-crosscheck list: 4 `AuthProvider` subclasses, `TauriIpcDataProvider`, `NxOAuthNetworkService`, 24 `getNetworkService()` files, 10 augmentation files), `npm deprecate` of the legacy package | BANA green on 9 apps; `@venizia/ardor` on `latest`; this file deleted |

## 5. Decisions required

| # | Decision | Recommendation |
|---|---|---|
| D1 | Hook test environment | `happy-dom` + `@testing-library/react` |
| D2 | Bundle budgets | `size-limit`, budget = current dist + 20 % per package |
| D3 | `Logger` per scope | Yes - the singleton makes every scope lie |
| D4 | Default binding scope for `service()`/`injectable()` | `SINGLETON` - 31/31 BANA bindings set it by hand |
| D5 | Framework binds `APPLICATION_INSTANCE` | Yes |
| D6 | Docs home | `docs/wiki` exactly like IGNIS; fix the workflow rather than keep `packages/docs` |
| D7 | First version | `0.1.0` on `next`, promoted after BANA |
| D8 | MCP | D8-a: make atlas multi-repo upstream in IGNIS and consume it. Fallback D8-b fork |
| D9 | Reference example backend | IGNIS `examples/vert` - the family shown end to end |
| D10 | Legacy docs | Audit-and-rewrite, never copy: the site teaches removed APIs (`getClientError`, `@loopback/filter`) and misses ~8 months of features |

## 6. Out of scope, on purpose

- `@minimaltech/ra-infra` (MUI predecessor): 0 BANA imports.
- Making the data layer react-admin-independent: `admin` already confines `ra-core`; swapping it is a later design once the reference example exists.
- BANA's own test suite: theirs to run; ARDOR supplies the measurement procedure and the codemod.

## Appendix A - Behavioral commitments the suite pins

Extracted from the diffs of the 57 feature commits of `ra-core-infra` (2025-10-28 -> 2026-08-21).
Each line is one test, named after the commit that introduced the behavior.

**Data provider (`685e13d`, `4b19214`, `1cf78b6`, `66e6a02`, `83f78f1`)**
- `getList`: `perPage` -> `limit`; `(page-1)*perPage` -> `skip` and `offset`; `sort` -> `order: ["field ORDER"]`; a filter without `where` is wrapped and `include`/`fields`/`params`/`noLimit` are lifted out; `noLimit` removes `limit`/`skip`/`offset`; `filter.params` and `meta` become query-string keys.
- `getMany`: `where.id = { inq: ids }` merged over `meta.filter.where`. `getManyReference`: `where[target] = id`. `getOne`: `paths = [resource, id]`.
- Total from `content-range` (`unit start-end/total`), fallback row count. `DATA_WITH_COUNT` expects `{ data, count }` and throws otherwise; `DATA_ONLY` reads `x-response-count`.
- `parseResponse`: 204 -> `{ data: {} }`; attachment or non-textual content-type -> `Blob` + `filename`; textual -> JSON. Non-2xx -> throws `body.error ?? body`.
- `bodyType` `form-data` appends `File`/`File[]`/`FileList` with filenames; `x-www-form-urlencoded` appends non-empty keys; default sets `content-type: application/json`.
- Headers on every request: `Timezone`, `Timezone-Offset`, `x-request-channel` (default `100_WEB`), `x-request-count`, `x-request-id` (`${app.name}_${uuid}` unless `requestTracingId` is a function), plus option headers and `setHeaders`/`removeHeaders` mutations.
- No-auth: `useAuth: false` global; `noAuthPaths` exact resource; `noAuthPathRegex` (string | RegExp | array) on resource or joined paths; otherwise a missing token throws 401.
- Recovery: one shared in-flight `refreshToken()` per 401 burst, one retry with the new header; `refreshTokenPath` and no-auth paths never recover; failure calls `onAuthFailure` and returns the original 401.
- `CountRestDataProvider`: `GET resource` + `GET resource/count` with `where`; `total = count ?? 0`.

**Auth (`a87c861`, `dfb5636`)** - `login` posts to `paths.signIn`, saves `{ token, userId, username }`, resolves `redirectTo` from `endpoints.afterLogin` with double slashes removed; `checkAuth` rejects to `login` without a token, and on a falsy `paths.checkAuth` body; `checkError` 401 -> `cleanUp` + login, 403 -> `/unauthorized` with `logoutUser: false`; `cleanUp` removes only `@app/auth/*` and `@app/oauth2/*`.

**Application (`83789f2`)** - `start()` = `preConfigure` (binds `APPLICATION_INFO`, awaits `bindContext`) then `postConfigure`; `injectable(scope, Class)` binds `${scope}.${Class.name}`; `service()` uses `services` - the vocabulary of BANA's 119 keys.

**React (`e12dac6`, `ae0b2d8`, `a1e4d80`, `9bb1991`, `8f0ae07`, `target` edit)** - `useInjectable({ key })` from context or explicit container, `{ target }` through the metadata registry with a named error when unbound; `useTranslate` is identity without a provider; `useNotifyError` notifies `normalized.code` with `normalized.args`; `useRefreshToken` invalidates `['auth','getPermissions']`; `useDebounce` default delay and browser-only; `useAutosave` skips first render, saves on unmount only when asked; `TPaths` stops at arrays, `TFullPaths` descends; i18n initial locale from the browser when listed, else `en`, missing key returns the key.

## 7. Delivered and remaining (2026-09-11)

| Milestone | State | Evidence |
|---|---|---|
| M0 Foundations | done | `.agents/rules.md` + `AGENTS.md` + plugin; `scripts/` gates from IGNIS (`public-surface`, `check-catalog`, `purity`, `module-cycles`, `split-report`, `wiki-source-links`, `layer-boundaries`, `refresh-catalog`); `ci.yml`; `SECURITY.md` |
| M1 Proven code | done | 219 tests across kernel/react/admin (Bun runner, happy-dom for hooks); F1-F5 landed; `bindingList()` added after the production-minifier finding; changelog `2026-09-11-kernel-hardening` |
| M2 Documented | done | `docs/wiki` on the IGNIS site shape with the water palette; 28 pages; every ```ts fence compiled against the built packages (`scripts/check-snippets.mts`, 116 checked); `ardor.venizia.ai` with `CNAME` |
| M3 Curated | done | 51-concept bundle, `okf-check` green, generated catalogs; atlas made multi-repo in IGNIS (`workspaceFamilyOf`) and proven over this checkout by `scripts/atlas-smoke.ts` |
| M4 Demonstrated | done | `examples/5-mins-qs` (browser-verified sign-in, list, service), `examples/vert-admin` (builds; needs a running `vert`), `examples/ipc-data-provider` (runs) |
| M5 Shipped | **owner** | see below |

Remaining, in order - each is a git write or a registry write, which an agent never does alone (W-01, W-04):

1. Commit this working tree on a `feature/*` branch and open the PR to `develop`.
2. In IGNIS: commit `packages/atlas` (family checkouts) with its changelog and release `atlas`; until then `.mcp.local.example.json` shows how to run atlas from the IGNIS checkout.
3. `bun scripts/release.ts --dry-run`, then release the chain `kernel -> react -> admin -> ardor -> ui-kit` (prerelease first).
4. Measure BANA against the fresh build the way `process/release-publish.md` describes, run the codemod with `--apply`, bump `@venizia/ignis-inversion` there to the highest line, `tsc` per app.
5. `npm deprecate @minimaltech/ra-core-infra`, then delete `scripts/migrate-ra-core-infra.ts`, `docs/migration/` and this file.
