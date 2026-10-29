import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeScratch } from '../../scratch';
import { MergeBackConstants, ReleaseMergeBack } from '../merge-back';

// merge-back.test.ts is VULCAN's, copied with the script. These tests are ARDOR's: the four packages of a
// run, each named in `--versions`, the way the plan and the chain call the trial.

const roots: string[] = [];
const PACKAGES = ['kernel', 'react', 'admin', 'ardor'] as const;

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const run = (opts: { cwd: string; args: string[] }): string =>
  ReleaseMergeBack.mustGit({ cwd: opts.cwd, args: [...MergeBackConstants.IDENTITY, ...opts.args] });

const write = (opts: { root: string; path: string; text: string }): void => {
  mkdirSync(dirname(join(opts.root, opts.path)), { recursive: true });
  writeFileSync(join(opts.root, opts.path), opts.text);
};

/** The four packages at `version`, siblings by `workspace:*`, the lockfile regenerated, committed. */
const release = (opts: { root: string; version: string; message: string }): void => {
  PACKAGES.forEach((name, index) => {
    const dependencies = Object.fromEntries(
      PACKAGES.slice(0, index).map((sibling) => [`@fixture/ardor-${sibling}`, 'workspace:*']),
    );

    write({
      root: opts.root,
      path: `packages/${name}/package.json`,
      text: `${JSON.stringify({ name: `@fixture/ardor-${name}`, version: opts.version, dependencies }, null, 2)}\n`,
    });
  });

  const install = Bun.spawnSync(['bun', 'install', '--lockfile-only'], {
    cwd: opts.root,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (install.exitCode !== 0) {
    throw new Error(`bun install --lockfile-only: ${install.stderr.toString()}`);
  }

  run({ cwd: opts.root, args: ['add', '-A'] });
  run({ cwd: opts.root, args: ['commit', '-q', '-m', opts.message] });
};

/** main and develop after a Sync at 0.4.9-1; develop then published `developVersion`. */
const fixture = (opts: { developVersion: string }): string => {
  const root = makeScratch({ prefix: 'merge-back-ardor-' });

  roots.push(root);
  run({ cwd: root, args: ['init', '-q', '-b', 'main'] });
  write({
    root,
    path: 'package.json',
    text: `${JSON.stringify({ name: 'fixture', private: true, workspaces: ['packages/*'] }, null, 2)}\n`,
  });
  release({ root, version: '0.4.9-1', message: 'sync' });
  run({ cwd: root, args: ['branch', 'develop'] });
  run({ cwd: root, args: ['checkout', '-q', 'develop'] });
  release({ root, version: opts.developVersion, message: 'develop publishes' });
  run({ cwd: root, args: ['checkout', '-q', 'main'] });

  return root;
};

const allAt = (version: string): Record<string, string> =>
  Object.fromEntries(PACKAGES.map((name) => [name, version]));

describe('ReleaseMergeBack.trial for the four ARDOR packages', () => {
  test('a stable over a prerelease published on develop goes through: four version conflicts, the lock regenerated', () => {
    const root = fixture({ developVersion: '0.4.10-0' });
    const result = ReleaseMergeBack.trial({
      cwd: root,
      versions: allAt('0.4.9'),
      main: 'main',
      develop: 'develop',
      scratchRoot: makeScratch({ prefix: 'merge-back-ardor-scratch-' }),
    });

    expect(result.problems).toEqual([]);
    expect(result.resolved.sort()).toEqual(
      PACKAGES.map((name) => `packages/${name}/package.json`).sort(),
    );
    expect(result.lockRegenerated).toBe(true);
    expect(run({ cwd: root, args: ['worktree', 'list'] }).split('\n')).toHaveLength(1);
  });

  test('a directory outside the four is named and nothing is merged', () => {
    const root = fixture({ developVersion: '0.4.10-0' });
    const result = ReleaseMergeBack.trial({
      cwd: root,
      versions: { ...allAt('0.4.9'), cli: '0.4.9' },
      main: 'main',
      develop: 'develop',
      scratchRoot: makeScratch({ prefix: 'merge-back-ardor-scratch-' }),
    });

    expect(result.problems.join('\n')).toContain('cli');
    expect(result.resolved).toEqual([]);
  });

  test('the scratch folder the script uses by default is inside this repository, never the system temp folder', () => {
    expect(MergeBackConstants.SCRATCH_ROOT.endsWith('.agents/local/tmp')).toBe(true);
    expect(MergeBackConstants.SCRATCH_ROOT.startsWith('/tmp')).toBe(false);
  });
});
