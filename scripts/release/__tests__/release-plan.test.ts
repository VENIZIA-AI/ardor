import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { makeScratch } from '../../scratch';
import { ReleasePlan } from '../release-plan';

const ROOT = resolve(import.meta.dir, '..', '..', '..');

const at = (version: string) =>
  ReleasePlan.ORDER.map((name) => ({ name: name as string, localVersion: version }));

describe('ReleasePlan.validate', () => {
  test('the whole order and an in-order selection pass', () => {
    expect(() =>
      ReleasePlan.validate({ packages: ['kernel', 'react', 'admin', 'ardor'] }),
    ).not.toThrow();
    expect(() => ReleasePlan.validate({ packages: ['react', 'ardor'] })).not.toThrow();
    expect(() => ReleasePlan.validate({ packages: ['ardor'] })).not.toThrow();
  });

  test('an empty plan fails', () => {
    expect(() => ReleasePlan.validate({ packages: [] })).toThrow('the plan is empty');
  });

  test('an unknown package fails and is named', () => {
    expect(() => ReleasePlan.validate({ packages: ['kernel', 'ui-kit'] })).toThrow(
      'unknown package(s): ui-kit',
    );
  });

  test('a repeated package fails', () => {
    expect(() => ReleasePlan.validate({ packages: ['kernel', 'kernel', 'react'] })).toThrow(
      'repeated package(s): kernel',
    );
  });

  test('a package out of dependency order fails', () => {
    expect(() => ReleasePlan.validate({ packages: ['ardor', 'kernel'] })).toThrow(
      'not in dependency order',
    );
    expect(() => ReleasePlan.validate({ packages: ['react', 'kernel', 'admin'] })).toThrow(
      'not in dependency order',
    );
  });
});

describe('ReleasePlan.increment', () => {
  // The expected versions are what `npm version <mode> --no-git-tag-version` prints for each current
  // version; they are listed by hand here so the test does not run npm.
  const cases: Array<[current: string, mode: string, expected: string]> = [
    ['0.4.5', 'patch', '0.4.6'],
    ['0.4.5', 'minor', '0.5.0'],
    ['0.4.5', 'major', '1.0.0'],
    ['0.4.5', 'prerelease', '0.4.6-0'],
    ['0.4.5', 'prepatch', '0.4.6-0'],
    ['0.4.5', 'preminor', '0.5.0-0'],
    ['0.4.5', 'premajor', '1.0.0-0'],
    ['0.4.8-3', 'prerelease', '0.4.8-4'],
    ['0.4.8-3', 'patch', '0.4.8'],
    ['0.4.8-3', 'minor', '0.5.0'],
    ['0.4.8-3', 'major', '1.0.0'],
    ['0.4.8-3', 'prepatch', '0.4.9-0'],
    ['0.4.8-9', 'prerelease', '0.4.8-10'],
    ['0.4.0-3', 'minor', '0.4.0'],
    ['0.4.0-3', 'major', '1.0.0'],
    ['1.0.0-2', 'major', '1.0.0'],
    ['0.4.9-1', 'patch', '0.4.9'],
    ['0.4.8-beta', 'prerelease', '0.4.8-beta.0'],
  ];

  for (const [current, mode, expected] of cases) {
    test(`${current} + ${mode} gives ${expected}`, () => {
      expect(ReleasePlan.increment({ current, mode })).toBe(expected);
    });
  }

  test('the first prerelease after a stable ends in -0, the next ones count up', () => {
    const first = ReleasePlan.increment({ current: '0.4.8', mode: 'prerelease' });
    const second = ReleasePlan.increment({ current: first, mode: 'prerelease' });

    expect([first, second]).toEqual(['0.4.9-0', '0.4.9-1']);
  });

  test('0.4.8-2 sorts below 0.4.8-10, which sorts below 0.4.8', () => {
    expect(Bun.semver.order('0.4.8-2', '0.4.8-10')).toBe(-1);
    expect(Bun.semver.order('0.4.8-10', '0.4.8')).toBe(-1);
  });

  test('an unknown mode and a malformed version fail', () => {
    expect(() => ReleasePlan.increment({ current: '0.4.5', mode: 'banana' })).toThrow(
      'unknown mode',
    );
    expect(() => ReleasePlan.increment({ current: '0.4', mode: 'patch' })).toThrow('not a version');
    expect(() => ReleasePlan.increment({ current: '0.4.5+build', mode: 'patch' })).toThrow(
      'not a version',
    );
  });
});

describe('ReleasePlan.resolveVersion', () => {
  test('a mode over four packages at one version gives one version and the whole plan', () => {
    const run = ReleasePlan.resolveVersion({ target: 'prerelease', packages: at('0.4.5') });

    expect(run).toEqual({
      version: '0.4.6-0',
      plan: ['kernel', 'react', 'admin', 'ardor'],
      skipped: [],
    });
  });

  test('a mode over packages at different versions fails and names them and --version', () => {
    const packages = at('0.4.5');
    packages[0] = { name: 'kernel', localVersion: '0.4.6-0' };

    expect(() => ReleasePlan.resolveVersion({ target: 'patch', packages })).toThrow(
      'kernel 0.4.6-0, react 0.4.5, admin 0.4.5, ardor 0.4.5',
    );
    expect(() => ReleasePlan.resolveVersion({ target: 'patch', packages })).toThrow('--version');
  });

  test('an explicit version plans the packages below it and skips the ones at it', () => {
    const packages = at('0.4.5');
    packages[0] = { name: 'kernel', localVersion: '0.4.6-0' };
    packages[1] = { name: 'react', localVersion: '0.4.6-0' };

    expect(ReleasePlan.resolveVersion({ target: '0.4.6-0', packages })).toEqual({
      version: '0.4.6-0',
      plan: ['admin', 'ardor'],
      skipped: ['kernel', 'react'],
    });
  });

  test('an explicit version below a package fails', () => {
    const packages = at('0.4.5');
    packages[3] = { name: 'ardor', localVersion: '0.5.0' };

    expect(() => ReleasePlan.resolveVersion({ target: '0.4.6', packages })).toThrow(
      'ardor is at 0.5.0, above 0.4.6',
    );
  });

  test('a plan out of order fails before any version is read', () => {
    expect(() =>
      ReleasePlan.resolveVersion({
        target: 'patch',
        packages: [
          { name: 'ardor', localVersion: '0.4.5' },
          { name: 'kernel', localVersion: '0.4.5' },
        ],
      }),
    ).toThrow('not in dependency order');
  });
});

describe('ReleasePlan.dispatch', () => {
  test('a plan gives one dispatch of the workflow on develop', () => {
    const dispatch = ReleasePlan.dispatch({
      plan: ['kernel', 'react', 'admin', 'ardor'],
      version: '0.4.6-0',
    });

    expect(dispatch).toEqual({
      workflow: 'package-release.yml',
      ref: 'develop',
      inputs: { packages: 'kernel,react,admin,ardor', version: '0.4.6-0' },
    });
  });

  test('the argument list sends exactly one gh workflow run, with the ref and each input', () => {
    const dispatch = ReleasePlan.dispatch({
      plan: ['admin', 'ardor'],
      version: '0.4.6-0',
      issue: '412',
    });

    expect(ReleasePlan.dispatchArgs({ dispatch })).toEqual([
      'gh',
      'workflow',
      'run',
      'package-release.yml',
      '--ref',
      'develop',
      '-f',
      'packages=admin,ardor',
      '-f',
      'version=0.4.6-0',
      '-f',
      'issue=412',
    ]);
  });

  test('describe prints the one dispatch', () => {
    const dispatch = ReleasePlan.dispatch({ plan: ['kernel', 'react'], version: '0.4.6' });

    expect(ReleasePlan.describe({ dispatch })).toBe(
      '1 dispatch of package-release.yml on develop: packages=kernel,react version=0.4.6',
    );
  });

  test('a plan that is not valid is not dispatched', () => {
    expect(() => ReleasePlan.dispatch({ plan: ['react', 'kernel'], version: '0.4.6' })).toThrow(
      'not in dependency order',
    );
  });
});

describe('release.ts', () => {
  test('importing it releases nothing and prints nothing', () => {
    const proc = Bun.spawnSync(
      ['bun', '-e', `await import(${JSON.stringify(join(ROOT, 'scripts/release/release.ts'))})`],
      { cwd: ROOT },
    );

    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toBe('');
    expect(proc.stderr.toString()).toBe('');
  });
});

describe('ReleasePlan.resolveFromManifests', () => {
  const scratch = (versions: Record<string, string>): string => {
    const root = makeScratch({ prefix: 'release-plan-' });
    for (const [name, version] of Object.entries(versions)) {
      mkdirSync(join(root, 'packages', name), { recursive: true });
      writeFileSync(join(root, 'packages', name, 'package.json'), JSON.stringify({ version }));
    }
    scratches.push(root);

    return root;
  };
  const scratches: string[] = [];
  const all = (version: string) => ({
    kernel: version,
    react: version,
    admin: version,
    ardor: version,
  });

  afterAll(() => {
    for (const root of scratches) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a mode over four packages at one version gives the one version', () => {
    const root = scratch(all('0.4.5'));

    expect(
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'kernel,react,admin,ardor', '--version', '', '--mode', 'prerelease'],
      }),
    ).toBe('0.4.6-0');
  });

  test('a mode over packages at different versions fails and names --version', () => {
    const root = scratch({ ...all('0.4.5'), kernel: '0.4.6-0' });

    expect(() =>
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'kernel,react,admin,ardor', '--mode', 'patch'],
      }),
    ).toThrow('--version');
  });

  test('an explicit version is the version, and a package above it fails', () => {
    const root = scratch({ ...all('0.4.5'), ardor: '0.5.0' });

    expect(
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'kernel,react', '--version', '0.4.6'],
      }),
    ).toBe('0.4.6');
    expect(() =>
      ReleasePlan.resolveFromManifests({
        root,
        argv: ['--packages', 'ardor', '--version', '0.4.6'],
      }),
    ).toThrow('ardor is at 0.5.0, above 0.4.6');
  });

  test('a list out of dependency order fails before any manifest is read', () => {
    expect(() =>
      ReleasePlan.resolveFromManifests({
        root: '/nowhere',
        argv: ['--packages', 'react,kernel', '--mode', 'patch'],
      }),
    ).toThrow('not in dependency order');
  });
});
