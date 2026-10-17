import type { VulcanConfig } from '@venizia/vulcan';

// ARDOR's project config for VULCAN (agent, knowledge and atlas tooling). VULCAN's surface and
// symbols tables read `atlas.packages`; its okf and release tables read no project config yet, so
// scripts/vulcan-bridge.ts runs ARDOR's own generators for those two.
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
    // Package directory -> npm name, in release order. Every key needs a directory under packages/,
    // so the retired `ui-kit` is not listed; scripts/atlas-releases.ts still labels its old changelogs.
    packages: {
      kernel: '@venizia/ardor-kernel',
      react: '@venizia/ardor-react',
      admin: '@venizia/ardor-admin',
      ardor: '@venizia/ardor',
    },
    // <package> is the `packages` key (the directory): @venizia/ardor-kernel@0.1.4-2 is kernel-v0.1.4-2.
    tagPattern: '<package>-v<version>',
  },
} satisfies VulcanConfig;
