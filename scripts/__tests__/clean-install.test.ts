import { describe, expect, test } from 'bun:test';

import {
  assertEveryPackageClaimed,
  deriveInstallRows,
  findLockMismatches,
  INSTALL_CLAIMS,
  isCodeSubpath,
  listPackageDirectories,
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
