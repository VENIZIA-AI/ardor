---
title: ARDOR Guides
description: Getting started tutorials, core architecture concepts, and migration guides for ARDOR applications.
---

# ARDOR Guides

ARDOR is the browser framework of [VENIZIA](https://venizia.ai). It structures ra-core applications inside an IGNIS inversion-of-control container. These guides take you from a first project to the core concepts and a migration path.

ARDOR 0.4.3 gives you:

- **A container and decorators in the browser** (`@venizia/ardor-kernel`), with React hooks to resolve what you bind (`@venizia/ardor-react`). `@venizia/ardor` re-exports the kernel, react and admin packages.
- **A REST data provider, token refresh on a 401 and i18n for ra-core** (`@venizia/ardor-admin`).
- **An HTTP repository** from IGNIS on `@venizia/ardor/repository`, which can share the data provider's token and 401 refresh through `getDataSourceAuth()`.
- **Runtime configuration.** `getRuntimeConfig` reads `window.__APP_CONFIG__`, so one built image serves every environment; with `required: true` it throws an error that carries a code. See [One image for every environment](./get-started/create-a-project#one-image-for-every-environment).
- **A VULCAN preset** that generates an admin with Tailwind, an nginx image (gzip, `/health`, security headers) and that runtime configuration.

ARDOR is before 1.0, and a minor release can break: read [where ARDOR is today](./get-started/philosophy#where-ardor-is-today).

<div class="guide-cards">
<a href="./get-started/create-a-project" class="guide-card">
  <h3>Create a Project</h3>
  <p>Start a monorepo with an admin, or add one to a monorepo you have, with one VULCAN command</p>
</a>
<a href="./get-started/setup" class="guide-card">
  <h3>Setup</h3>
  <p>Install Bun, configure dependencies, and prepare your development environment</p>
</a>
<a href="./get-started/5-minute-quickstart" class="guide-card highlight">
  <h3>Quickstart</h3>
  <p>Write a small admin by hand against a stub API: a datasource, a repository, a list page and a login</p>
</a>
<a href="./tutorials/build-an-admin" class="guide-card">
  <h3>Build an Admin</h3>
  <p>Create a complete administration console with list, create, edit and delete pages for one resource</p>
</a>
<a href="./tutorials/add-sign-in" class="guide-card">
  <h3>Add Sign-In</h3>
  <p>Configure sign-in, roles, token refresh and sign-out</p>
</a>
<a href="./tutorials/add-a-language" class="guide-card">
  <h3>Add a Language</h3>
  <p>Set up polyglot dictionaries, locale switching, and translated message bundles</p>
</a>
<a href="./core-concepts/application" class="guide-card">
  <h3>Application</h3>
  <p>Understand BaseArdorApplication container lifecycles and the root component</p>
</a>
<a href="./core-concepts/configuration" class="guide-card">
  <h3>Configuration</h3>
  <p>Declare provider options and container singletons with configuration classes</p>
</a>
<a href="./core-concepts/providers" class="guide-card">
  <h3>Providers</h3>
  <p>Wire data, auth, i18n, network, permission, and features</p>
</a>
<a href="./core-concepts/resources-and-pages" class="guide-card">
  <h3>Resources and Pages</h3>
  <p>Define list, create and edit pages, custom routes and the CoreAdmin props</p>
</a>
<a href="./core-concepts/dependency-injection" class="guide-card">
  <h3>Dependency Injection</h3>
  <p>Resolve services and repositories across React components and container scopes</p>
</a>
<a href="./get-started/philosophy" class="guide-card">
  <h3>Philosophy</h3>
  <p>Architectural principles and design decisions behind ARDOR and IGNIS</p>
</a>
<a href="./migrations/from-ra-core-infra" class="guide-card">
  <h3>Migration</h3>
  <p>Migrate legacy administration interfaces from @minimaltech/ra-core-infra</p>
</a>
</div>

## Learning Roadmap

<div class="roadmap">
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">1</span><h4>First Steps</h4></div>
  <p><a href="./get-started/create-a-project">Create a Project</a> or <a href="./get-started/setup">Setup</a> → <a href="./get-started/5-minute-quickstart">Quickstart</a></p>
  <span class="stage-desc">Generate an admin with one command, or set up a Vite project and write a small one by hand</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">2</span><h4>Build Something Real</h4></div>
  <p><a href="./tutorials/build-an-admin">Build an Admin</a> → <a href="./tutorials/add-sign-in">Add Sign-In</a> → <a href="./tutorials/add-a-language">Add a Language</a></p>
  <span class="stage-desc">Construct complete administrative interfaces with authentication and translations</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">3</span><h4>Understand the Framework</h4></div>
  <p><a href="./core-concepts/application">Application</a> → <a href="./core-concepts/configuration">Configuration</a> → <a href="./core-concepts/providers">Providers</a> → <a href="./core-concepts/resources-and-pages">Resources and Pages</a> → <a href="./core-concepts/dependency-injection">Dependency Injection</a></p>
  <span class="stage-desc">Deep dive into container lifecycles, configuration classes, and dependency resolution</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">4</span><h4>Go Further</h4></div>
  <p><a href="../references/">API References</a> → <a href="../best-practices/">Best Practices</a> → <a href="./migrations/from-ra-core-infra">Migration</a></p>
  <span class="stage-desc">Consult technical references, apply production patterns, and migrate legacy codebases</span>
</div>
</div>
