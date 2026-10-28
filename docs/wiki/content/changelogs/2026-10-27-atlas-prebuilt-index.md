---
title: ARDOR publishes a signed prebuilt atlas index
description: A new workflow builds the atlas index of each ARDOR commit atlas can be asked for, signs it and attaches it to a release of this repository, and the public key is published in the project manifest, so a project that reads ARDOR as a source downloads the index instead of building it.
packages: []
---

# Changelog - 2026-10-27

## ARDOR publishes a signed prebuilt atlas index

<Badge type="info" text="Tooling" />

**In one line.** A project that reads ARDOR through atlas had to build ARDOR's index itself. ARDOR now publishes a signed one for `main`, `develop` and the release tags. Nothing changes for an app or a package. In ARDOR 0.4.5.

## What changed

- **The key.** `atlas.index.keys` in `.configs/vulcan.config.mts`, and so in `.agents/vulcan.manifest.json`, lists the public key a reader trusts. The private key is an Actions secret.
- **The workflow.** `.github/workflows/atlas-index.yml` runs on a push to `main`, to `develop` or of a tag and attaches the signed pair to the release `atlas-index`. It uses VULCAN's published action, pinned by commit. A reader that finds no pair, or a pair it cannot verify, builds locally as before.
- **A limit.** The release workflow pushes its commits and tags with the Actions token, and GitHub starts no workflow from those pushes, so a release tag gets no pair until ARDOR moves to VULCAN 0.4.7. The next push to `develop` covers the head.

## Who is affected

- **An app or a package.** Nothing.
- **A project that declares ARDOR as an atlas source.** After the first publish it downloads the index.
