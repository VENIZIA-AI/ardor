import type { VulcanConfig } from '@venizia/vulcan';

// ARDOR's project config for VULCAN (agent, knowledge and atlas tooling). okf, atlas, make and
// release all read the one `packages` list below.
export default {
  agents: ['claude'],

  // The base slot V-W-01: git writes happen only on the user's word (ARDOR's own W-01 agrees).
  rules: { 'V-W-01': 'on-user-word' },

  // Team-shared Claude settings that `vulcan sync` merges into `.claude/settings.json`. The two
  // plugins are off here by choice of the team, not a VULCAN default.
  claude: {
    settings: {
      enabledPlugins: {
        'figma@claude-plugins-official': false,
        'chrome-devtools-mcp@claude-plugins-official': false,
      },
    },
  },

  // In release order. `ui-kit` has no directory any more; retired, its tags and changelogs still resolve.
  packages: [
    { dir: 'kernel', name: '@venizia/ardor-kernel' },
    { dir: 'react', name: '@venizia/ardor-react' },
    { dir: 'admin', name: '@venizia/ardor-admin' },
    { dir: 'ardor', name: '@venizia/ardor' },
    { dir: 'ui-kit', name: '@venizia/ardor-ui-kit', retired: true },
  ],

  knowledge: {
    bundle: '.agents/knowledge',
    wiki: 'docs/wiki/content',
    changelogs: 'docs/wiki/content/changelogs',
    syncAreas: '.agents/knowledge/process/knowledge-sync-areas.md',
  },

  okf: {
    renderers: [
      'source-map',
      { id: 'providers', module: '.agents/okf/providers.ts' },
      { id: 'hooks-and-services', module: '.agents/okf/hooks-and-services.ts' },
      {
        id: 'binding-keys',
        options: {
          source: 'packages/kernel/src/common/keys.ts',
          description: 'Every dependency-injection binding key declared in the kernel (generated).',
          seeAlso: 'Namespaces: [binding key namespaces](/conventions/binding-key-namespaces.md).',
        },
      },
      'makefile-targets',
    ],
    regions: [
      { id: 'packages-table', file: 'overview/monorepo-layout.md', renderer: 'packages-table' },
    ],
    sections: {
      order: [
        'overview',
        'architecture',
        'packages',
        'conventions',
        'process',
        'examples',
        'reference',
      ],
    },
    coverage: [
      { name: 'packages', path: 'packages/*' },
      { name: 'examples', path: 'examples/*' },
    ],
  },

  atlas: {
    // Tags default to `<dir>-v<version>` and release commits to IGNIS's template; ARDOR uses both.
    // IGNIS's committed manifest on develop, so the atlas answers over the kernel ARDOR builds on.
    sources: [{ name: 'ignis', repo: 'VENIZIA-AI/ignis', ref: 'develop' }],
    // The prebuilt index of this repository is signed with the private key in the Actions secret ATLAS_INDEX_KEY;
    // this is its public half, which a reader that declares ARDOR as a source trusts (a key list, so a key can rotate).
    index: { keys: ['gqQ8Wtlk6KiZpnCDafb3deR/VqhW2aBaDqqnKJLblZc='] },
  },
} satisfies VulcanConfig;
