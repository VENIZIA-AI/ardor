import { defineConfig, type DefaultTheme } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

// Every page under content/ must be reachable from a sidebar below - scripts/check-sidebar.mts fails
// the build on an orphan page or a dead link.

const guidesSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Guides', items: [{ text: 'Overview', link: '/guides/' }] },
  {
    text: 'Get started',
    collapsed: false,
    items: [
      { text: 'Create a project', link: '/guides/get-started/create-a-project' },
      { text: 'Setup', link: '/guides/get-started/setup' },
      { text: '5-minute quickstart', link: '/guides/get-started/5-minute-quickstart' },
      { text: 'Philosophy', link: '/guides/get-started/philosophy' },
    ],
  },
  {
    text: 'Tutorials',
    collapsed: false,
    items: [
      { text: 'Build an admin', link: '/guides/tutorials/build-an-admin' },
      { text: 'Add sign-in', link: '/guides/tutorials/add-sign-in' },
      { text: 'Add a language', link: '/guides/tutorials/add-a-language' },
    ],
  },
  {
    text: 'Core concepts',
    collapsed: false,
    items: [
      { text: 'Application', link: '/guides/core-concepts/application' },
      { text: 'Configuration', link: '/guides/core-concepts/configuration' },
      { text: 'Providers', link: '/guides/core-concepts/providers' },
      { text: 'Resources and pages', link: '/guides/core-concepts/resources-and-pages' },
      { text: 'Dependency injection', link: '/guides/core-concepts/dependency-injection' },
    ],
  },
  {
    text: 'Migrations',
    collapsed: false,
    items: [
      { text: 'From @minimaltech/ra-core-infra', link: '/guides/migrations/from-ra-core-infra' },
    ],
  },
];

const referencesSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'References', items: [{ text: 'Overview', link: '/references/' }] },
  {
    text: 'Core',
    collapsed: false,
    items: [
      { text: 'Application', link: '/references/application' },
      { text: 'Binding keys', link: '/references/binding-keys' },
      { text: 'Types and constants', link: '/references/types' },
    ],
  },
  {
    text: 'Providers',
    collapsed: false,
    items: [
      { text: 'REST data provider', link: '/references/data-provider' },
      { text: 'Auth provider', link: '/references/auth-provider' },
      { text: 'Internationalization', link: '/references/i18n' },
      { text: 'Network layer', link: '/references/network' },
      { text: 'Permission provider', link: '/references/permission' },
      { text: 'Features', link: '/references/features' },
    ],
  },
  {
    text: 'Data and React',
    collapsed: false,
    items: [
      { text: 'Repositories', link: '/references/repository' },
      { text: 'Hooks', link: '/references/hooks' },
    ],
  },
];

const extensionsSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Extensions', items: [{ text: 'Overview', link: '/extensions/' }] },
  {
    text: 'Packages and patterns',
    collapsed: false,
    items: [
      { text: 'Socket.IO client', link: '/extensions/socket-client' },
      { text: 'CountRestDataProvider', link: '/extensions/count-provider' },
      { text: 'Non-HTTP transport', link: '/extensions/custom-transport' },
    ],
  },
];

const bestPracticesSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Best practices', items: [{ text: 'Overview', link: '/best-practices/' }] },
  {
    text: 'Conventions',
    collapsed: false,
    items: [
      { text: 'Module augmentation', link: '/best-practices/module-augmentation' },
      { text: 'Binding keys and registration', link: '/best-practices/binding-keys' },
      { text: 'Writing services and repositories', link: '/best-practices/services' },
      { text: 'No-auth paths and recovery', link: '/best-practices/auth-recovery' },
    ],
  },
];

const changelogsSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Overview',
    items: [
      { text: 'Introduction', link: '/changelogs/' },
      { text: 'Template', link: '/changelogs/template' },
    ],
  },
  {
    text: 'History',
    collapsed: false,
    items: [
      {
        text: '2026-10-24',
        collapsed: true,
        items: [
          { text: 'ARDOR 0.4.0 follows IGNIS 0.4.0', link: '/changelogs/2026-10-24-ardor-0-4-0' },
          {
            text: 'The knowledge log is gone',
            link: '/changelogs/2026-10-24-knowledge-log-dropped',
          },
          {
            text: 'The fetcher no longer logs secrets, and four request bugs are fixed',
            link: '/changelogs/2026-10-24-node-fetcher-fixes',
          },
          {
            text: 'scripts/ is grouped by purpose',
            link: '/changelogs/2026-10-24-scripts-grouped',
          },
          {
            text: 'The unused scripts and make targets are gone',
            link: '/changelogs/2026-10-24-unused-scripts-removed',
          },
        ],
      },
      {
        text: '2026-10-23',
        collapsed: true,
        items: [
          {
            text: 'The repository formats with bun fmt',
            link: '/changelogs/2026-10-23-format-with-bun-fmt',
          },
          {
            text: 'No project keeps a formatter config any more',
            link: '/changelogs/2026-10-23-no-formatter-config',
          },
          {
            text: 'One code style, set in one bunfig.toml',
            link: '/changelogs/2026-10-23-one-code-style',
          },
          {
            text: 'The keys of package.json are sorted and checked',
            link: '/changelogs/2026-10-23-package-json-sorted',
          },
          {
            text: 'A container stops when a required variable is missing',
            link: '/changelogs/2026-10-23-runtime-config-required-env',
          },
        ],
      },
      {
        text: '2026-10-22',
        collapsed: true,
        items: [
          {
            text: 'Runtime config in the app preset, one image for every environment',
            link: '/changelogs/2026-10-22-preset-runtime-config',
          },
        ],
      },
      {
        text: '2026-10-21',
        collapsed: true,
        items: [
          {
            text: 'An .env.example that matches the app, ignore files, and a sturdier image',
            link: '/changelogs/2026-10-21-preset-env-ignore-image',
          },
          { text: 'A feature library preset', link: '/changelogs/2026-10-21-preset-lib' },
          {
            text: 'A tidy app root and a Dockerfile in the preset',
            link: '/changelogs/2026-10-21-preset-root-and-image',
          },
        ],
      },
      {
        text: '2026-10-20',
        collapsed: true,
        items: [
          {
            text: 'Every app has the same scripts',
            link: '/changelogs/2026-10-20-app-script-standard',
          },
          { text: 'ARDOR 0.3.0 Is Stable', link: '/changelogs/2026-10-20-ardor-0-3-0-stable' },
          {
            text: "The preset's typecheck runs bun check",
            link: '/changelogs/2026-10-20-preset-bun-check',
          },
          {
            text: 'Silent first run for the ARDOR preset',
            link: '/changelogs/2026-10-20-preset-first-run',
          },
          {
            text: "The preset app's lint scripts are short",
            link: '/changelogs/2026-10-20-preset-lint-script',
          },
          {
            text: 'The preset app imports its own modules with #src',
            link: '/changelogs/2026-10-20-preset-subpath-imports',
          },
          {
            text: 'The generated app is one styled page',
            link: '/changelogs/2026-10-20-preset-ui',
          },
          { text: 'ARDOR ships a VULCAN preset', link: '/changelogs/2026-10-20-vulcan-preset' },
        ],
      },
      {
        text: '2026-10-19',
        collapsed: true,
        items: [
          {
            text: 'Augment @venizia/ardor, not the declaring packages',
            link: '/changelogs/2026-10-19-augment-the-umbrella',
          },
          {
            text: 'toDataUrl no longer needs Promise.withResolvers',
            link: '/changelogs/2026-10-19-to-data-url-without-with-resolvers',
          },
          {
            text: 'The wiki is rebuilt around the core of ARDOR',
            link: '/changelogs/2026-10-19-wiki-rebuild',
          },
        ],
      },
      {
        text: '2026-10-18',
        collapsed: true,
        items: [
          {
            text: 'start() names a module cycle in the artifact index',
            link: '/changelogs/2026-10-18-artifact-cycle-error',
          },
          {
            text: "IGNIS's sign-in is the default, and an application can run with no sign-in",
            link: '/changelogs/2026-10-18-auth-optional-and-ignis-sign-in',
          },
          {
            text: 'ARDOR follows ignis-boot 0.2.1-11',
            link: '/changelogs/2026-10-18-boot-pins-class-names',
          },
          {
            text: 'A package depends on its siblings at the exact version released with it',
            link: '/changelogs/2026-10-18-exact-sibling-versions',
          },
          {
            text: 'The final IGNIS chain, and the examples autoload with the Vite plugin',
            link: '/changelogs/2026-10-18-final-pin-and-autoload',
          },
          {
            text: 'Options hold data, behaviour lives in protected hooks',
            link: '/changelogs/2026-10-18-hooks-not-flags',
          },
          {
            text: 'Types, hooks and utilities follow IGNIS house style',
            link: '/changelogs/2026-10-18-house-style-types-hooks-utilities',
          },
          {
            text: 'ARDOR builds on the IGNIS 0.2.2-12 chain',
            link: '/changelogs/2026-10-18-ignis-0-2-2-12-chain',
          },
          {
            text: 'ARDOR builds on the IGNIS 0.2.2-9 chain',
            link: '/changelogs/2026-10-18-ignis-0-2-2-9-chain',
          },
          {
            text: 'One copy of each package that carries identity, owned by the application',
            link: '/changelogs/2026-10-18-one-copy-of-each',
          },
          {
            text: 'The release script waits for each tarball, and vert-admin splits its vendor chunks',
            link: '/changelogs/2026-10-18-release-waits-for-the-tarball',
          },
          {
            text: 'login stores roles, and the sign-in extension points are protected hooks',
            link: '/changelogs/2026-10-18-sign-in-hooks',
          },
          {
            text: 'ARDOR 0.1.4 on stable IGNIS 0.2.2 and VULCAN 0.2.0',
            link: '/changelogs/2026-10-18-stable-ignis-0-2-2',
          },
          {
            text: 'TPaths stops at a Date, a Set, a function and an any field',
            link: '/changelogs/2026-10-18-tpaths-stops-at-values',
          },
        ],
      },
      {
        text: '2026-10-17',
        collapsed: true,
        items: [
          {
            text: "ARDOR's agent tooling is VULCAN",
            link: '/changelogs/2026-10-17-agent-tooling-vulcan',
          },
          { text: 'Type checking runs on bun check', link: '/changelogs/2026-10-17-bun-check' },
          {
            text: 'A generated artifact index for the application',
            link: '/changelogs/2026-10-17-generated-artifact-index',
          },
          {
            text: 'PATCH in upper case, log levels, getManyReference without pagination, no NaN count',
            link: '/changelogs/2026-10-17-patch-log-levels-pagination-count',
          },
        ],
      },
      {
        text: '2026-10-16',
        collapsed: true,
        items: [
          {
            text: 'Every package builds, lints and formats through make',
            link: '/changelogs/2026-10-16-make-per-package',
          },
          {
            text: 'ARDOR lints with oxlint and formats with oxfmt',
            link: '/changelogs/2026-10-16-oxlint-oxfmt',
          },
        ],
      },
      {
        text: '2026-10-15',
        collapsed: true,
        items: [
          {
            text: 'ARDOR 0.1.3, stable on the IGNIS 0.2.2 line',
            link: '/changelogs/2026-10-15-ardor-0-1-3-stable',
          },
        ],
      },
      {
        text: '2026-10-14',
        collapsed: true,
        items: [
          {
            text: 'canAccess reaches an AuthProvider subclass without a fourth super argument',
            link: '/changelogs/2026-10-14-permission-provider-from-the-container',
          },
        ],
      },
      {
        text: '2026-10-12',
        collapsed: true,
        items: [
          {
            text: 'ARDOR 0.1.2, stable on IGNIS 0.2.1',
            link: '/changelogs/2026-10-12-ardor-0-1-2-stable',
          },
        ],
      },
      {
        text: '2026-10-10',
        collapsed: true,
        items: [
          {
            text: 'checkError redirects on a 401 or 403 from the data provider',
            link: '/changelogs/2026-10-10-check-error-reads-status-code',
          },
          {
            text: 'The data provider throws an ApplicationError, and reads Content-Range like IGNIS',
            link: '/changelogs/2026-10-10-data-provider-errors-through-response-reader',
          },
          {
            text: 'useDocumentTitle no longer overwrites a newer title on unmount',
            link: '/changelogs/2026-10-10-document-title-cleanup-guard',
          },
        ],
      },
      {
        text: '2026-10-09',
        collapsed: true,
        items: [
          {
            text: 'Const-value types keep their literals when copied',
            link: '/changelogs/2026-10-09-const-value-types-keep-literals',
          },
          {
            text: 'useDocumentTitle and useHtmlLang',
            link: '/changelogs/2026-10-09-document-title-and-html-lang-hooks',
          },
        ],
      },
      {
        text: '2026-10-07',
        collapsed: true,
        items: [
          {
            text: 'Class identity survives a minifier',
            link: '/changelogs/2026-10-07-class-identity-and-container',
          },
          {
            text: 'Feature modules and permissions',
            link: '/changelogs/2026-10-07-feature-modules',
          },
          {
            text: 'List extras on the data provider and the repository',
            link: '/changelogs/2026-10-07-list-extras',
          },
        ],
      },
      {
        text: '2026-10-06',
        collapsed: true,
        items: [
          {
            text: 'A repository sends what the data provider sends',
            link: '/changelogs/2026-10-06-repository-sends-the-session',
          },
        ],
      },
      {
        text: '2026-10-02',
        collapsed: true,
        items: [
          {
            text: "HttpRepository writes and shares the data provider's auth; BaseCrudService is gone",
            link: '/changelogs/2026-10-02-repository-writes-and-ignis-0-2-1',
          },
        ],
      },
      {
        text: '2026-09-24',
        collapsed: true,
        items: [
          {
            text: 'ARDOR 0.1.1, the first stable line on IGNIS 0.2.0',
            link: '/changelogs/2026-09-24-ardor-0-1-1-stable',
          },
          {
            text: 'Repositories by discovery, a relative baseUrl, and IGNIS 0.2.0 stable',
            link: '/changelogs/2026-09-24-remote-repositories-and-relative-base-url',
          },
        ],
      },
      {
        text: '2026-09-23',
        collapsed: true,
        items: [
          {
            text: 'Registration by hand, useRepository, and a clean-install gate',
            link: '/changelogs/2026-09-23-registration-by-hand-and-clean-install',
          },
        ],
      },
      {
        text: '2026-09-19',
        collapsed: true,
        items: [
          {
            text: 'IGNIS stereotypes and repositories, bulk writes in the body, safer headers',
            link: '/changelogs/2026-09-19-ignis-repository-and-bulk-writes',
          },
        ],
      },
      {
        text: '2026-09-16',
        collapsed: true,
        items: [
          {
            text: 'The network layer is fetch only, and axios is gone',
            link: '/changelogs/2026-09-16-fetch-only-network-layer',
          },
        ],
      },
      {
        text: '2026-09-11',
        collapsed: true,
        items: [
          {
            text: 'ARDOR Replaces @minimaltech/ra-core-infra',
            link: '/changelogs/2026-09-11-ardor-from-ra-core-infra',
          },
          {
            text: 'One logger per scope, singleton services, and a kernel that owns its headers',
            link: '/changelogs/2026-09-11-kernel-hardening',
          },
        ],
      },
    ],
  },
];

const config = defineConfig({
  base: '/',
  appearance: 'dark',
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'one-dark-pro',
    },
  },
  srcDir: '../content',
  outDir: './.vitepress/dist',
  srcExclude: ['**/template/**'],
  title: 'ARDOR',
  description:
    "Frontend application framework for the VENIZIA family - react-admin's data contract on IGNIS's container",
  head: [
    // Favicon + PWA
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    // Fonts - preconnect
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    // Fonts - stylesheet
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap',
      },
    ],
    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    [
      'meta',
      { property: 'og:title', content: "ARDOR - react-admin's data contract on IGNIS's container" },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A react-admin application built as an IGNIS inversion-of-control container: dependency injection in the browser, a typed REST data layer, auth recovery and i18n - one import.',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://ardor.venizia.ai/' }],
    // Twitter / X card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'meta',
      {
        name: 'twitter:title',
        content: "ARDOR - react-admin's data contract on IGNIS's container",
      },
    ],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'A react-admin application built as an IGNIS inversion-of-control container: dependency injection in the browser, a typed REST data layer, auth recovery and i18n - one import.',
      },
    ],
  ],
  vite: {
    // mermaid pulls in dayjs/esm, whose extensionless imports break Node's native ESM resolver during
    // SSR. Bundle them through Vite (noExternal) so Vite's resolver handles the resolution.
    ssr: { noExternal: ['vitepress-plugin-mermaid', 'mermaid', 'dayjs'] },
    optimizeDeps: { include: ['mermaid', 'dayjs'] },
    build: {
      target: 'es2022',
      // mermaid is a legitimately large dependency (~3 MB); isolated into its own lazy chunk below.
      // Keep the warning limit above its size so the advisory only fires for unexpected app bloat.
      chunkSizeWarningLimit: 3500,
      rollupOptions: {
        output: {
          manualChunks: id => {
            if (id.includes('node_modules')) {
              // Isolate mermaid (+ its heavy deps) - large and only needed on pages with diagrams.
              if (
                id.includes('mermaid') ||
                id.includes('cytoscape') ||
                id.includes('dagre') ||
                id.includes('d3') ||
                id.includes('khroma')
              ) {
                return 'mermaid';
              }
              // Split search functionality
              if (id.includes('minisearch') || id.includes('mark.js')) {
                return 'search';
              }
              // Split Vue core
              if (id.includes('@vue/')) {
                return 'vue-vendor';
              }
            }
          },
        },
      },
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    search: { provider: 'local' },
    nav: [
      { text: 'Guides', link: '/guides/' },
      { text: 'References', link: '/references/' },
      { text: 'Extensions', link: '/extensions/' },
      { text: 'Best Practices', link: '/best-practices/' },
      { text: 'Changelogs', link: '/changelogs/' },
    ],
    sidebar: {
      '/guides/': guidesSidebar,
      '/references/': referencesSidebar,
      '/extensions/': extensionsSidebar,
      '/best-practices/': bestPracticesSidebar,
      '/changelogs/': changelogsSidebar,
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/VENIZIA-AI/ardor' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright (c) 2025 VENIZIA Ltd. Co.',
    },
    outline: { level: [2, 3] },
  },
});

export default withMermaid(config);
