---
title: Best Practices
---

# Best Practices in ARDOR

Welcome to the ARDOR best practices guide. ARDOR brings the VENIZIA inversion-of-control container from IGNIS into the React ecosystem, structuring complex admin applications around `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor-admin`, and `@venizia/ardor-ui-kit`. 

Writing maintainable frontends requires clear structural boundaries. When building admin dashboards, frontend state management often degrades into tangled hooks and scattered context providers. ARDOR resolves this by enforcing container-level dependency injection, standardized configuration objects, and explicit typing boundaries. 

The guides outlined below detail the core architectural conventions you should follow across your application:

<div class="guide-cards">

<div class="guide-card">
<h3>Binding Key Namespaces</h3>
<p>Structure injectable dependencies systematically under standard namespaces such as services.* to avoid collision across container modules.</p>
</div>

<div class="guide-card highlight">
<h3>Module Augmentation Targets</h3>
<p>Extend @venizia/ardor-react for type-safe injectable keys and @venizia/ardor-admin for localization translation dictionaries.</p>
</div>

<div class="guide-card">
<h3>Options Objects Convention</h3>
<p>Pass configuration through dedicated options objects across services, providers, and component constructors rather than long positional parameter lists.</p>
</div>

<div class="guide-card">
<h3>One-Shot Auth Recovery</h3>
<p>Implement single-attempt token refresh workflows to prevent circular retry loops during session expiration.</p>
</div>

<div class="guide-card">
<h3>Explicit No-Auth Paths</h3>
<p>Treat unauthenticated routes as deliberate architectural decisions rather than default fallbacks in access control definitions.</p>
</div>

</div>

## Architectural Overview

| Topic | Focus Area | Description |
| --- | --- | --- |
| Binding Key Namespaces | Dependency Injection | Keep services registered under strict namespaced identifiers like `services.*` in the IoC container. |
| Module Augmentation Targets | TypeScript Safety | Augment `@venizia/ardor-react` for typed injections and `@venizia/ardor-admin` for app translate keys. |
| Options Objects Convention | API Design | Maintain backward compatibility and call-site readability by wrapping arguments in options interfaces. |
| One-Shot Auth Recovery | Authentication | Handle session restoration in a single isolated step to prevent cascading network failures on 401s. |
| Explicit No-Auth Paths | Route Security | Mark public routes deliberately in route configs to avoid unintended authorization bypasses. |
