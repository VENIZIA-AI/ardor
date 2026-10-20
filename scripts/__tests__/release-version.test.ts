import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  assertAbove,
  isReleaseVersion,
  npmTagFor,
  packagesForVersion,
  readReleaseArgs,
} from '../release-version';

const ROOT = resolve(import.meta.dir, '..', '..');

const cli = (...args: string[]) => {
  const proc = Bun.spawnSync(['bun', join(ROOT, 'scripts/release-version.ts'), ...args]);
  return { code: proc.exitCode, out: proc.stdout.toString().trim(), err: proc.stderr.toString() };
};

describe('readReleaseArgs', () => {
  test('no flag releases as a prerelease, the existing default', () => {
    expect(readReleaseArgs({ argv: [] }).target).toBe('prerelease');
  });

  test('--mode picks a bump', () => {
    expect(readReleaseArgs({ argv: ['--mode', 'patch'] }).target).toBe('patch');
  });

  test('--version picks an explicit version', () => {
    expect(readReleaseArgs({ argv: ['--version', '0.3.0'] }).target).toBe('0.3.0');
  });

  test('--version overrides --mode, in either order', () => {
    expect(readReleaseArgs({ argv: ['--mode', 'patch', '--version', '0.3.0'] }).target).toBe(
      '0.3.0',
    );
    expect(readReleaseArgs({ argv: ['--version', '0.3.0', '--mode', 'patch'] }).target).toBe(
      '0.3.0',
    );
  });

  test('an empty --version is unset: the mode applies', () => {
    expect(readReleaseArgs({ argv: ['--version', '', '--mode', 'minor'] }).target).toBe('minor');
  });

  test('the value of --version or --mode is never a package name', () => {
    const { positional } = readReleaseArgs({
      argv: ['kernel', '--version', '0.3.0', 'react', '--mode', 'patch', '--yes', '--dry-run'],
    });
    expect(positional).toEqual(['kernel', 'react']);
  });

  test('--issue is read, and its value is never a package name', () => {
    const read = readReleaseArgs({ argv: ['kernel', '--issue', '138', '--version', '0.3.1'] });
    expect(read.issue).toBe('138');
    expect(read.positional).toEqual(['kernel']);
  });

  test('no --issue, or an empty one, is unset', () => {
    expect(readReleaseArgs({ argv: [] }).issue).toBeUndefined();
    expect(readReleaseArgs({ argv: ['--issue', ''] }).issue).toBeUndefined();
  });

  test('an --issue that is not a number throws, naming it', () => {
    expect(() => readReleaseArgs({ argv: ['--issue', '#138'] })).toThrow('#138');
  });

  test('an unknown mode throws, naming it', () => {
    expect(() => readReleaseArgs({ argv: ['--mode', 'bogus'] })).toThrow('bogus');
  });

  test.each(['0.3', 'v0.3.0', '0.3.0.1', '03.0.0', 'latest', '0.3.0-'])(
    'a version that is not semver throws: %s',
    (version) => {
      expect(() => readReleaseArgs({ argv: ['--version', version] })).toThrow(version);
    },
  );

  test('a flag with no value throws', () => {
    expect(() => readReleaseArgs({ argv: ['--version'] })).toThrow('--version');
    expect(() => readReleaseArgs({ argv: ['--mode'] })).toThrow('--mode');
  });
});

describe('isReleaseVersion', () => {
  test.each(['0.3.0', '1.2.3', '0.3.0-0', '0.3.0-rc.1', '1.0.0-alpha.2+build.5'])(
    'accepts %s',
    (v) => {
      expect(isReleaseVersion({ value: v })).toBe(true);
    },
  );
});

describe('npmTagFor: a stable release is latest, a prerelease is next', () => {
  test.each(['patch', 'minor', 'major'])('mode %s -> latest', (mode) => {
    expect(npmTagFor({ target: mode })).toBe('latest');
  });

  test.each(['prepatch', 'preminor', 'premajor', 'prerelease'])('mode %s -> next', (mode) => {
    expect(npmTagFor({ target: mode })).toBe('next');
  });

  test('0.3.0 -> latest', () => {
    expect(npmTagFor({ target: '0.3.0' })).toBe('latest');
  });

  test.each(['0.3.0-0', '0.3.0-rc.1', '1.0.0-alpha.2'])('%s -> next', (version) => {
    expect(npmTagFor({ target: version })).toBe('next');
  });

  test('a target that is neither a mode nor a version throws', () => {
    expect(() => npmTagFor({ target: 'latest' })).toThrow('latest');
  });
});

describe('assertAbove', () => {
  test('0.3.0 is above 0.1.5', () => {
    expect(() => assertAbove({ version: '0.3.0', current: '0.1.5' })).not.toThrow();
  });

  test('a prerelease of the next minor is above the current stable', () => {
    expect(() => assertAbove({ version: '0.3.0-0', current: '0.2.0' })).not.toThrow();
  });

  test('the current version is not above itself', () => {
    expect(() => assertAbove({ version: '0.1.5', current: '0.1.5' })).toThrow('0.1.5');
  });

  test('a lower version throws, naming both', () => {
    expect(() => assertAbove({ version: '0.1.0', current: '0.1.5' })).toThrow('0.1.0');
  });

  test('a prerelease sorts below its release', () => {
    expect(() => assertAbove({ version: '0.3.0-1', current: '0.3.0' })).toThrow('0.3.0-1');
  });
});

describe('packagesForVersion: a shared version releases every package still below it', () => {
  const states = [
    { name: 'kernel', localVersion: '0.1.5' },
    { name: 'react', localVersion: '0.1.5' },
    { name: 'admin', localVersion: '0.3.0' },
    { name: 'ardor', localVersion: '0.1.5' },
  ];

  test('a package already at the version is left out, the order is kept', () => {
    expect(packagesForVersion({ states, version: '0.3.0' }).map((s) => s.name)).toEqual([
      'kernel',
      'react',
      'ardor',
    ]);
  });

  test('every package is included when none is at the version', () => {
    const all = states.map((s) => ({ ...s, localVersion: '0.1.5' }));
    expect(packagesForVersion({ states: all, version: '0.3.0' })).toHaveLength(4);
  });
});

describe('the command line the workflow calls', () => {
  test('target prints the version when one is given', () => {
    expect(
      cli('target', '--version', '0.3.0', '--mode', 'patch', '--current', '0.1.5'),
    ).toMatchObject({
      code: 0,
      out: '0.3.0',
    });
  });

  test('target prints the mode when the version is empty', () => {
    expect(cli('target', '--version', '', '--mode', 'patch', '--current', '0.1.5')).toMatchObject({
      code: 0,
      out: 'patch',
    });
  });

  test('target fails when the version is not above the current one', () => {
    const { code, err } = cli(
      'target',
      '--version',
      '0.1.5',
      '--mode',
      'patch',
      '--current',
      '0.1.5',
    );
    expect(code).not.toBe(0);
    expect(err).toContain('0.1.5');
  });

  test('target fails on a malformed version', () => {
    expect(cli('target', '--version', 'v0.3.0', '--mode', 'patch').code).not.toBe(0);
  });

  test('tag prints the dist-tag', () => {
    expect(cli('tag', '0.3.0').out).toBe('latest');
    expect(cli('tag', '0.3.0-1').out).toBe('next');
    expect(cli('tag', 'patch').out).toBe('latest');
    expect(cli('tag', 'prerelease').out).toBe('next');
  });
});

describe('package-release.yml uses the same module', () => {
  const workflow = readFileSync(join(ROOT, '.github/workflows/package-release.yml'), 'utf8');

  test('it declares an optional version input', () => {
    expect(workflow).toMatch(
      /version:\n\s+type: string\n\s+description:[^\n]*\n\s+required: false/,
    );
  });

  test('it resolves the target and the dist-tag through scripts/release-version.ts', () => {
    expect(workflow).toContain('scripts/release-version.ts target');
    expect(workflow).toContain('scripts/release-version.ts tag');
  });

  test('it bumps to the resolved target, not to build_mode', () => {
    expect(workflow).toContain('npm version $TARGET --no-git-tag-version');
    expect(workflow).not.toContain('npm version $BUILD_MODE');
  });

  test('it publishes under the resolved tag', () => {
    expect(workflow).toContain('--tag $NPM_TAG');
    expect(workflow).not.toContain('case $BUILD_MODE');
  });
});
