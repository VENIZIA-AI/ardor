import { expect, test } from 'bun:test';

import { strays, type TManifest } from '../catalog-scope';

const CASES: Array<{ name: string; manifest: TManifest; expected: string[] }> = [
  {
    name: 'catalog:, workspace: and one exact version pass',
    manifest: {
      dependencies: { '@venizia/ardor-kernel': 'workspace:*' },
      devDependencies: { '@venizia/ignis-helpers': 'catalog:', '@venizia/vulcan': '0.4.10-9' },
    },
    expected: [],
  },
  {
    name: 'a devDependency the catalog does not list, written as a range',
    manifest: { devDependencies: { '@venizia/ignis-worker': '^0.4.8-7' } },
    expected: ['@venizia/ignis-worker is "^0.4.8-7"'],
  },
  {
    name: 'a dependency written as a range',
    manifest: { dependencies: { '@venizia/ignis-filter': '^0.4.7-4' } },
    expected: ['@venizia/ignis-filter is "^0.4.7-4"'],
  },
  {
    name: 'peers and other scopes are not read',
    manifest: {
      peerDependencies: { '@venizia/ignis-helpers': '^0.4.8-6' },
      dependencies: { react: '^19.0.0' },
    },
    expected: [],
  },
  { name: 'a manifest with no dependencies', manifest: {}, expected: [] },
];

for (const { name, manifest, expected } of CASES) {
  test(name, () => {
    expect(strays({ manifest })).toEqual(expected);
  });
}
