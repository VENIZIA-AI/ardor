import type { VulcanConfig } from '@venizia/vulcan';

export const knowledge = {
  bundle: '.agents/knowledge',
  wiki: 'docs/wiki/content',
  changelogs: 'docs/wiki/content/changelogs',
  // Version folders (changelogs/<X.Y.Z>/log.md and migration.yaml) are the changelog from 0.4.5 on; the dated files up to `datedUntil` are history.
  migrationFrom: '0.4.5',
  codemodCommand: ['ardor', 'codemod'],
  datedUntil: '2026-11-15',

  okf: {
    renderers: [
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
} satisfies VulcanConfig.Knowledge;
