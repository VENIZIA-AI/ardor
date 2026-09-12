---
okf_version: "0.1"
title: ARDOR knowledge bundle
description: The curated, agent-facing source of truth for the ARDOR framework.
---

# ARDOR knowledge

Curated knowledge about the ARDOR framework, for agents and for humans. Start here rather than
re-deriving the project from the source each session.

**The code is ground truth.** These concepts are curated prose over the code. When the two disagree,
the code wins and the concept is a bug - fix it and note it in [log](/log.md).

Served over MCP by `ardor-atlas`, registered in `.mcp.json`: `search` with
`corpus: "knowledge"` finds a concept, `get` reads one by the id a search hit returned.

## Start here

| Concept | What it answers |
|---|---|
| [What is ARDOR](/overview/what-is-ardor.md) | What this is and why it exists |
| [Onboarding](/overview/onboarding.md) | First day here, in order |
| [Monorepo layout](/overview/monorepo-layout.md) | What lives where |
| [Build, run, test](/overview/build-run-test.md) | How to actually run things |
| [Design decisions](/overview/design-decisions.md) | The non-obvious choices, and why |
| [Gotchas](/conventions/gotchas.md) | The traps that cost real time |

## Packages

The framework ships five packages, built in dependency order.

| Package | Role |
|---|---|
| [kernel](/packages/kernel.md) | The isomorphic core: application base, services, the network layer, constants and keys - no React, no react-admin |
| [react](/packages/react.md) | The React bindings: application context, `useInjectable`, the UI hooks, typed Redux factories |
| [admin](/packages/admin.md) | The react-admin adapter: REST data provider, auth and i18n providers, the ra-core hooks, message bundles |
| [ardor](/packages/ardor.md) | The umbrella `@venizia/ardor` - one import over the three above |
| [ui-kit](/packages/ui-kit.md) | The design system: Tailwind + Radix components and Figma-derived tokens |

## Architecture

How the pieces fit.

- [Application lifecycle](/architecture/application-lifecycle.md) - start(), the bindings the framework makes, how React receives the container
- [DI in the browser](/architecture/di-in-the-browser.md) - the IGNIS container as the application, bindings, injection by key and by class
- [Data provider pipeline](/architecture/data-provider-pipeline.md) - react-admin call to HTTP request and back, the IGNIS filter vocabulary
- [Auth recovery](/architecture/auth-recovery.md) - one refresh per 401 burst, one retry, what is never recovered
- [No-auth paths](/architecture/no-auth-paths.md) - `useAuth`, `noAuthPaths`, `noAuthPathRegex`
- [Request header protocol](/architecture/header-protocol.md) - every header the data layer sends and reads
- [Internationalization](/architecture/i18n.md) - the i18n provider, the bundles, typed translate keys
- [Hooks and context](/architecture/hooks-and-context.md) - what each hook needs in the tree
- [Module augmentation](/architecture/module-augmentation.md) - typing injectable and translate keys, and the any-widening trap
- [Error flow](/architecture/error-flow.md) - from `getError` to `useNotifyError`

## Conventions

How the code is written. Read before writing any.

- [Options objects](/conventions/options-objects.md)
- [Coding style](/conventions/coding-style.md)
- [Error handling](/conventions/error-handling.md)
- [Const classes](/conventions/const-classes.md)
- [Narrowing authority](/conventions/narrowing-authority.md)
- [Binding key namespaces](/conventions/binding-key-namespaces.md)
- [React hooks](/conventions/react-hooks.md)
- [Testing conventions](/conventions/testing-conventions.md)
- [Docs writing style](/conventions/docs-writing-style.md)
- [Gotchas](/conventions/gotchas.md)

## Process

How the work gets done.

- [Build system](/process/build-system.md)
- [Testing](/process/testing.md)
- [Debugging](/process/debugging.md)
- [Git workflow](/process/git-workflow.md)
- [Release and publish](/process/release-publish.md)
- [Adding a provider](/process/adding-a-provider.md)
- [Adding a hook](/process/adding-a-hook.md)
- [Splitting a hub file by topic](/process/splitting-a-hub-file.md)
- [Updating the wiki](/process/updating-the-wiki.md)

## Examples

Runnable apps. [5-mins-qs](/examples/5-mins-qs.md) is the smallest thing that runs; [vert-admin](/examples/vert-admin.md) is the family reference over IGNIS's `vert` API; [ipc-data-provider](/examples/ipc-data-provider.md) is the custom-transport tutorial.

## Reference

Curated lookups:

- [Glossary](/reference/glossary.md) - the vocabulary
- [Key source files](/reference/key-source-files.md) - where to look first
- [External links](/reference/external-links.md) - npm, the docs site, upstream docs

Generated from source - never hand-edited, run `make okf-gen`:

- [Source map](/reference/source-map.md) - subsystems and file counts
- [Providers catalog](/reference/providers.md)
- [Hooks and services catalog](/reference/hooks-and-services.md)
- [Binding keys](/reference/binding-keys.md)
- [Makefile targets](/reference/makefile-targets.md)
- [Public surface](/reference/public-surface.md) - every exported symbol, run `make surface-gen`

## Maintaining this bundle

Change a fact in the code, update its concept in the same change, and append to [log](/log.md).
A bundle that drifts is worse than none, because it is believed.

`make okf-check` validates it: frontmatter, links, docs style, one concept per package and example,
and freshness of everything generated. `make okf-coverage` reports the gaps. Neither is a commit
gate - the bundle is re-verified against the code by running knowledge sync periodically.
