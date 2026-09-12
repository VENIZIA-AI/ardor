---
title: Extensions Overview
---

# ARDOR Extensions

Welcome to the extensions overview for ARDOR - the frontend framework of the VENIZIA ecosystem that structures react-admin inside an IGNIS inversion-of-control container. The framework is divided across core modules including `@venizia/ardor`, `ardor-kernel`, `ardor-react`, and `ardor-admin`, with several optional packages and implementation patterns available to extend standard functionality.

The extensions layer provides pre-built design systems, real-time networking utilities, and specialized data providers. Because ARDOR relies on the IGNIS dependency injection container, you can register these add-ons as services or replace default implementations without altering application boot logic. Whether you need design tokens extracted from Figma or custom data transport protocols, these modules adapt ARDOR to your infrastructure.

<div class="guide-cards">

<div class="guide-card">
<h3>UI Kit</h3>
<p>Tailwind CSS and Radix UI components using tokens derived from Figma</p>
</div>

<div class="guide-card">
<h3>Socket Client Helper</h3>
<p>Real-time communication utilities integrated with the DI container</p>
</div>

<div class="guide-card">
<h3>CountRestDataProvider</h3>
<p>REST data provider optimized for precise record-count queries</p>
</div>

<div class="guide-card">
<h3>Custom Transports</h3>
<p>Override DefaultRestDataProvider.send for non-HTTP protocols</p>
</div>

</div>

## Extension Registry

| Extension | Layer | Purpose |
| --- | --- | --- |
| `@venizia/ardor-ui-kit` | Visual components | Tailwind and Radix UI components aligned with Figma design tokens |
| Socket Client Helper | Real-time networking | Client wrapper for managing persistent socket connections in services |
| `CountRestDataProvider` | Data retrieval | Data provider implementation specialized in handling explicit record counting |
| `DefaultRestDataProvider.send` Override | Transport layer | Transport abstraction pattern to route requests through non-HTTP channels |
