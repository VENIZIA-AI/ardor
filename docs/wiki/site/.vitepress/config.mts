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
      { text: '5-minute quickstart', link: '/guides/get-started/quickstart' },
      { text: 'Philosophy', link: '/guides/get-started/philosophy' },
    ],
  },
  {
    text: 'Migration',
    collapsed: false,
    items: [{ text: 'From @minimaltech/ra-core-infra', link: '/guides/migration/from-ra-core-infra' }],
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
    text: 'Data and auth',
    collapsed: false,
    items: [
      { text: 'REST data provider', link: '/references/data-provider' },
      { text: 'Network layer', link: '/references/network' },
      { text: 'Auth provider', link: '/references/auth-provider' },
      { text: 'Internationalization', link: '/references/i18n' },
    ],
  },
  { text: 'React', collapsed: false, items: [{ text: 'Hooks', link: '/references/hooks' }] },
];

const extensionsSidebar: DefaultTheme.SidebarItem[] = [
  { text: 'Extensions', items: [{ text: 'Overview', link: '/extensions/' }] },
  {
    text: 'Packages and patterns',
    collapsed: false,
    items: [
      { text: 'UI kit', link: '/extensions/ui-kit' },
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
      { text: 'Binding keys and services', link: '/best-practices/binding-keys' },
      { text: 'Writing services', link: '/best-practices/services' },
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
        text: '2026-09-11',
        collapsed: true,
        items: [
          {
            text: 'One logger per scope, singleton services, kernel headers',
            link: '/changelogs/2026-09-11-kernel-hardening',
          },
          {
            text: 'ARDOR Replaces @minimaltech/ra-core-infra',
            link: '/changelogs/2026-09-11-ardor-from-ra-core-infra',
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
  description: "Frontend application framework for the VENIZIA family - react-admin's data contract on IGNIS's container",
  head: [
    // Favicon + PWA
    ['link', { rel: 'icon', href: '/logo.svg' }],
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
    ['meta', { property: 'og:title', content: "ARDOR - react-admin's data contract on IGNIS's container" }],
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
    ['meta', { name: 'twitter:title', content: "ARDOR - react-admin's data contract on IGNIS's container" }],
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
          manualChunks: (id) => {
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
      { text: 'Best practices', link: '/best-practices/' },
      { text: 'Changelog', link: '/changelogs/' },
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
