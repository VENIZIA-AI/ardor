---
title: The wiki is rebuilt around the core of ARDOR
description: The wiki is rebuilt around the core of ARDOR following the IGNIS structure, with card indexes, the Tide palette, compiled samples, and two moved guide URLs.
packages: []
---

# Changelog - 2026-10-19

## The wiki is rebuilt around the core of ARDOR

<Badge type="tip" text="Enhancement" />

**In one line.** The wiki is rebuilt around the core of ARDOR and follows the IGNIS structure: Guides, References, Extensions, Best Practices, and Changelogs.

## What changed

- **IGNIS structure and guides.** Each section ([Guides](../guides/), [References](../references/), [Extensions](../extensions/), [Best practices](../best-practices/), changelogs) has an index page with cards and a roadmap. Guides: Get started ([Setup](../guides/get-started/setup), [5-minute quickstart](../guides/get-started/5-minute-quickstart), [Philosophy](../guides/get-started/philosophy)), Tutorials ([Build an admin](../guides/tutorials/build-an-admin), [Add sign-in](../guides/tutorials/add-sign-in), [Add a language](../guides/tutorials/add-a-language)), Core concepts ([Application](../guides/core-concepts/application), [Configuration](../guides/core-concepts/configuration), [Providers](../guides/core-concepts/providers), [Resources and pages](../guides/core-concepts/resources-and-pages), [Dependency injection](../guides/core-concepts/dependency-injection)), [Migrations](../guides/migrations/from-ra-core-infra).
- **References.** One page per core piece: [Application](../references/application), [Binding keys](../references/binding-keys), [Types](../references/types), [REST data provider](../references/data-provider), [Auth provider](../references/auth-provider), [Internationalization](../references/i18n), [Network layer](../references/network), [Permission provider](../references/permission) (new page, split from Features), [Features](../references/features), [Repositories](../references/repository), [Hooks](../references/hooks).
- **Moved.** guides/get-started/quickstart -> guides/get-started/5-minute-quickstart; guides/migration/from-ra-core-infra -> guides/migrations/from-ra-core-infra; references/features lost its permission part to references/permission. Extensions and Best practices pages are unchanged in place.
- **New colour palette.** The devglow Tide palette ("still water"), sea-glass and slate over deep water.
- **Code samples.** Every sample compiles in `make docs`.

## Who is affected

- **Readers with bookmarks to the two moved URLs.** Update them; no package change, no action for applications.
