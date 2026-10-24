import { describe, expect, test } from 'bun:test';

import {
  assertEveryPackageClaimed,
  deriveInstallRows,
  findDuplicateCopies,
  findLockMismatches,
  INSTALL_CLAIMS,
  isCodeSubpath,
  listPackageDirectories,
  peerIdentityHolders,
} from '../clean-install/manifest';

const TARBALL = '/tmp/ci/tarballs/kernel/venizia-ardor-kernel-0.1.1-3.tgz';
const tarballs = new Map([['@venizia/ardor-kernel', TARBALL]]);

describe('clean-install manifest', () => {
  test('every published workspace package has a claim', () => {
    expect(() =>
      assertEveryPackageClaimed({ claims: INSTALL_CLAIMS, directories: listPackageDirectories() }),
    ).not.toThrow();
  });

  test('a published package without a claim is refused', () => {
    expect(() =>
      assertEveryPackageClaimed({
        claims: INSTALL_CLAIMS.filter(claim => claim.package !== 'react'),
        directories: listPackageDirectories(),
      }),
    ).toThrow(/@venizia\/ardor-react.*no claim/);
  });

  test('rows come from the exports maps, patterns and JSON skipped', () => {
    const specifiers = deriveInstallRows({ claims: INSTALL_CLAIMS }).map(row => row.specifier);

    expect(specifiers).toContain('@venizia/ardor-kernel/repository');
    expect(specifiers).toContain('@venizia/ardor/socket-io');
    expect(specifiers.some(specifier => specifier.endsWith('package.json'))).toBe(false);
    expect(isCodeSubpath('./styles/*')).toBe(false);
  });

  test('a grant naming an undeclared peer is refused', () => {
    expect(() =>
      deriveInstallRows({ claims: [{ package: 'react', requires: { '.': ['left-pad'] } }] }),
    ).toThrow(/left-pad.*not a declared peer/);
  });

  test('a grant naming an unpublished sub-path is refused', () => {
    expect(() =>
      deriveInstallRows({
        claims: [{ package: 'kernel', requires: { './gone': ['socket.io-client'] } }],
      }),
    ).toThrow(/does not publish/);
  });
});

describe('findLockMismatches', () => {
  test('a tarball resolution passes', () => {
    const lock = `"@venizia/ardor-kernel": ["@venizia/ardor-kernel@${TARBALL}", {}],`;

    expect(findLockMismatches({ lock, tarballs, sandboxed: '@venizia/ardor-kernel' })).toEqual([]);
  });

  test('a registry copy with the same version is caught', () => {
    const lock = `"@venizia/ardor-kernel": ["@venizia/ardor-kernel@0.1.1-3", "", {}],`;

    expect(findLockMismatches({ lock, tarballs, sandboxed: '@venizia/ardor-kernel' })).toEqual([
      "@venizia/ardor-kernel resolves to '0.1.1-3', not the packed tarball",
    ]);
  });

  test('a nested registry copy is caught too', () => {
    const lock = [
      `"@venizia/ardor-kernel": ["@venizia/ardor-kernel@${TARBALL}", {}],`,
      `"@venizia/ardor-react/@venizia/ardor-kernel": ["@venizia/ardor-kernel@0.1.1-3", "", {}],`,
    ].join('\n');

    expect(findLockMismatches({ lock, tarballs, sandboxed: '@venizia/ardor-react' })).toHaveLength(
      1,
    );
  });

  test('the sandboxed package missing from the lock is caught', () => {
    expect(findLockMismatches({ lock: '', tarballs, sandboxed: '@venizia/ardor-kernel' })).toEqual([
      '@venizia/ardor-kernel is missing from the lock',
    ]);
  });
});

describe('findDuplicateCopies', () => {
  const lock = (opts: { entries: Record<string, string> }): string => {
    const body = Object.entries(opts.entries)
      .map(([key, spec]) => `    "${key}": ["${spec}", {}, "sha512-x"],`)
      .join('\n');
    return `{\n  "lockfileVersion": 1,\n  "packages": {\n${body}\n  }\n}`;
  };

  test('one version of each package passes', () => {
    const text = lock({
      entries: {
        'ra-core': 'ra-core@5.15.4',
        react: 'react@19.3.1',
        lodash: 'lodash@4.18.1',
      },
    });

    expect(findDuplicateCopies({ lock: text })).toEqual([]);
  });

  test('a nested second copy of an identity package is reported with both versions', () => {
    const text = lock({
      entries: {
        'ra-core': 'ra-core@5.15.0',
        'ra-i18n-polyglot/ra-core': 'ra-core@5.15.4',
        'ra-i18n-polyglot': 'ra-i18n-polyglot@5.15.4',
      },
    });

    expect(findDuplicateCopies({ lock: text })).toEqual(['ra-core resolves to 5.15.0 and 5.15.4']);
  });

  test('two copies of a package that carries no identity are fine', () => {
    const text = lock({
      entries: { lodash: 'lodash@4.18.1', 'some/lodash': 'lodash@4.17.21' },
    });

    expect(findDuplicateCopies({ lock: text })).toEqual([]);
  });

  test('scoped IGNIS packages count, and a packed tarball is one copy however many keys name it', () => {
    const text = lock({
      entries: {
        '@venizia/ignis-inversion': '@venizia/ignis-inversion@0.2.2-5',
        'a/@venizia/ignis-inversion': '@venizia/ignis-inversion@0.2.2-4',
        '@venizia/ardor-kernel': '@venizia/ardor-kernel@/tmp/x/venizia-ardor-kernel-0.1.4-5.tgz',
        'b/@venizia/ardor-kernel': '@venizia/ardor-kernel@/tmp/x/venizia-ardor-kernel-0.1.4-5.tgz',
      },
    });

    expect(findDuplicateCopies({ lock: text })).toEqual([
      '@venizia/ignis-inversion resolves to 0.2.2-4 and 0.2.2-5',
    ]);
  });
});

describe('peerIdentityHolders', () => {
  test('is the package and the ARDOR packages it depends on, transitively', () => {
    expect(peerIdentityHolders({ name: '@venizia/ardor' }).sort()).toEqual([
      '@venizia/ardor',
      '@venizia/ardor-admin',
      '@venizia/ardor-kernel',
      '@venizia/ardor-react',
    ]);
    expect(peerIdentityHolders({ name: '@venizia/ardor-kernel' })).toEqual([
      '@venizia/ardor-kernel',
    ]);
  });
});
