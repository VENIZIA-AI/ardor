import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "ARDOR UI",
  description: "React UI Kit with Tailwind CSS v4, Radix UI, and shadcn/ui",
  base: '/ardor/', // Adjust based on GitHub Pages URL
  ignoreDeadLinks: true, // MVP: Allow dead links for coming soon pages

  head: [
    ['link', { rel: 'icon', href: '/ardor/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#18181b' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:title', content: 'ARDOR UI | React UI Kit' }],
    ['meta', { name: 'og:description', content: 'React UI Kit with Tailwind CSS v4, Radix UI, and shadcn/ui' }]
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'ARDOR UI',

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Components', link: '/components/' },
      { text: 'Examples', link: '/examples/quick-start' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Theming', link: '/guide/theming' },
            { text: 'TypeScript', link: '/guide/typescript' }
          ]
        }
      ],

      '/components/': [
        {
          text: 'Overview',
          items: [
            { text: 'All Components', link: '/components/' }
          ]
        },
        {
          text: 'Form Components',
          items: [
            { text: 'Button', link: '/components/button' },
            { text: 'Checkbox', link: '/components/checkbox' },
            { text: 'Field', link: '/components/field' },
            { text: 'Input', link: '/components/input' },
            { text: 'Label', link: '/components/label' },
            { text: 'Radio Group', link: '/components/radio-group' },
            { text: 'Select', link: '/components/select' },
            { text: 'Switch', link: '/components/switch' },
            { text: 'Textarea', link: '/components/textarea' }
          ]
        },
        {
          text: 'Data Display',
          items: [
            { text: 'Badge', link: '/components/badge' },
            { text: 'Card', link: '/components/card' },
            { text: 'Table', link: '/components/table' }
          ]
        },
        {
          text: 'Feedback',
          items: [
            { text: 'Alert', link: '/components/alert' },
            { text: 'Sonner (Toast)', link: '/components/sonner' },
            { text: 'Tooltip', link: '/components/tooltip' }
          ]
        },
        {
          text: 'Overlay',
          items: [
            { text: 'Alert Dialog', link: '/components/alert-dialog' },
            { text: 'Dialog', link: '/components/dialog' },
            { text: 'Drawer', link: '/components/drawer' },
            { text: 'Popover', link: '/components/popover' },
            { text: 'Sheet', link: '/components/sheet' }
          ]
        },
        {
          text: 'Navigation',
          items: [
            { text: 'Tabs', link: '/components/tabs' }
          ]
        },
        {
          text: 'Adaptive Components ⭐',
          items: [
            { text: 'Adaptive Dialog', link: '/components/adaptive-dialog' }
          ]
        }
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Quick Start', link: '/examples/quick-start' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/VENIZIA-AI/ardor' }
    ],

    search: {
      provider: 'local',
      options: {
        detailedView: true
      }
    },

    editLink: {
      pattern: 'https://github.com/VENIZIA-AI/ardor/edit/develop/packages/docs/site/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present VENIZIA AI'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
})
