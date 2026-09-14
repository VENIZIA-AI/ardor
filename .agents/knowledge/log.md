# Knowledge log

One line per change to a fact in this bundle, newest first. A code change that moves a fact lands
with its line here in the same change (rule P-03).

- 2026-09-14 - The `ra-core-infra` codemod is gone: BANA migrates in one manual pass, so `migrate-ra-core-infra.ts` was deleted and both migration guides now carry the four edits a consumer makes by hand. monorepo-layout no longer lists the script; what-is-ardor no longer calls the move a codemod.
- 2026-09-14 - binding-key-namespaces rewritten against `packages/kernel/src/base/applications/abstract.ts`: ARDOR has no `BindingNamespaces`, no `createNamespace` and no namespace validation - a key is a `CoreBindings` constant or `${scope}.${Class.name}` from `injectable()`. const-classes now cites the real `TConstValue` location; source paths corrected in gotchas, testing, ipc-data-provider and ui-kit.
- 2026-09-11 - Bundle created for ARDOR: overview, packages (5), architecture (10), conventions, process, reference; generated catalogs for providers, hooks and services, binding keys, Makefile targets, source map, public surface.
