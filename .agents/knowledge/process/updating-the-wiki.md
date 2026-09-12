---
type: Playbook
title: Updating the wiki
description: How to change the human-facing ARDOR wiki, which is separate from this agent-facing knowledge bundle.
resource: docs/wiki
tags: [process, docs, wiki]
---

## Steps

1. Know the difference: `docs/wiki/` is the human-facing documentation site, a VitePress site built
   from markdown under `content/`. It lives at top-level `docs/wiki/` (sibling of `packages/`,
   package name `@venizia/ardor-docs`), not inside `packages/`. The MCP server that reads this same
   content is a separate package, `@venizia/ardor-atlas` (`packages/atlas`) - `docs/wiki` no longer
   ships one itself. This `.agents/knowledge/` bundle (what this file is part of) is a separate,
   agent-facing artifact - editing one does not update the other.
2. All prose lives under `docs/wiki/content/`: `guides/` (get started, core concepts, tutorials,
   migrations), `references/` (base API - application, dependency injection, services, providers,
   hooks - plus `utilities/` and `configuration/`), `extensions/` (the per-component,
   per-helper and Atlas references, under `extensions/components/`, `extensions/helpers/` and
   `extensions/atlas/`), `best-practices/` (architecture, testing, deployment), `changelogs/`
   (feature announcements - indexed by `ardor-atlas` as their own `changelog` corpus).
3. To add a new doc page: create the `.md` file under the right `content/` subdirectory, then add
   it to the VitePress sidebar config at `docs/wiki/site/.vitepress/config.mts` - a page that
   exists but isn't in the sidebar config is unreachable from site navigation. This is enforced,
   not merely a convention: `bun run docs:build` (and so `make docs`) runs
   `docs/wiki/scripts/check-sidebar.mts` right before the VitePress build, and it fails the build
   if any `content/**/*.md` page has no menu link, or if a menu link points at a page that no
   longer exists. The only exemptions are the template skeletons under
   `extensions/components/template/` and `extensions/helpers/template/`, and the content root
   `index.md` (the script's `UNLISTED` list). A second gate, `make wiki-links-check`, checks that
   every path the wiki and the knowledge bundle name still exists on disk. It runs in `make
   build-all`, separately from `docs:build`.
4. Preview locally: `cd docs/wiki && bun run docs:dev` (VitePress dev server). Build the static
   site with `bun run docs:build` (`make docs` also builds it, without the dependency chain the
   other Makefile targets carry - `docs` has no prerequisite target). Clean with `bun run
   docs:clean`.
5. There is no compiled output in this package any more: `content/` is plain markdown VitePress
   reads directly, and every script under `scripts/` runs straight with `bun`, no build step. The
   MCP server that answers over this content is `@venizia/ardor-atlas` (`packages/atlas`), built
   and released separately - see its changelog under `docs/wiki/content/changelogs`.
6. Style rules for anything you write in `docs/wiki/content/`: hyphen `-` only, never an em-dash or
   en-dash; the brand is always written **ARDOR**, never mixed case, and **IGNIS** the same way
   when referring to the container. These are content rules, not visual ones - do not introduce
   new UI components or theme CSS for a changelog or any other page; change what the page says,
   not how the site looks.
7. This package has no entry in `package-release.yml`'s `package` input any more - the `docs-mcp`
   choice retired with the MCP server it built, and nothing replaced it (see
   [release and publish](/process/release-publish.md)). It has no compiled `dist/` either:
   `docs/wiki/package.json`'s `files` ships `content/` (minus `changelogs/`) plus `README.md` and
   `LICENSE.md` directly. Confirm the current publish path before assuming this playbook covers
   `docs/wiki`.

## Related

- [Release and publish](/process/release-publish.md)
- [Docs writing style](/conventions/docs-writing-style.md)
- [Build system](/process/build-system.md)
