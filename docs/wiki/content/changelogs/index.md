---
title: Changelogs
description: History of significant changes, refactors, and updates to the ARDOR framework
---

# Changelogs

This section tracks the history of significant changes, refactors, and updates to the ARDOR framework.
Every entry follows the [template](./template); a release without an entry is not released.

## Recent Changes

| Date | Title | Type |
|------|-------|------|
| 2026-10-26 | [An arrow function parameter always has parentheses](./2026-10-26-arrow-parens-always) | Enhancement |
| 2026-10-26 | [The network service is split into small parts, and its types are closed](./2026-10-26-network-service-split) | Breaking Change |
| 2026-10-25 | [ARDOR 0.4.1 follows IGNIS 0.4.1](./2026-10-25-ardor-0-4-1) | Breaking Change |
| 2026-10-25 | [Correctness fixes in the kernel, the admin and the hooks](./2026-10-25-correctness-fixes) | Bug Fix |
| 2026-10-24 | [ARDOR 0.4.0 follows IGNIS 0.4.0](./2026-10-24-ardor-0-4-0) | Breaking Change |
| 2026-10-24 | [The knowledge log is gone](./2026-10-24-knowledge-log-dropped) | Enhancement |
| 2026-10-24 | [The fetcher no longer logs secrets, and four request bugs are fixed](./2026-10-24-node-fetcher-fixes) | Security |
| 2026-10-24 | [scripts/ is grouped by purpose](./2026-10-24-scripts-grouped) | Enhancement |
| 2026-10-24 | [The unused scripts and make targets are gone](./2026-10-24-unused-scripts-removed) | Enhancement |
| 2026-10-23 | [The repository formats with bun fmt](./2026-10-23-format-with-bun-fmt) | Enhancement |
| 2026-10-23 | [No project keeps a formatter config any more](./2026-10-23-no-formatter-config) | Enhancement |
| 2026-10-23 | [One code style, set in one bunfig.toml](./2026-10-23-one-code-style) | Enhancement |
| 2026-10-23 | [The keys of package.json are sorted and checked](./2026-10-23-package-json-sorted) | Enhancement |
| 2026-10-23 | [A container stops when a required variable is missing](./2026-10-23-runtime-config-required-env) | New Feature |
| 2026-10-22 | [Runtime config in the app preset, one image for every environment](./2026-10-22-preset-runtime-config) | New Feature |
| 2026-10-21 | [An .env.example that matches the app, ignore files, and a sturdier image](./2026-10-21-preset-env-ignore-image) | Enhancement |
| 2026-10-21 | [A feature library preset](./2026-10-21-preset-lib) | New Feature |
| 2026-10-21 | [A tidy app root and a Dockerfile in the preset](./2026-10-21-preset-root-and-image) | Enhancement |
| 2026-10-20 | [Every app has the same scripts](./2026-10-20-app-script-standard) | Breaking Change |
| 2026-10-20 | [ARDOR 0.3.0 Is Stable](./2026-10-20-ardor-0-3-0-stable) | Enhancement |
| 2026-10-20 | [The preset's typecheck runs bun check](./2026-10-20-preset-bun-check) | Enhancement |
| 2026-10-20 | [Silent first run for the ARDOR preset](./2026-10-20-preset-first-run) | Bug Fix |
| 2026-10-20 | [The preset app's lint scripts are short](./2026-10-20-preset-lint-script) | Enhancement |
| 2026-10-20 | [The preset app imports its own modules with #src](./2026-10-20-preset-subpath-imports) | Enhancement |
| 2026-10-20 | [The generated app is one styled page](./2026-10-20-preset-ui) | Enhancement |
| 2026-10-20 | [ARDOR ships a VULCAN preset](./2026-10-20-vulcan-preset) | New Feature |
| 2026-10-19 | [Augment @venizia/ardor, not the declaring packages](./2026-10-19-augment-the-umbrella) | Bug Fix |
| 2026-10-19 | [toDataUrl no longer needs Promise.withResolvers](./2026-10-19-to-data-url-without-with-resolvers) | Bug Fix |
| 2026-10-19 | [The wiki is rebuilt around the core of ARDOR](./2026-10-19-wiki-rebuild) | Enhancement |
| 2026-10-18 | [start() names a module cycle in the artifact index](./2026-10-18-artifact-cycle-error) | Bug Fix |
| 2026-10-18 | [IGNIS's sign-in is the default, and an application can run with no sign-in](./2026-10-18-auth-optional-and-ignis-sign-in) | Behavior Change |
| 2026-10-18 | [ARDOR follows ignis-boot 0.2.1-11](./2026-10-18-boot-pins-class-names) | Enhancement |
| 2026-10-18 | [A package depends on its siblings at the exact version released with it](./2026-10-18-exact-sibling-versions) | Bug Fix |
| 2026-10-18 | [The final IGNIS chain, and the examples autoload with the Vite plugin](./2026-10-18-final-pin-and-autoload) | Behavior Change |
| 2026-10-18 | [Options hold data, behaviour lives in protected hooks](./2026-10-18-hooks-not-flags) | Behavior Change |
| 2026-10-18 | [Types, hooks and utilities follow IGNIS house style](./2026-10-18-house-style-types-hooks-utilities) | Behavior Change |
| 2026-10-18 | [ARDOR builds on the IGNIS 0.2.2-12 chain](./2026-10-18-ignis-0-2-2-12-chain) | Behavior Change |
| 2026-10-18 | [ARDOR builds on the IGNIS 0.2.2-9 chain](./2026-10-18-ignis-0-2-2-9-chain) | Behavior Change |
| 2026-10-18 | [One copy of each package that carries identity, owned by the application](./2026-10-18-one-copy-of-each) | Behavior Change |
| 2026-10-18 | [The release script waits for each tarball, and vert-admin splits its vendor chunks](./2026-10-18-release-waits-for-the-tarball) | Enhancement |
| 2026-10-18 | [login stores roles, and the sign-in extension points are protected hooks](./2026-10-18-sign-in-hooks) | Enhancement |
| 2026-10-18 | [ARDOR 0.1.4 on stable IGNIS 0.2.2 and VULCAN 0.2.0](./2026-10-18-stable-ignis-0-2-2) | Behavior Change |
| 2026-10-18 | [TPaths stops at a Date, a Set, a function and an any field](./2026-10-18-tpaths-stops-at-values) | Bug Fix |
| 2026-10-17 | [ARDOR's agent tooling is VULCAN](./2026-10-17-agent-tooling-vulcan) | Enhancement |
| 2026-10-17 | [Type checking runs on bun check](./2026-10-17-bun-check) | Enhancement |
| 2026-10-17 | [A generated artifact index for the application](./2026-10-17-generated-artifact-index) | New Feature |
| 2026-10-17 | [PATCH in upper case, log levels, getManyReference without pagination, no NaN count](./2026-10-17-patch-log-levels-pagination-count) | Bug Fix |
| 2026-10-16 | [Every package builds, lints and formats through make](./2026-10-16-make-per-package) | Enhancement |
| 2026-10-16 | [ARDOR lints with oxlint and formats with oxfmt](./2026-10-16-oxlint-oxfmt) | Enhancement |
| 2026-10-15 | [ARDOR 0.1.3, stable on the IGNIS 0.2.2 line](./2026-10-15-ardor-0-1-3-stable) | Enhancement |
| 2026-10-14 | [canAccess reaches an AuthProvider subclass without a fourth super argument](./2026-10-14-permission-provider-from-the-container) | Bug Fix |
| 2026-10-12 | [ARDOR 0.1.2, stable on IGNIS 0.2.1](./2026-10-12-ardor-0-1-2-stable) | Enhancement |
| 2026-10-10 | [checkError redirects on a 401 or 403 from the data provider](./2026-10-10-check-error-reads-status-code) | Bug Fix |
| 2026-10-10 | [The data provider throws an ApplicationError, and reads Content-Range like IGNIS](./2026-10-10-data-provider-errors-through-response-reader) | Behavior Change |
| 2026-10-10 | [useDocumentTitle no longer overwrites a newer title on unmount](./2026-10-10-document-title-cleanup-guard) | Bug Fix |
| 2026-10-09 | [Const-value types keep their literals when copied](./2026-10-09-const-value-types-keep-literals) | Behavior Change |
| 2026-10-09 | [useDocumentTitle and useHtmlLang](./2026-10-09-document-title-and-html-lang-hooks) | New Feature |
| 2026-10-07 | [Class identity survives a minifier](./2026-10-07-class-identity-and-container) | Behavior Change |
| 2026-10-07 | [Feature modules and permissions](./2026-10-07-feature-modules) | New Feature |
| 2026-10-07 | [List extras on the data provider and the repository](./2026-10-07-list-extras) | New Feature |
| 2026-10-06 | [A repository sends what the data provider sends](./2026-10-06-repository-sends-the-session) | Behavior Change |
| 2026-10-02 | [HttpRepository writes and shares the data provider's auth; BaseCrudService is gone](./2026-10-02-repository-writes-and-ignis-0-2-1) | Breaking Change |
| 2026-09-24 | [ARDOR 0.1.1, the first stable line on IGNIS 0.2.0](./2026-09-24-ardor-0-1-1-stable) | Enhancement |
| 2026-09-24 | [Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable](./2026-09-24-remote-repositories-and-relative-base-url) | New Feature |
| 2026-09-23 | [Registration by hand, useRepository, and a clean-install gate](./2026-09-23-registration-by-hand-and-clean-install) | Breaking Change |
| 2026-09-19 | [IGNIS stereotypes and repositories, bulk writes in the body, safer headers](./2026-09-19-ignis-repository-and-bulk-writes) | Breaking Change |
| 2026-09-16 | [The network layer is fetch only, and axios is gone](./2026-09-16-fetch-only-network-layer) | Breaking Change |
| 2026-09-11 | [ARDOR Replaces @minimaltech/ra-core-infra](./2026-09-11-ardor-from-ra-core-infra) | New Feature |
| 2026-09-11 | [One logger per scope, singleton services, and a kernel that owns its headers](./2026-09-11-kernel-hardening) | Enhancement |
