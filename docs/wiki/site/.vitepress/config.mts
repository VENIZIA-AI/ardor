import { defineConfig, type DefaultTheme } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { writeChangelogFeed } from './theme/shared/changelog-loader.ts';
import { VENIZIA_LOGO_SVG } from './theme/shared/venizia-logo.ts';

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
      { text: 'Vite setup', link: '/guides/get-started/vite-setup' },
      { text: 'Quickstart', link: '/guides/get-started/5-minute-quickstart' },
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

const config = defineConfig({
  base: '/',
  appearance: 'dark',
  markdown: {
    // The code windows are dark in both themes (theme/shared/tokens.css), so one dark theme serves both.
    theme: 'one-dark-pro',
  },
  srcDir: '../content',
  outDir: './.vitepress/dist',
  srcExclude: ['**/template/**'],
  title: 'ARDOR',
  description:
    'Admin consoles on react-admin, with the same dependency injection and filter language as IGNIS, plus sign-in and i18n.',
  // The changelog feed (RSS 2.0) is written next to the pages; the changelog has no sidebar, its index is the way in.
  buildEnd: async (siteConfig) => {
    await writeChangelogFeed({
      outDir: siteConfig.outDir,
      site: {
        title: 'ARDOR changelog',
        description: 'What changed in ARDOR, who is affected and what to do about it.',
        siteUrl: 'https://ardor.venizia.ai',
      },
    });
  },
  head: [
    [
      'link',
      {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'ARDOR changelog',
        href: '/changelog.xml',
      },
    ],
    // Favicon + PWA
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    // The home page and its terminal hide their reveal states only under this class, set before first paint.
    ['script', {}, "document.documentElement.classList.add('js');"],
    // Open Graph
    ['meta', { property: 'og:type', content: 'website' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'ARDOR - Shape your admin panels. ARDOR tempers the surface.',
      },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Admin consoles on react-admin, with the same dependency injection and filter language as IGNIS, plus sign-in and i18n.',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://ardor.venizia.ai/' }],
    // Twitter / X card
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'meta',
      {
        name: 'twitter:title',
        content: 'ARDOR - Shape your admin panels. ARDOR tempers the surface.',
      },
    ],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Admin consoles on react-admin, with the same dependency injection and filter language as IGNIS, plus sign-in and i18n.',
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
      { text: 'Best Practices', link: '/best-practices/' },
      { text: 'Changelogs', link: '/changelogs/' },
    ],
    sidebar: {
      '/guides/': guidesSidebar,
      '/references/': referencesSidebar,
      '/extensions/': extensionsSidebar,
      '/best-practices/': bestPracticesSidebar,
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/VENIZIA-AI/ardor' },
      { icon: { svg: VENIZIA_LOGO_SVG }, link: 'https://venizia.ai', ariaLabel: 'Venizia' },
    ],
    outline: { level: [2, 3] },
  },
});

export default withMermaid(config);
