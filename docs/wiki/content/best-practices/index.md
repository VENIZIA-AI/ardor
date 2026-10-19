---
title: Best Practices
description: Architecture patterns, key naming conventions, type augmentation, and service design in ARDOR.
---

# Best Practices in ARDOR

Writing maintainable frontend applications requires clear structural boundaries between state, transport, and dependency resolution. These best practices describe established patterns for registering container services, typing keys with module augmentation, authoring repositories, and handling token recovery.

<div class="guide-cards">
<a href="./binding-keys" class="guide-card">
  <h3>Binding Keys and Registration</h3>
  <p>Register classes via stereotype discovery or by hand, manage singleton scopes, and wire provider slots</p>
</a>
<a href="./module-augmentation" class="guide-card highlight">
  <h3>Module Augmentation</h3>
  <p>Extend key unions for useInjectable and useTranslate through TypeScript module augmentation on @venizia/ardor</p>
</a>
<a href="./services" class="guide-card">
  <h3>Services and Repositories</h3>
  <p>Author domain services on BaseService and resource repositories on HttpRepository with options objects and @api()</p>
</a>
<a href="./auth-recovery" class="guide-card">
  <h3>No-Auth Paths and Token Recovery</h3>
  <p>Configure unauthenticated endpoints and implement one-refresh-one-retry recovery workflows for HTTP 401 statuses</p>
</a>
</div>

## Architecture Roadmap

<div class="roadmap">
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">1</span><h4>Container Registration</h4></div>
  <p><a href="./binding-keys">Binding Keys and Registration</a></p>
  <span class="stage-desc">Choose between stereotype discovery and manual registration with singleton defaults</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">2</span><h4>Type Safety</h4></div>
  <p><a href="./module-augmentation">Module Augmentation</a></p>
  <span class="stage-desc">Augment the umbrella package to enforce strict type checking on injectable and translation keys</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">3</span><h4>Domain Architecture</h4></div>
  <p><a href="./services">Services and Repositories</a></p>
  <span class="stage-desc">Build testable classes on BaseService and HttpRepository using options objects and error decorators</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">4</span><h4>Authentication Security</h4></div>
  <p><a href="./auth-recovery">No-Auth Paths and Token Recovery</a></p>
  <span class="stage-desc">Define unauthenticated paths and coordinate automatic token refresh across data providers and repositories</span>
</div>
</div>
