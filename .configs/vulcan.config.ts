import type { VulcanConfig } from '@venizia/vulcan';

// ARDOR's project config for VULCAN (agent, knowledge and atlas tooling). The `okf` and `atlas`
// blocks are validated today and consumed once VULCAN's tools read project config; until then
// scripts/vulcan-bridge.ts runs ARDOR's own generators.
export default {
  agents: ['claude'],

  // The base slot V-W-01: git writes happen only on the user's word (ARDOR's own W-01 agrees).
  rules: { 'V-W-01': 'on-user-word' },

  // VULCAN's digest prints the rule rows; this adds the minimap shape of P-09.
  hooks: [
    {
      event: 'SessionStart',
      matcher: 'startup|resume|clear|compact',
      command: 'bun "${CLAUDE_PROJECT_DIR}"/.agents/hooks/minimap.ts',
    },
  ],

  knowledge: {
    bundle: '.agents/knowledge',
    wiki: 'docs/wiki/content',
    changelogs: 'docs/wiki/content/changelogs',
  },

  okf: {
    renderers: [
      'providers',
      'hooks-and-services',
      'binding-keys',
      'source-map',
      'makefile-targets',
    ],
    coverage: [
      { name: 'providers', path: 'packages/admin/src/providers' },
      { name: 'hooks', path: 'packages/react/src/hooks' },
      { name: 'services', path: 'packages/kernel/src/base/services' },
    ],
  },

  atlas: {
    // Package directory -> npm name, in release order. `ui-kit` is retired; old changelogs keep it.
    packages: {
      kernel: '@venizia/ardor-kernel',
      react: '@venizia/ardor-react',
      admin: '@venizia/ardor-admin',
      ardor: '@venizia/ardor',
      'ui-kit': '@venizia/ardor-ui-kit',
    },
    releaseCommit: 'chore(<dir>): release v<version> [<mode>]',
  },
} satisfies VulcanConfig;
