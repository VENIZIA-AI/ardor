---
type: Reference
title: External links
description: Where to find ARDOR's published packages, documentation site, IGNIS docs, react-admin docs, and the source repo.
resource: package.json
tags: [reference, links, npm, docs, ignis, react-admin]
---

ARDOR is published as a set of npm packages under the `@venizia` scope, documented on a dedicated docs site, and built on top of IGNIS. This page collects the external destinations an agent may need to point to; internal concepts should link within this bundle instead.

## npm packages

All packages are scoped `@venizia/*` and installed together:

- `@venizia/ardor` - the umbrella package, see [ardor](/packages/ardor.md)
- `@venizia/ardor-kernel` - isomorphic core, see [kernel](/packages/kernel.md)
- `@venizia/ardor-react` - React bindings, see [react](/packages/react.md)
- `@venizia/ardor-admin` - react-admin adapter, see [admin](/packages/admin.md)
- `@venizia/ardor-ui-kit` - design system, see [ui-kit](/packages/ui-kit.md)

A consuming application also depends directly on two IGNIS packages, since ARDOR is a consumer of IGNIS rather than a reimplementation of it:

- `@venizia/ignis-inversion` - the inversion-of-control primitives ARDOR's applications and DI are built on. See [DI in the browser](/architecture/di-in-the-browser.md).
- `@venizia/ignis-filter` - the query vocabulary spoken by ARDOR's data provider. See [data provider pipeline](/architecture/data-provider-pipeline.md).

`reflect-metadata` is also a required peer dependency, imported once before the application class is defined.

## Docs site

The published documentation for ARDOR lives at:

**https://ardor.venizia.ai**

This is the canonical place to check for user-facing guides, migration notes, and API reference that go beyond what's captured in this agent bundle. When this bundle's material is thin or ambiguous, treat the docs site as the higher-authority source for anything not covered in [What is ARDOR](/overview/what-is-ardor.md) or [Design decisions](/overview/design-decisions.md).

## IGNIS

IGNIS is the backend framework in the VENIZIA family; ARDOR is its frontend sibling. IGNIS's own documentation is at:

**https://ignis.venizia.ai**

Consult IGNIS docs for details on the inversion-of-control container semantics (`@venizia/ignis-inversion`) that ARDOR's binding model builds on, and on the filter/query vocabulary (`@venizia/ignis-filter`) used by ARDOR's REST data provider. ARDOR itself has no controllers, repositories, datasources, or server-side routing layer - those concerns, if relevant at all, belong to IGNIS, not to this frontend framework.

## react-admin docs

ARDOR's `@venizia/ardor-admin` package is an adapter over react-admin: it supplies the REST data provider, auth provider, i18n provider, and the `ArdorApplication` root component that wires these into react-admin's `<Admin>` machinery. For anything about resources, list/edit/show views, or the react-admin component API itself that isn't ARDOR-specific, use the official react-admin documentation:

**https://marmelab.com/react-admin/documentation.html**

See [admin](/packages/admin.md) for what ARDOR adds on top, and [application lifecycle](/architecture/application-lifecycle.md) for how the container is started and handed to `ArdorApplication`.

## GitHub repository

The source of truth for code, issues, and the Makefile-driven build is the ARDOR monorepo on GitHub. Use it to check exact source locations referenced elsewhere in this bundle (see [key source files](/reference/key-source-files.md) and [source map](/reference/source-map.md)), and to see the migration notes for teams moving from the legacy `@minimaltech/ra-core-infra` package, referenced in the repo's `docs/migration/ra-core-infra.md`.

For local setup and everyday commands against a repo checkout, see [onboarding](/overview/onboarding.md), [build, run, test](/overview/build-run-test.md), and [Makefile targets](/reference/makefile-targets.md).
