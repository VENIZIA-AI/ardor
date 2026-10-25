import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeScratch } from '../../scratch';

import { countChangedSinceRelease, withDependents } from '../release-scope';

const roots: string[] = [];

const git = (cwd: string, ...args: string[]) => {
  const proc = Bun.spawnSync(['git', ...args], { cwd });
  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString());
  }
};

const write = (root: string, path: string, content: string) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** A repository whose `name` package (`umbrella` by default) has one release commit. */
const released = (name = 'umbrella'): string => {
  const root = makeScratch({ prefix: 'release-scope-' });
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  write(root, `packages/${name}/src/index.ts`, 'export {};\n');
  write(root, `packages/${name}/README.md`, '# umbrella\n');
  write(root, `packages/${name}/tsconfig.json`, '{}\n');
  write(root, `packages/${name}/.configs/builders/tsconfig.build.json`, '{}\n');
  write(root, `packages/${name}/package.json`, '{ "version": "1.0.0" }\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', `chore(${name}): release v1.0.0 [patch]`);
  return root;
};

const commit = (root: string, path: string, content: string) => {
  write(root, path, content);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'change');
};

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('countChangedSinceRelease', () => {
  test('a package never released needs a release', () => {
    const root = released();

    expect(countChangedSinceRelease({ name: 'other', cwd: root })).toBe(Number.POSITIVE_INFINITY);
  });

  test('nothing changed since the release commit', () => {
    expect(countChangedSinceRelease({ name: 'umbrella', cwd: released() })).toBe(0);
  });

  // The umbrella case: its peers ship only through package.json, and it has no src change.
  test('a manifest-only change counts', () => {
    const root = released();
    commit(
      root,
      'packages/umbrella/package.json',
      '{ "version": "1.0.0", "peerDependencies": {} }\n',
    );

    expect(countChangedSinceRelease({ name: 'umbrella', cwd: root })).toBe(1);
  });

  test('a build config change counts', () => {
    const root = released();
    commit(
      root,
      'packages/umbrella/.configs/builders/tsconfig.build.json',
      '{ "compilerOptions": {} }\n',
    );

    expect(countChangedSinceRelease({ name: 'umbrella', cwd: root })).toBe(1);
  });

  test('a change to the root tsconfig the build extends counts', () => {
    const root = released();
    commit(root, 'packages/umbrella/tsconfig.json', '{ "compilerOptions": {} }\n');

    expect(countChangedSinceRelease({ name: 'umbrella', cwd: root })).toBe(1);
  });

  test('a source change counts, committed or not', () => {
    const root = released();
    commit(root, 'packages/umbrella/src/index.ts', 'export const a = 1;\n');
    write(root, 'packages/umbrella/src/extra.ts', 'export const b = 2;\n');

    expect(countChangedSinceRelease({ name: 'umbrella', cwd: root })).toBe(2);
  });

  test('a file that does not ship does not count', () => {
    const root = released();
    commit(root, 'packages/umbrella/README.md', '# umbrella, edited\n');

    expect(countChangedSinceRelease({ name: 'umbrella', cwd: root })).toBe(0);
  });
});

// The umbrella ships the VULCAN preset, which lives outside its package folder.
describe('countChangedSinceRelease: the preset of the umbrella', () => {
  test('a change under presets/ counts for ardor', () => {
    const root = released('ardor');
    commit(root, 'presets/app/files/.configs/builders/nginx.conf.template', 'server {}\n');

    expect(countChangedSinceRelease({ name: 'ardor', cwd: root })).toBe(1);
  });

  test('a change to the script that writes the preset counts for ardor', () => {
    const root = released('ardor');
    commit(root, 'scripts/preset/vulcan-preset.ts', 'export {};\n');

    expect(countChangedSinceRelease({ name: 'ardor', cwd: root })).toBe(1);
  });

  test('an uncommitted change under presets/ counts too', () => {
    const root = released('ardor');
    write(root, 'presets/lib/files/README.md', '# lib\n');

    expect(countChangedSinceRelease({ name: 'ardor', cwd: root })).toBe(1);
  });

  test('a change in the preset before the last ardor release does not count', () => {
    const root = released('ardor');
    commit(root, 'presets/app/files/Dockerfile', 'FROM scratch\n');
    write(root, 'packages/ardor/package.json', '{ "version": "1.0.1" }\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'chore(ardor): release v1.0.1 [patch]');

    expect(countChangedSinceRelease({ name: 'ardor', cwd: root })).toBe(0);
  });

  test('a change under presets/ counts for no other package', () => {
    const root = released();
    commit(root, 'presets/app/files/.configs/builders/nginx.conf.template', 'server {}\n');
    commit(root, 'scripts/preset/vulcan-preset.ts', 'export {};\n');

    expect(countChangedSinceRelease({ name: 'umbrella', cwd: root })).toBe(0);
  });

  test('the sweep lists ardor alone: the preset is a leaf nothing depends on', () => {
    const root = released('ardor');
    commit(root, 'presets/app/files/.configs/builders/nginx.conf.template', 'server {}\n');

    const plan = withDependents({
      states: [
        { packageName: '@venizia/ardor-kernel', changedFiles: 0, internalDependencies: [] },
        {
          packageName: '@venizia/ardor',
          changedFiles: countChangedSinceRelease({ name: 'ardor', cwd: root }),
          internalDependencies: ['@venizia/ardor-kernel'],
        },
      ],
    });

    expect(plan.map((s) => s.packageName)).toEqual(['@venizia/ardor']);
  });
});

// The 0.1.2-0 chain shipped kernel, admin and ardor but not react, whose `ardor-kernel: ^0.1.1`
// excludes the prerelease: a consumer got a second ardor-kernel@0.1.1 under ardor-react.
describe('withDependents', () => {
  const state = (opts: { packageName: string; changedFiles: number; deps?: string[] }) => ({
    packageName: opts.packageName,
    changedFiles: opts.changedFiles,
    internalDependencies: opts.deps ?? [],
  });

  test('releases an unchanged package whose dependency is released, transitively', () => {
    const plan = withDependents({
      states: [
        state({ packageName: '@venizia/ardor-kernel', changedFiles: 6 }),
        state({
          packageName: '@venizia/ardor-react',
          changedFiles: 0,
          deps: ['@venizia/ardor-kernel'],
        }),
        state({
          packageName: '@venizia/ardor-admin',
          changedFiles: 0,
          deps: ['@venizia/ardor-react'],
        }),
        state({ packageName: '@venizia/ardor-standalone', changedFiles: 0 }),
      ],
    });

    expect(plan.map((s) => s.packageName)).toEqual([
      '@venizia/ardor-kernel',
      '@venizia/ardor-react',
      '@venizia/ardor-admin',
    ]);
  });

  test('leaves a dependent alone when nothing it depends on is released', () => {
    const plan = withDependents({
      states: [
        state({ packageName: '@venizia/ardor-kernel', changedFiles: 0 }),
        state({
          packageName: '@venizia/ardor-react',
          changedFiles: 0,
          deps: ['@venizia/ardor-kernel'],
        }),
      ],
    });

    expect(plan).toEqual([]);
  });
});
