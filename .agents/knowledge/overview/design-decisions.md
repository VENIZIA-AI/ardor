---
type: Concept
title: Design decisions
description: The reasoning behind ARDOR's package split, ESM-only build, DI defaults, and doc-quality gates.
resource: docs/migration/ra-core-infra.md
tags: [overview, design-decisions, architecture, rationale]
---

ARDOR's shape is not arbitrary. Each structural choice traces back to a specific problem the team hit while porting the legacy `ra-core-infra` package into an IGNIS-standard framework. This concept collects the decisions an agent should treat as settled, not open questions.

## The four-package split

ARDOR is [kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md), and the umbrella [ardor](/packages/ardor.md) package, plus the separate [ui-kit](/packages/ui-kit.md). The split exists so that browser purity and framework-neutrality can be checked mechanically instead of by convention. Kernel is IGNIS's own dependency-injection and service layer, ported with no admin-specific code. React adds hooks and context on top of kernel but still has no react-admin dependency. Admin is the only package allowed to depend on `ra-core`. If everything lived in one package, "does this leak react-admin into the container layer" would be a code-review question forever; split into packages, it becomes a purity probe that either passes or fails.

## ra-core confined to admin

react-admin's core (`ra-core`) is the admin data contract - resources, data provider, auth provider, i18n. ARDOR treats it strictly as an adapter, not as the foundation. Only [admin](/packages/admin.md) imports it. Kernel and react must stay importable in any React app that has no notion of resources or an admin data provider. This is why the [Application lifecycle](/architecture/application-lifecycle.md) and [DI in the browser](/architecture/di-in-the-browser.md) mechanisms live in kernel: they are useful with or without react-admin sitting on top.

## ESM only

ARDOR ships ESM only, no CommonJS interop layer. This matches the browser-only target - there is no server runtime to support - and keeps the build and the purity probe simple: one output shape to check, not two.

## Highest IGNIS line

ARDOR tracks the IGNIS packages it depends on (the DI container, filtering vocabulary) at their highest published line, not pinned to whatever version happened to be current when a package was first vendored. This keeps ARDOR's container semantics and query vocabulary from drifting silently out of sync with IGNIS as both evolve.

## Singleton by default

Services and injectables registered through the container default to singleton scope unless declared otherwise. This mirrors how most application-level services actually behave - one instance per running app - and means the common case needs no annotation. See [DI in the browser](/architecture/di-in-the-browser.md) for how binding and resolution work in practice.

## Logger per scope

Logging is obtained per scope rather than through one global logger instance. Each service or module gets a logger tied to its own name, so log output is traceable to its source without manual prefixing, and scopes can be filtered or silenced independently in tests.

## The augmentation seam

Module augmentation is the one supported way to extend ARDOR's types without forking them - for example, widening what a resource's data shape or a context value can hold. It is documented as [Module augmentation](/architecture/module-augmentation.md) precisely because it is a seam: used correctly it lets consumers extend safely, used incorrectly it silently breaks type inference elsewhere. Anything that isn't going through this seam is not a supported extension point.

## Snippet gate for docs

Wiki pages that contain fenced TypeScript or TSX code are only considered done once those snippets actually compile against the real packages. A doc page is not "finished prose" - it is a claim about the API, and the claim is checked the same way test assertions are checked. This is why documentation work in ARDOR is described as auditing pages against the code, not just writing them from memory of the legacy site.

## Purity and layer gates

Kernel and react must never import a Node builtin or `ra-core`; admin must never import a Node builtin. These are enforced by a purity probe, not by review discipline, because the legacy package's line between "this belongs in the container" and "this belongs in the admin adapter" blurred over ten months without anyone noticing until the port forced the question. The same instinct drives the public-surface snapshot and catalog checks: structural properties of the codebase should be machine-checked, not remembered.

## Water palette, same design system

ARDOR's visual identity uses a water-themed palette rather than IGNIS's fire theme, but it is built on the same design system and design tokens as IGNIS - same structure, different color story. This keeps ARDOR visually distinct as a frontend framework while staying a sibling of IGNIS rather than an unrelated project.

## Where to go next

For the practical layout these decisions produced, see [Monorepo layout](/overview/monorepo-layout.md). For how the pieces are exercised day to day, see [Build, run, test](/overview/build-run-test.md). For the conventions that enforce some of these decisions in code review, see [Coding style](/conventions/coding-style.md) and [Narrowing authority](/conventions/narrowing-authority.md).
