---
title: 0.4.6
version: 0.4.6
packages:
  - "@venizia/ardor"
released: 2026-10-30
---

This release changes no package code. The only change users see is in the library preset: a new library made with the ARDOR preset now starts with the IGNIS packages it needs.

## Fixed

- **New libraries start with the IGNIS packages** `library-preset-ignis-packages` (`@venizia/ardor`): `vulcan add --preset ardor --lib` now writes `@venizia/ignis-boot`, `@venizia/ignis-connectors`, `@venizia/ignis-filter`, `@venizia/ignis-helpers`, `@venizia/ignis-inversion` and `@venizia/ignis-kernel` as `catalog:` dev dependencies. Before, a new library did not list them, so the install could bring in a second copy of an IGNIS package. A library made with an earlier preset: add the six packages to its dev dependencies.
