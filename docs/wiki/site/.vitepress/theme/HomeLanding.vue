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
          <h1>Admin apps on an<br />IGNIS <span class="ar-gtext">container</span></h1>
          <p class="ar-lede">
            ra-core's CRUD contract on IGNIS's container.
            <b>Dependency injection, a REST data provider, token refresh on 401 and i18n</b>
            in one package, <code>@venizia/ardor</code>, with a core that uses no Node builtins.
          </p>
          <div class="ar-cta">
            <a href="/guides/get-started/create-a-project" class="ar-btn ar-btn--primary"
              >Get Started &#x2192;</a
            >
            <a href="https://github.com/VENIZIA-AI/ardor" class="ar-btn ar-btn--secondary"
              >&#x2605; Star on GitHub</a
            >
          </div>
          <div class="ar-stats">
            <div class="ar-stat">
              <div class="ar-stat__n ar-gtext">4</div>
              <div class="ar-stat__l">packages: kernel, react, admin, umbrella</div>
            </div>
            <div class="ar-stat">
              <div class="ar-stat__n ar-gtext">0</div>
              <div class="ar-stat__l">Node builtins in kernel, react, admin</div>
            </div>
            <div class="ar-stat">
              <div class="ar-stat__n ar-gtext">0.4.3</div>
              <div class="ar-stat__l">current release, before 1.0</div>
            </div>
          </div>
        </div>

        <div class="ar-code-win">
          <div class="ar-code-win__bar">
            <span class="ar-code-win__dot" style="background: var(--ar-brand)" />
            <span class="ar-code-win__dot" style="background: var(--ar-aqua)" />
            <span class="ar-code-win__dot" style="background: var(--ar-brand-lt)" />
            <span class="ar-code-win__filename">admin.configuration.ts</span>
            <span class="ar-code-win__tag">from the preset</span>
          </div>
          <!-- v-pre: skip Vue template compilation inside the code sample -->
          <pre v-pre><span class="ar-k">import</span> {
  <span class="ar-k">type</span> <span class="ar-c">BaseArdorApplication</span>,
  <span class="ar-d">configuration</span>,
  <span class="ar-c">CoreBindings</span>,
  <span class="ar-c">DefaultRestDataProvider</span>,
  <span class="ar-d">getRuntimeConfig</span>,
  <span class="ar-d">inject</span>,
  <span class="ar-d">provide</span>,
} <span class="ar-k">from</span> <span class="ar-s">'@venizia/ardor'</span>

@<span class="ar-d">configuration</span>()
<span class="ar-k">export class</span> <span class="ar-c">AdminConfiguration</span> {
  <span class="ar-k">constructor</span>(
    @<span class="ar-d">inject</span>({ key: <span class="ar-c">CoreBindings</span>.APPLICATION_INSTANCE })
    <span class="ar-k">private readonly</span> application: <span class="ar-c">BaseArdorApplication</span>,
  ) {}

  @<span class="ar-d">provide</span>({ key: <span class="ar-c">CoreBindings</span>.REST_DATA_PROVIDER_OPTIONS })
  <span class="ar-d">restDataProviderOptions</span>() {
    <span class="ar-k">const</span> url = <span class="ar-d">getRuntimeConfig</span>({
      key: <span class="ar-s">'VITE_API_URL'</span>,
      buildTimeEnv: <span class="ar-k">import</span>.meta.env,
      defaultValue: <span class="ar-s">'/api'</span>,
    })

    <span class="ar-k">return</span> { url, noAuthPathRegex: <span class="ar-s">/./</span> }
  }

  @<span class="ar-d">provide</span>({ key: <span class="ar-c">CoreBindings</span>.DEFAULT_REST_DATA_PROVIDER })
  <span class="ar-d">restDataProvider</span>() {
    <span class="ar-k">return this</span>.application
      .<span class="ar-d">instantiate</span>(<span class="ar-c">DefaultRestDataProvider</span>)
      .<span class="ar-d">value</span>(<span class="ar-k">this</span>.application)
  }
}</pre>
        </div>
      </section>
    </div>

    <!-- ── 6 feature cards ──────────────────────────────────────────────── -->
    <div class="ar-divider" />
    <div class="ar-wrap">
      <section class="ar-section">
        <div class="ar-section-head">
          <div class="ar-label">What is in the box</div>
          <h2>Six pieces,<br />all in ARDOR 0.4.3</h2>
          <p>Each one is code in this repository, with a reference page and a test.</p>
        </div>
        <div class="ar-features">
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- bolt / performance -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h3>Browser IoC Container</h3>
            <p>
              Full dependency injection in the browser. Resolve bound singletons cleanly with
              <code>useInjectable</code> and <code>services.*</code> keys.
            </p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- hexagon / DI container -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                />
              </svg>
            </div>
            <h3>REST Data Provider</h3>
            <p>
              Maps react-admin pagination, sorting, and filters to IGNIS
              <code>{ where, order, limit, skip }</code> and reads the total from Content-Range.
            </p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- database / type-safe data -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <h3>Self-Healing Auth</h3>
            <p>
              Handles login, logout, checkAuth, and checkError. A 401 triggers one token refresh for
              a burst of requests, then retries them. An HTTP repository can share the same token
              and refresh through <code>getDataSourceAuth()</code>.
            </p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- shield / auth -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>Type-Safe i18n</h3>
            <p>
              <code>useTranslate</code> with keys checked through module augmentation. English and
              Vietnamese bundles are included.
            </p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- arrows / real-time -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <h3>Typed Redux Hooks</h3>
            <p>
              <code>createAppSelectors</code> and <code>createAppDispatch</code> build typed
              selector and dispatch hooks for your Redux store.
            </p>
          </div>
          <div class="ar-fcard">
            <div class="ar-fcard__icon">
              <!-- radio / socket client -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="2" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
              </svg>
            </div>
            <h3>Runtime Config and Preset</h3>
            <p>
              <code>getRuntimeConfig</code> reads <code>window.__APP_CONFIG__</code>, so one built
              image serves every environment. With <code>required: true</code> it throws an error
              with a code when the value is missing. The preset adds an nginx image with gzip,
              <code>/health</code> and security headers.
            </p>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Performance band (horizontal bar chart) ──────────────────────── -->
    <div class="ar-divider" />
    <div class="ar-wrap">
      <div class="ar-perf">
        <div class="ar-perf__copy">
          <div class="ar-label">The packages</div>
          <h2>Take the umbrella,<br />or only the layer<br />you need.</h2>
          <p>
            The kernel is the container and has no UI. React adds the hooks. Admin adapts ra-core.
            <code>@venizia/ardor</code> re-exports all three.
          </p>
          <p class="ar-fine">
            Kernel, react and admin use no Node builtins, so they run in the browser.
          </p>
        </div>
        <table class="ar-pkgs">
          <thead>
            <tr>
              <th>Package</th>
              <th>Role</th>
              <th>Runs in</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>@venizia/ardor</code></td>
              <td>Re-exports the three packages below, and ships the VULCAN preset</td>
              <td>Browser</td>
            </tr>
            <tr>
              <td><code>@venizia/ardor-kernel</code></td>
              <td>The container, services, network layer and runtime config; no UI</td>
              <td>Browser</td>
            </tr>
            <tr>
              <td><code>@venizia/ardor-react</code></td>
              <td>Application context and hooks</td>
              <td>Browser</td>
            </tr>
            <tr>
              <td><code>@venizia/ardor-admin</code></td>
              <td>The ra-core adapter: providers and <code>ArdorApplication</code></td>
              <td>Browser</td>
            </tr>
          </tbody>
        </table>
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
              <li>
                <span class="ar-ic" style="color: var(--ar-accent)">&#x2713;</span> Enterprise admin
                panels needing clean IoC architecture
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-accent)">&#x2713;</span> Applications
                pairing react-admin with IGNIS backends
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-accent)">&#x2713;</span> Teams wanting DI
                in React via useInjectable
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-accent)">&#x2713;</span> Typed REST data
                provider, token refresh, and i18n
              </li>
            </ul>
          </div>
          <div class="ar-pcard ar-pcard--alt">
            <h3>&#x25CB; Probably not a fit</h3>
            <ul>
              <li>
                <span class="ar-ic" style="color: var(--ar-text-3)">&#x2192;</span> Lightweight
                landing pages with no admin state
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-text-3)">&#x2192;</span> Applications
                that are not built on React
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-text-3)">&#x2192;</span> Apps with no
                service orchestration or DI requirements
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-text-3)">&#x2192;</span> Greenfield
                projects not using react-admin data contracts
              </li>
              <li>
                <span class="ar-ic" style="color: var(--ar-text-3)">&#x2192;</span> Projects that
                need a 1.0 API: ARDOR is 0.4.x and a minor release can break
              </li>
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
          <div class="ar-label">Built on</div>
          <h2>What ARDOR stands on</h2>
        </div>
        <div class="ar-chips">
          <div class="ar-chip"><b>ra-core</b> · CRUD runtime of react-admin</div>
          <div class="ar-chip"><b>IGNIS</b> · IoC Container</div>
          <div class="ar-chip"><b>React</b> · UI Runtime</div>
          <div class="ar-chip"><b>TypeScript</b></div>
          <div class="ar-chip"><b>VULCAN</b> · project scaffolding</div>
        </div>
        <p class="ar-powered__footnote">
          ARDOR is the browser framework of <a href="https://venizia.ai">VENIZIA</a>, next to IGNIS
          on the server and VULCAN for tooling.
        </p>
      </section>

      <section class="ar-footer-cta">
        <h2>Create an admin in <span class="ar-gtext">one command</span>.</h2>
        <p><code>bun x @venizia/vulcan init --preset ardor</code></p>
        <div class="ar-cta">
          <a href="/guides/get-started/create-a-project" class="ar-btn ar-btn--primary"
            >Get Started &#x2192;</a
          >
          <a href="/references/" class="ar-btn ar-btn--secondary">References</a>
        </div>
      </section>
    </div>
  </div>
</template>
