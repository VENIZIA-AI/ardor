---
type: Playbook
title: Splitting a hub file by topic
description: Ordered steps to split a multi-topic types, constants or class file into one-concept files behind the same barrel, with the gates that prove nothing leaked.
resource: scripts/split-report.ts
tags: [process, file-splitting, refactor, surface]
---

## When

`make split-report` lists the file as a hub candidate (over 10 exports), as a file with two or more
exported classes, or as a `types.ts` / `constants.ts` outside `common/`. The count is a prompt; the
criterion is topics. A file whose exports all serve one concept stays. Typical ARDOR candidates: a
`services/` barrel that has grown several unrelated service classes, a `hooks/` file mixing data-hooks
and UI-hooks, or `packages/kernel/src/common/constants.ts` if a new const class family (alongside
`RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `RequestCountData`, `HeaderConsts`,
`Environments`) grows large enough to deserve its own file.

## Steps

1. Measure before writing. List the declarations and which of them reference each other: a topic file
   may import at most ONE sibling; a file that composes its siblings is the parent and may import all.
   If the real graph needs two siblings in a leaf, the grouping is wrong, not the rule.
2. Create `common/types/<topic>.ts` (or `common/constants.ts` for const families) under the scope's
   `common/`, `mkdir -p` first, and move each declaration VERBATIM: bodies, doc comments and the
   comment above a declaration travel together; only import blocks change. Re-base relative imports
   one level per folder added. `common/` never imports its scope root.
3. Write `common/types/index.ts` with alphabetical `export *` lines and keep the scope barrel's
   specifier unchanged (`export * from './types'` now names the folder). A module-private name that had
   to become exported to cross a file boundary is re-exported BY NAME from the scope `index.ts`, never
   through `export *`, or it reaches the package root.
4. Repoint every importer: relative `./types` and `../types`, alias imports such as
   `@ardor/kernel/types` or `@ardor/admin/providers` in tests, and inline `import('./types').X` type
   expressions. Grep, do not trust a list:
   `grep -rnE "from '[./]*types'|import\('[./]*types'\)|<scope>/types" src`.
5. Rebuild CLEAN with `make <package>`. An incremental build leaves the old `types.js` beside the new
   `types/` folder and `tsc-alias` resolves the barrel to the stale file; `ls dist/esm/<scope>/common`
   must show `types/` and no `types.js`.
6. Gates: the package suite and every downstream suite (kernel changes ripple into react and admin,
   which load `dist/esm`), `make lint-<package>`,
   `bun scripts/module-cycles.ts packages/<package>/dist/esm --max 0`, `make surface-check` (never
   `surface-gen` for a split - a changed snapshot means a leak or a loss), `make okf-gen && make okf-check`,
   `make wiki-links-check` (repoint every doc link at the topic file that declares the named symbol).
7. Commit the move and the doc repoints separately: `refactor(<package>): <scope> types split by topic`
   and `docs(wiki): ...`. One line each.

## Traps this playbook exists for

- A bundler initialises modules reached through a dynamic `import()` lazily; a registration that must
  run at import time (an application service registered against a `services.<ClassName>` binding key,
  or a provider registered on the react-admin data provider pipeline) lives in a module listed in
  `sideEffects`, not in a leaf file.
- Moving a runtime helper out of a types file is part of the split: `common/<topic>.ts` for code,
  `common/types/` for types, both behind the same barrel. A const class such as `RequestMethods` keeps
  its `SCHEME_SET` and `isValid` with it, not split into a separate "helpers" file.
- Error helpers built on `getError` / `ApplicationError` from `@venizia/ignis-inversion` stay with the
  domain they describe (network errors with network types, form errors with form types) - do not pull
  them into a generic "errors" hub unless every topic file genuinely shares them.
- Two implementers on one git index: a path-scoped `git commit -- <paths>` is the only safe commit.

## Related

- [Build system](/process/build-system.md)
- [Public surface](/reference/public-surface.md)
- [Const classes](/conventions/const-classes.md)
