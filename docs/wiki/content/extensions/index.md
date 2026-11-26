---
title: Extensions
description: Optional extensions and transport adapters for real-time sockets, count queries, and custom transports.
---

# ARDOR Extensions

ARDOR provides extension packages and integration patterns to adapt applications to specialized protocols. Use these add-ons to connect persistent real-time sockets, query dedicated count endpoints, or swap the network transport for IPC and in-memory stores.

<div class="guide-cards">
<a href="./socket-client" class="guide-card">
  <h3>Socket.IO client</h3>
  <p>The IGNIS browser-pure socket client, handed socket.io-client by your application</p>
</a>
<a href="./count-provider" class="guide-card">
  <h3>CountRestDataProvider</h3>
  <p>For a backend that sends no Content-Range: reads list totals from a separate count endpoint</p>
</a>
<a href="./custom-transport" class="guide-card">
  <h3>Custom Transport</h3>
  <p>Route react-admin queries through non-HTTP transports like Web Workers, IPC, or in-memory stores</p>
</a>
</div>

## Extension Roadmap

<div class="roadmap">
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">1</span><h4>Real-Time Networking</h4></div>
  <p><a href="./socket-client">Socket.IO client</a></p>
  <span class="stage-desc">Connect real-time socket events with the dependency injection container</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">2</span><h4>Alternative Pagination</h4></div>
  <p><a href="./count-provider">CountRestDataProvider</a></p>
  <span class="stage-desc">Only for APIs with a count endpoint and no Content-Range header; the default provider reads the header</span>
</div>
<div class="roadmap-stage">
  <div class="stage-header"><span class="stage-num">3</span><h4>Non-HTTP Transports</h4></div>
  <p><a href="./custom-transport">Custom Transport</a></p>
  <span class="stage-desc">Route data provider requests through in-memory APIs, Web Workers, or desktop IPC</span>
</div>
</div>
