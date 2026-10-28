---
title: Releases publish with npm trusted publishing, with no stored token
description: The release workflow no longer reads an npm token. It publishes a tarball bun packed with npm trusted publishing, so every release carries a provenance, and the owner approves each run.
packages: []
---

# Changelog - 2026-10-28

## Releases publish with npm trusted publishing, with no stored token

<Badge type="info" text="Tooling" /> <Badge type="danger" text="Security" />

**In one line.** The workflow that publishes ARDOR holds no npm token. npm trusts the workflow's own identity, and each package on npmjs.com shows where it was built. How a release is started does not change. In ARDOR 0.4.5.

## What changed

- **No token.** `NPM_ACCESS_TOKEN` is read nowhere, not by the publish, the dist-tag steps or the heal job.
- **Trusted publishing.** The release job and the heal job hold `id-token: write`; the test job holds nothing. npm exchanges that identity for a short-lived credential.
- **The owner approves.** Both jobs name the environment `npm-release`, so every run waits for a reviewer before its first step. `make release` keeps waiting while it does.
- **Packed by bun, published by npm.** `bun pm pack` resolves `catalog:` and `workspace:`, which npm does not. The workflow packs once, after the version bump and the preset write, records the sha256, and publishes that very file with `npm publish --provenance`. `bun publish` is gone.
- **Exact tools.** Node 24.22.1 and npm 11.21.1, asserted. npm 11.21.0 is the first version that can move a dist-tag over OIDC.
- **The guards.** `scripts/release/__tests__/release-gates.test.ts` fails when a token, the environment, `id-token`, the provenance, the checksum or an exact version is removed from a copy of the workflow.

## Who is affected

- **An app or a package.** Nothing. The packed files are the same as before; the packages gain a provenance statement on npmjs.com.
- **The owner of the npm packages.** Before the first release, register a trusted publisher on npmjs.com for each of `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor-admin` and `@venizia/ardor`: organisation `VENIZIA-AI`, repository `ardor`, workflow `package-release.yml`, environment `npm-release`, and the actions `npm publish` and `npm dist-tag`. After a release has passed, delete the `NPM_ACCESS_TOKEN` secret.
- **A contributor.** A release is still started with `make release`, and still needs the owner's word.
