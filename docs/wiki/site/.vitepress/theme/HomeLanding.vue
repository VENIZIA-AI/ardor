<template>
  <div class="ar-landing">
    <div class="ar-glow" aria-hidden="true" />

    <!-- ── Hero (split: copy left, code window right) ──────────────────── -->
    <div class="ar-wrap">
      <section class="ar-hero">
        <div class="ar-hero__copy">
          <div class="ar-eyebrow">
            <span class="ar-eyebrow__dot" />TypeScript · React · react-admin · IGNIS
          </div>
          <h1>Admin apps with a<br />real <span class="ar-gtext">architecture</span></h1>
          <p class="ar-lede">
            react-admin's data contract on IGNIS's container.
            <b>Dependency injection, a typed REST data layer, auth recovery and i18n</b>
            - one import, browser-pure core.
          </p>
          <div class="ar-cta">
            <a href="/guides/" class="ar-btn ar-btn--primary">Get Started &#x2192;</a>
            <a href="https://github.com/VENIZIA-AI/ardor" class="ar-btn ar-btn--secondary">&#x2605; Star on GitHub</a>
          </div>
          <div class="ar-stats">
            <div class="ar-stat">
              <div class="ar-stat__n ar-gtext">1</div>
              <div class="ar-stat__l">import to install</div>
            </div>
            <div class="ar-stat">
              <div class="ar-stat__n ar-gtext">0</div>
              <div class="ar-stat__l">Node builtins in the core</div>
            </div>
            <div class="ar-stat">
              <div class="ar-stat__n ar-gtext">100%</div>
              <div class="ar-stat__l">type-safe hooks</div>
            </div>
          </div>
        </div>

        <div class="ar-code-win">
          <div class="ar-code-win__bar">
            <span class="ar-code-win__dot" style="background:var(--ar-brand)" />
            <span class="ar-code-win__dot" style="background:var(--ar-aqua)" />
            <span class="ar-code-win__dot" style="background:var(--ar-teal)" />
            <span class="ar-code-win__filename">application.tsx</span>
            <span class="ar-code-win__tag">live</span>
          </div>
          <!-- v-pre: skip Vue template compilation inside the code sample -->
          <pre v-pre><span class="ar-k">import</span> <span class="ar-s">'reflect-metadata'</span>
<span class="ar-k">import</span> { <span class="ar-c">BaseArdorApplication</span>, <span class="ar-c">CoreBindings</span>, <span class="ar-c">DefaultRestDataProvider</span> } <span class="ar-k">from</span> <span class="ar-s">'@venizia/ardor'</span>
<span class="ar-k">import</span> { <span class="ar-d">useInjectable</span>, <span class="ar-d">useTranslate</span> } <span class="ar-k">from</span> <span class="ar-s">'@venizia/ardor'</span>

<span class="ar-k">class</span> <span class="ar-c">Application</span> <span class="ar-k">extends</span> <span class="ar-c">BaseArdorApplication</span> {
  <span class="ar-d">bindContext</span>() {
    <span class="ar-k">this</span>.<span class="ar-d">bind</span>({ key: <span class="ar-c">CoreBindings</span>.REST_DATA_PROVIDER_OPTIONS })
      .<span class="ar-d">toValue</span>({ url: <span class="ar-s">'/api'</span>, noAuthPaths: [<span class="ar-s">'/auth/login'</span>] })
    <span class="ar-k">this</span>.<span class="ar-d">bind</span>({ key: <span class="ar-c">CoreBindings</span>.DEFAULT_REST_DATA_PROVIDER })
      .<span class="ar-d">toProvider</span>(<span class="ar-c">DefaultRestDataProvider</span>)
    <span class="ar-k">this</span>.<span class="ar-d">service</span>(<span class="ar-c">ProductApi</span>)   <span class="ar-k">//</span> <span class="ar-k">-> services.ProductApi</span>
  }
}

<span class="ar-k">const</span> <span class="ar-c">ProductList</span> = () => {
  <span class="ar-k">const</span> productApi = <span class="ar-d">useInjectable</span>&lt;<span class="ar-c">ProductApi</span>&gt;({ key: <span class="ar-s">'services.ProductApi'</span> })
  <span class="ar-k">const</span> translate = <span class="ar-d">useTranslate</span>()
  <span class="ar-k">return</span> &lt;<span class="ar-c">h1</span>&gt;{translate(<span class="ar-s">'resources.product.name'</span>)}&lt;/<span class="ar-c">h1</span>&gt;
}</pre>
        </div>
      </section>
    </div>

    <!-- ── 6 feature cards ──────────────────────────────────────────────── -->
    <div class="ar-divider" />
    <div class="ar-wrap">
      <section class="ar-section">
        <div class="ar-section-head">
          <div class="ar-label">Everything you need</div>
          <h2>Enterprise structure,<br />without the ceremony</h2>
          <p>The patterns that scale teams - wired into a framework that doesn't slow down.</p>
        </div>
        <div class="ar-features">
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- bolt / performance -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <h3>Browser IoC Container</h3>
            <p>Full dependency injection in the browser. Resolve bound singletons cleanly with <code>useInjectable</code> and <code>services.*</code> keys.</p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- hexagon / DI container -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <h3>REST Data Provider</h3>
            <p>Maps react-admin pagination, sorting, and filters to IGNIS <code>{ where, order, limit, skip }</code>, parsing totals from Content-Range.</p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- database / type-safe data -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            <h3>Self-Healing Auth</h3>
            <p>Handles login, logout, checkAuth, and checkError with one-shot token refresh recovery on 401s and configurable no-auth paths.</p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- shield / auth -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3>Type-Safe i18n</h3>
            <p>Contextual <code>useTranslate</code> hook with keys checked via module augmentation, shipping with built-in en and vi bundles.</p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- arrows / real-time -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </div>
            <h3>Typed Redux Hooks</h3>
            <p>Factory-generated typed selectors and dispatch hooks connected seamlessly into your IGNIS application container state.</p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- book-open / OpenAPI -->
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <h3>Tailwind + Radix UI</h3>
            <p>Accessible, production-ready admin layouts and primitives via ardor-ui-kit, styled with Tailwind CSS and Radix UI.</p>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Performance band (horizontal bar chart) ──────────────────────── -->
    <div class="ar-divider" />
    <div class="ar-wrap">
      <div class="ar-perf">
        <div class="ar-perf__copy">
          <div class="ar-label">Isomorphic Core</div>
          <h2>Frontend state has a<br />structure limit. ARDOR<br />solves it cleanly.</h2>
          <p>Built as an IGNIS inversion-of-control container, ARDOR eliminates spaghetti providers and ad-hoc wiring while preserving react-admin data conventions.</p>
          <p class="ar-fine">Zero Node builtins in ardor-kernel. Isomorphic and lightweight.</p>
        </div>
        <div class="ar-bars">
          <div class="ar-bar-row">
            <div class="ar-bar-row__name">ardor-kernel</div>
            <div class="ar-track"><div class="ar-fill ar-fill--muted" style="width:100%">0 Node builtins</div></div>
          </div>
          <div class="ar-bar-row ar-bar-row--hl">
            <div class="ar-bar-row__name">ARDOR</div>
            <div class="ar-track"><div class="ar-fill ar-fill--ig" style="width:100%">1 meta-package</div></div>
          </div>
          <div class="ar-bar-row">
            <div class="ar-bar-row__name">ardor-react</div>
            <div class="ar-track"><div class="ar-fill ar-fill--muted" style="width:75%">Context + Hooks</div></div>
          </div>
          <div class="ar-bar-row">
            <div class="ar-bar-row__name">ardor-admin</div>
            <div class="ar-track"><div class="ar-fill ar-fill--muted" style="width:50%">ra-core Adapters</div></div>
          </div>
          <div class="ar-bar-row">
            <div class="ar-bar-row__name">ardor-ui-kit</div>
            <div class="ar-track"><div class="ar-fill ar-fill--muted" style="width:35%">Tailwind + Radix</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Honest-fit positioning ────────────────────────────────────────── -->
    <div class="ar-divider" />
    <div class="ar-wrap">
      <section class="ar-section">
        <div class="ar-section-head">
          <div class="ar-label">Is it for you?</div>
          <h2>Honest about the fit</h2>
        </div>
        <div class="ar-pos-grid">
          <div class="ar-pcard ar-pcard--good">
            <h3>&#x2736; Perfect for</h3>
            <ul>
              <li><span class="ar-ic" style="color:var(--ar-aqua)">&#x2713;</span> Enterprise admin panels needing clean IoC architecture</li>
              <li><span class="ar-ic" style="color:var(--ar-aqua)">&#x2713;</span> Applications pairing react-admin with IGNIS backends</li>
              <li><span class="ar-ic" style="color:var(--ar-aqua)">&#x2713;</span> Teams wanting DI in React via useInjectable</li>
              <li><span class="ar-ic" style="color:var(--ar-aqua)">&#x2713;</span> Typed REST data provider, token refresh, and i18n</li>
            </ul>
          </div>
          <div class="ar-pcard ar-pcard--alt">
            <h3>&#x25CB; Consider alternatives</h3>
            <ul>
              <li><span class="ar-ic" style="color:var(--ar-text-3)">&#x2192;</span> Lightweight landing pages with no admin state</li>
              <li><span class="ar-ic" style="color:var(--ar-text-3)">&#x2192;</span> Non-React applications (Vue, Svelte, Angular)</li>
              <li><span class="ar-ic" style="color:var(--ar-text-3)">&#x2192;</span> Apps with no service orchestration or DI requirements</li>
              <li><span class="ar-ic" style="color:var(--ar-text-3)">&#x2192;</span> Greenfield projects not using react-admin data contracts</li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Powered-by chips + footer CTA ────────────────────────────────── -->
    <div class="ar-divider" />
    <div class="ar-wrap">
      <section class="ar-section ar-powered">
        <div class="ar-section-head ar-powered__head">
          <div class="ar-label">Built on giants</div>
          <h2>Powered by the best of the ecosystem</h2>
        </div>
        <div class="ar-chips">
          <div class="ar-chip"><b>react-admin</b> · ra-core</div>
          <div class="ar-chip"><b>IGNIS</b> · IoC Container</div>
          <div class="ar-chip"><b>React</b> · UI Runtime</div>
          <div class="ar-chip"><b>TypeScript</b></div>
          <div class="ar-chip"><b>Radix</b> + Tailwind</div>
        </div>
        <p class="ar-powered__footnote">Bringing IGNIS inversion of control and react-admin data contracts to modern frontend applications.</p>
      </section>

      <section class="ar-footer-cta">
        <h2>Build something that <span class="ar-gtext">scales</span>.</h2>
        <p>From first screen to production admin apps. No ceremony, pure architecture.</p>
        <div class="ar-cta">
          <a href="/guides/" class="ar-btn ar-btn--primary">Get Started &#x2192;</a>
          <a href="https://github.com/VENIZIA-AI/ardor" class="ar-btn ar-btn--secondary">Read the Docs</a>
        </div>
      </section>
    </div>
  </div>
</template>
