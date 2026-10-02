import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

/** A repository whose `umbrella` package has one release commit. */
const released = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'release-scope-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');
  write(root, 'packages/umbrella/src/index.ts', 'export {};\n');
  write(root, 'packages/umbrella/README.md', '# umbrella\n');
  write(root, 'packages/umbrella/tsconfig.build.json', '{}\n');
  write(root, 'packages/umbrella/package.json', '{ "version": "1.0.0" }\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'chore(umbrella): release v1.0.0 [patch]');
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
    commit(root, 'packages/umbrella/tsconfig.build.json', '{ "compilerOptions": {} }\n');

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
        state({ packageName: '@venizia/ardor-ui-kit', changedFiles: 0 }),
      ],
    });

    expect(plan.map(s => s.packageName)).toEqual([
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
