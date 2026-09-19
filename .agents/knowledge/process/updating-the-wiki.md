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
   package name `@venizia/ardor-docs`), not inside `packages/`. The `ardor-atlas` MCP server reads
   this same content live from the checkout - see [Atlas MCP server](/reference/atlas-mcp.md). This
   `.agents/knowledge/` bundle (what this file is part of) is a separate, agent-facing artifact -
   editing one does not update the other.
2. All prose lives under `docs/wiki/content/`: `guides/` (get started and migration walkthroughs,
   in subfolders), `references/` (one page per API area - application, providers, binding keys,
   hooks, network, types), `extensions/` (one flat page per optional add-on such as the ui-kit or
   socket client), `best-practices/` (architectural conventions), `changelogs/` (feature
   announcements - indexed by `ardor-atlas` as their own `changelog` corpus). A new dated changelog
   page is searchable at once, but the atlas release table behind `changes` only lists it once
   regenerated - `scripts/release.ts` does that after the next release chain.
3. To add a new doc page: create the `.md` file under the right `content/` subdirectory, then add
   it to the VitePress sidebar config at `docs/wiki/site/.vitepress/config.mts` - a page that
   exists but isn't in the sidebar config is unreachable from site navigation. This is enforced,
   not merely a convention: `bun run docs:build` (and so `make docs`) runs
   `docs/wiki/scripts/check-sidebar.mts` first, and it fails the build if any `content/**/*.md`
   page has no menu link, or if a menu link points at a page that no longer exists. The script's
   `UNLISTED` list exempts the content root `index.md` and any `extensions/components/template/` or
   `extensions/helpers/template/` page (no such page exists today). Next it runs
   `check-snippets.mts`: every `ts`/`tsx`/`typescript` fence in `content/` is compiled against the
   BUILT packages' `dist` typings, so build the packages first (`make build-all`) or every snippet
   fails. A fence tagged `no-check` (`ts no-check`, `tsx no-check`) opts out only if it is an
   excerpt - it contains `...`, or holds nothing but declarations with no body or initializer; a
   runnable snippet tagged `no-check` fails the gate on its own. Only then does VitePress build. A
   separate gate, `make wiki-links-check`, checks that every source path the wiki and the knowledge
   bundle name is tracked by git (`git ls-files`) - a path that exists on disk but is gitignored
   still fails. It is a standalone Makefile target run by hand - neither `make build-all`,
   `docs:build` nor CI invokes it.
4. Preview locally: `cd docs/wiki && bun run docs:dev` (VitePress dev server). Build the static
   site with `bun run docs:build` (`make docs` also builds it, without the dependency chain the
   other Makefile targets carry - `docs` has no prerequisite target). Clean with `bun run
   docs:clean`.
5. There is no compiled output in this package any more: `content/` is plain markdown VitePress
   reads directly, and every script under `scripts/` runs straight with `bun`, no build step.
6. Style rules for anything you write in `docs/wiki/content/`: hyphen `-` only, never an em-dash or
   en-dash; the brand is always written **ARDOR**, never mixed case, and **IGNIS** the same way
   when referring to the container. These are content rules, not visual ones - do not introduce
   new UI components or theme CSS for a changelog or any other page; change what the page says,
   not how the site looks.
7. This package has no entry in `package-release.yml`'s `package` input any more - the `docs-mcp`
   choice retired with the MCP server it built. No ARDOR release replaced it: the wiki reaches agents
   through IGNIS's atlas reading `content/` from the checkout (see
   [release and publish](/process/release-publish.md) and [Atlas MCP
   server](/reference/atlas-mcp.md)). It has no compiled `dist/` either:
   `docs/wiki/package.json`'s `files` ships `content/` (minus `changelogs/`) plus `README.md` and
   `LICENSE.md` directly. Confirm the current publish path before assuming this playbook covers
   `docs/wiki`.

## Related

- [Release and publish](/process/release-publish.md)
- [Docs writing style](/conventions/docs-writing-style.md)
- [Build system](/process/build-system.md)
- [Atlas MCP server](/reference/atlas-mcp.md)
