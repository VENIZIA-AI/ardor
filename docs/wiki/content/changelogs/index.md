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
| 2026-10-18 | [The final IGNIS chain, and the examples autoload with the Vite plugin](./2026-10-18-final-pin-and-autoload) | Behavior Change |
| 2026-10-18 | [TPaths stops at a Date, a Set, a function and an any field](./2026-10-18-tpaths-stops-at-values) | Bug Fix |
| 2026-10-18 | [start() names a module cycle in the artifact index](./2026-10-18-artifact-cycle-error) | Bug Fix |
| 2026-10-18 | [One copy of each package that carries identity, owned by the application](./2026-10-18-one-copy-of-each) | Behavior Change |
| 2026-10-18 | [A package depends on its siblings at the exact version released with it](./2026-10-18-exact-sibling-versions) | Bug Fix |
| 2026-10-18 | [Types, hooks and utilities follow IGNIS house style](./2026-10-18-house-style-types-hooks-utilities) | Behavior Change |
| 2026-10-18 | [Options hold data, behaviour lives in protected hooks](./2026-10-18-hooks-not-flags) | Behavior Change |
| 2026-10-18 | [The sign-in extension points are protected hooks, not options](./2026-10-18-sign-in-hooks) | Behavior Change |
| 2026-10-18 | [The release script waits for each tarball, and vert-admin splits its vendor chunks](./2026-10-18-release-waits-for-the-tarball) | Enhancement |
| 2026-10-18 | [ARDOR builds on the IGNIS 0.2.2-12 chain](./2026-10-18-ignis-0-2-2-12-chain) | Behavior Change |
| 2026-10-18 | [login stores roles, and hooks replace a login override](./2026-10-18-login-roles-and-hooks) | Enhancement |
| 2026-10-18 | [The quickstart is the 5-mins-qs example, and says what the bundle is made of](./2026-10-18-quickstart-follows-the-example) | Enhancement |
| 2026-10-18 | [IGNIS's sign-in is the default, and an application can run with no sign-in](./2026-10-18-auth-optional-and-ignis-sign-in) | Behavior Change |
| 2026-10-18 | [ARDOR builds on the IGNIS 0.2.2-9 chain](./2026-10-18-ignis-0-2-2-9-chain) | Behavior Change |
| 2026-10-17 | [VULCAN 0.2.0-3 and the atlas source filter](./2026-10-17-vulcan-0-2-0-3) | Enhancement |
| 2026-10-17 | [Type checking runs on bun check](./2026-10-17-bun-check) | Enhancement |
| 2026-10-17 | [VULCAN 0.2.0-2, docs-update and the D rules](./2026-10-17-vulcan-0-2-0-2) | Enhancement |
| 2026-10-17 | [A generated artifact index for the application](./2026-10-17-generated-artifact-index) | Feature |
| 2026-10-17 | [ARDOR's agent tooling moves to VULCAN 0.2.0-1](./2026-10-17-vulcan-0-2-0) | Enhancement |
| 2026-10-17 | [ARDOR's agent tooling is VULCAN](./2026-10-17-agent-tooling-vulcan) | Enhancement |
| 2026-10-17 | [PATCH in upper case, log levels, getManyReference without pagination, no NaN count](./2026-10-17-patch-log-levels-pagination-count) | Bug Fix |
| 2026-10-16 | [Every package builds, lints and formats through make](./2026-10-16-make-per-package) | Enhancement |
| 2026-10-16 | [ARDOR lints with oxlint and formats with oxfmt](./2026-10-16-oxlint-oxfmt) | Enhancement |
| 2026-10-15 | [ARDOR 0.1.3, stable on the IGNIS 0.2.2 line](./2026-10-15-ardor-0-1-3-stable) | Release |
| 2026-10-14 | [canAccess reaches an AuthProvider subclass without a fourth super argument](./2026-10-14-permission-provider-from-the-container) | Bug Fix |
| 2026-10-12 | [ARDOR 0.1.2, stable on IGNIS 0.2.1](./2026-10-12-ardor-0-1-2-stable) | Release |
| 2026-10-10 | [useDocumentTitle no longer overwrites a newer title on unmount](./2026-10-10-document-title-cleanup-guard) | Bug Fix |
| 2026-10-10 | [checkError redirects on a 401 or 403 from the data provider](./2026-10-10-check-error-reads-status-code) | Bug Fix |
| 2026-10-10 | [The data provider throws an ApplicationError, and reads Content-Range like IGNIS](./2026-10-10-data-provider-errors-through-response-reader) | Behavior Change |
| 2026-10-09 | [Const-value types keep their literals when copied](./2026-10-09-const-value-types-keep-literals) | Behavior Change |
| 2026-10-09 | [useDocumentTitle and useHtmlLang](./2026-10-09-document-title-and-html-lang-hooks) | Feature |
| 2026-10-07 | [Feature modules and permissions](./2026-10-07-feature-modules) | Feature |
| 2026-10-07 | [List extras on the data provider and the repository](./2026-10-07-list-extras) | Feature |
| 2026-10-07 | [Class identity survives a minifier, and the container fixes from IGNIS](./2026-10-07-class-identity-and-container) | Behavior Change |
| 2026-10-06 | [A repository sends what the data provider sends](./2026-10-06-repository-sends-the-session) | Behavior Change |
| 2026-10-02 | [HttpRepository writes, on the IGNIS 0.2.1 prerelease line](./2026-10-02-repository-writes-and-ignis-0-2-1) | Behavior Change |
| 2026-09-24 | [ARDOR 0.1.1, the first stable line on IGNIS 0.2.0](./2026-09-24-ardor-0-1-1-stable) | Release |
| 2026-09-24 | [Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable](./2026-09-24-remote-repositories-and-relative-base-url) | Feature |
| 2026-09-23 | [Registration by hand, useRepository, and a clean-install gate](./2026-09-23-registration-by-hand-and-clean-install) | Breaking |
| 2026-09-19 | [IGNIS stereotypes and repositories, bulk writes in the body, safer headers](./2026-09-19-ignis-repository-and-bulk-writes) | Breaking |
| 2026-09-16 | [The network layer is fetch only, and axios is gone](./2026-09-16-fetch-only-network-layer) | Breaking |
| 2026-09-11 | [One logger per scope, singleton services, and a kernel that owns its headers](./2026-09-11-kernel-hardening) | Behavior Change |
| 2026-09-11 | [ARDOR Replaces @minimaltech/ra-core-infra](./2026-09-11-ardor-from-ra-core-infra) | Breaking |
