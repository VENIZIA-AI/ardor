---
type: Playbook
title: Onboarding
description: The first-day path through the ARDOR repository - rules, setup, build order, tests, and the reading order for the knowledge bundle.
resource: AGENTS.md
tags: [onboarding, playbook, getting-started]
---

Start with `AGENTS.md`. It is routing only, holds no rules and no facts, and points to the two
places that do: `.agents/rules.md` (the rules, cited by ID: W write boundaries, S security, P
process, B build, C code and writing) and `.agents/knowledge/index.md` (the facts - what ARDOR is,
the monorepo layout, design decisions, conventions, per-package concepts, playbooks). Both are
mandatory for every task, not optional background reading.

## Step 1: read the rules

Open `.agents/rules.md` before touching anything. Two rules cost the most when skipped: every
status message must open with the minimap (P-09), and a downstream test suite runs `dist`, not
`src` (B-05). Keep the second one in your head for the build step below.

## Step 2: run `make agent-setup`

This runs `bun .agents/plugin/setup.ts`, which creates the gitignored per-tool symlinks
(`CLAUDE.md`, `GEMINI.md`, ...) pointing at `AGENTS.md`, and merges the shared Claude settings and
session hook from `.agents/plugin/claude/` into your local `.claude/`. There are no per-package
agent files - a package carries no local `CLAUDE.md`; its facts live in the knowledge bundle
instead. Re-run this target after any pull that touched `.agents/plugin/`.

## Step 3: build, in dependency order

`make build` rebuilds every package in dependency order: kernel, then react and admin, then the
ardor umbrella, then ui-kit as needed. This order is not cosmetic - a package type-checks against
the `dist` of its dependency, never its `src`. A change to the kernel is invisible to `admin` until
the kernel is rebuilt. You can rebuild one package at a time with `make kernel`, `make react`, `make
admin`, `make ardor`, `make ui-kit`. See [Build order and package
targets](/process/build-system.md) and the full command list in [Makefile
targets](/reference/makefile-targets.md).

## Step 4: run the tests

Tests run after a build, against `dist`, per B-05 above. See [Running the test
suites](/process/testing.md) for the per-package targets and what each one checks.

## Step 5: read the knowledge bundle, in this order

The bundle is Open Knowledge Format - one concept per markdown file, YAML frontmatter, links as the
graph edges - served both as files under `.agents/knowledge/` and over MCP by `ardor-atlas`. Read
in this order:

1. [What is ARDOR](/overview/what-is-ardor.md) - the frontend framework, its role next to IGNIS,
   and the IoC-container mental model.
2. [Monorepo layout](/overview/monorepo-layout.md) - where the five packages live and how they
   relate.
3. [Build, run, test](/overview/build-run-test.md) - the day-to-day commands, expanded from step 3
   and 4 above.
4. [Design decisions](/overview/design-decisions.md) - why the framework is shaped the way it is.
5. The package concepts, in dependency order: [`ardor-kernel`](/packages/kernel.md),
   [`ardor-react`](/packages/react.md), [`ardor-admin`](/packages/admin.md),
   [`ardor`](/packages/ardor.md) (the umbrella), [`ardor-ui-kit`](/packages/ui-kit.md).
6. Architecture: [application lifecycle](/architecture/application-lifecycle.md), [DI in the
   browser](/architecture/di-in-the-browser.md), [data provider
   pipeline](/architecture/data-provider-pipeline.md), [auth recovery](/architecture/auth-recovery.md),
   [no-auth paths](/architecture/no-auth-paths.md), [header protocol](/architecture/header-protocol.md),
   [i18n](/architecture/i18n.md), [hooks and context](/architecture/hooks-and-context.md), [module
   augmentation](/architecture/module-augmentation.md), [error flow](/architecture/error-flow.md).
7. Conventions - skim all of them, but at minimum [options
   objects](/conventions/options-objects.md), [const classes](/conventions/const-classes.md),
   [narrowing authority](/conventions/narrowing-authority.md), and the [gotchas
   list](/conventions/gotchas.md).

## How the docs and the bundle relate

Nothing lives in two places. `.agents/` is what agents read; `docs/wiki/` is the human-facing
VitePress site. Source code is the ground truth for both - when prose and code disagree, the code
wins and the prose is a bug. The wiki and the bundle serve different audiences and are never
conflated. When you change a fact in the code, update the matching concept (and `log.md`) in the
same change - that is what keeps this playbook, and everything it points to, trustworthy for the
next agent who reads it first.
