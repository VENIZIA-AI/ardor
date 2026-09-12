---
title: API References
---

# ARDOR API References

Welcome to the ARDOR API reference documentation. ARDOR is the frontend framework of the VENIZIA ecosystem, providing a structured architecture for admin-driven web applications. It implements a react-admin interface layered on top of an IGNIS inversion-of-control container.

Through its core packages - `@venizia/ardor`, `ardor-kernel`, `ardor-react`, `ardor-admin`, and `ardor-ui-kit` - the framework separates enterprise lifecycle management, dependency resolution, UI composition, and data transport into maintainable components. The reference sections catalog every class, interface, binding key, and hook available across these layers.

<div class="guide-cards">

<div class="guide-card">
<h3>Application & Container</h3>
<p>Application bootstrapper, container lifecycles, and kernel configuration</p>
</div>

<div class="guide-card highlight">
<h3>Binding Keys</h3>
<p>Core injection tokens and symbol definitions for dependency wiring</p>
</div>

<div class="guide-card">
<h3>Data Providers</h3>
<p>Adapters, request pipelines, and CRUD method contracts</p>
</div>

<div class="guide-card">
<h3>Auth Providers</h3>
<p>Credential handlers, session storage, and route authorization checks</p>
</div>

<div class="guide-card">
<h3>Internationalization</h3>
<p>Translation loaders, locale state, and message formatting</p>
</div>

<div class="guide-card">
<h3>Hooks & React Bindings</h3>
<p>React context bindings, container resolution hooks, and UI primitives</p>
</div>

</div>

## Architecture Overview

| Area | Package | Responsibility |
| --- | --- | --- |
| Application | ardor-kernel | Container setup, component lifecycle, and base application setup |
| Binding Keys | ardor-kernel | Injection keys for registering and resolving container services |
| Data Providers | ardor-admin | Data layer abstraction connecting react-admin to backend APIs |
| Auth Providers | ardor-admin | Authentication handlers for identity, permissions, and session state |
| Internationalization | ardor-react | Translation providers, dictionary bindings, and locale switching |
| Hooks | ardor-react | Hooks to resolve dependencies and consume container state |
| Network Layer | @venizia/ardor | Transport layer, HTTP interceptors, and error mapping utilities |
| Utilities & Types | ardor-ui-kit | Shared interfaces, design tokens, and helper functions |
