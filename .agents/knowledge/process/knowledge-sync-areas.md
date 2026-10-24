---
type: Playbook
title: Knowledge-sync area map
description: Which concepts the knowledge-sync skill verifies when an area of ARDOR's code changes - ARDOR's map for VULCAN's shipped skill.
resource: packages
tags: [process, knowledge, knowledge-sync]
---

VULCAN ships the `knowledge-sync` skill (`node_modules/@venizia/vulcan/base/skills/knowledge-sync/`);
its Step 1 builds one verifier target per changed code area. **Use this map in ARDOR, not the table
inside the shipped skill** - VULCAN 0.1.0-0 still carries IGNIS's areas there (`packages/core-server`,
`packages/connectors`), none of which exist in ARDOR.

Extend the map when a new area appears, and keep it in step with the concepts it names.

| Changed area | Concepts to verify (under `.agents/knowledge/`) |
|---|---|
| `packages/kernel/src/base/applications`, `src/base/metadata`, `src/base/decorators` | architecture/application-lifecycle, architecture/di-in-the-browser, conventions/binding-key-namespaces, packages/kernel |
| `packages/kernel/src/base/services`, `src/helpers/networks` | architecture/data-provider-pipeline, architecture/auth-recovery, architecture/no-auth-paths, architecture/header-protocol, reference/key-source-files, packages/kernel |
| `packages/kernel/src/base/providers` | architecture/di-in-the-browser, process/adding-a-provider |
| `packages/kernel/src/common` | conventions/const-classes, conventions/binding-key-namespaces, conventions/error-handling, architecture/header-protocol |
| `packages/kernel` (broad/other) | packages/kernel, process/debugging, conventions/gotchas |
| `packages/react/src/hooks`, `src/contexts` | packages/react, architecture/hooks-and-context, architecture/module-augmentation, conventions/react-hooks, process/adding-a-hook |
| `packages/admin/src/providers` | architecture/data-provider-pipeline, architecture/auth-recovery, architecture/i18n, packages/admin |
| `packages/admin` (hooks, broad/other) | packages/admin, architecture/error-flow, conventions/react-hooks |
| `packages/ardor` | packages/ardor, overview/what-is-ardor |
| `examples/<x>` | examples/&lt;x&gt; |
| `Makefile`, `make/`, `scripts/`, `.githooks/`, root `package.json` | process/build-system, process/testing, process/git-workflow, process/release-publish, overview/build-run-test, conventions/gotchas |
| `.github/workflows/` | process/release-publish, process/testing, process/updating-the-wiki |
| `docs/wiki` | process/updating-the-wiki |

The heavy areas - the kernel base and the data layer (services, providers, `rest-data`) - get the
stronger verifier model; small areas get the lighter one.

## Related

- [Updating the wiki](/process/updating-the-wiki.md)
- [Build system](/process/build-system.md)
