import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeScratch } from '../../scratch';
import {
  MergeBackConstants,
  ReleaseMergeBack,
  ReleaseStampConstants,
  ReleaseStampText,
} from '../merge-back';

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

const LOG_PATH = 'docs/changelogs/0.4.9/log.md';

/** A version folder `log.md`: the frontmatter lines given, then a body. */
const front = (...lines: string[]): string => `---\n${lines.join('\n')}\n---\nBody.\n`;

describe('ReleaseStampText: the released: line of a version folder', () => {
  test('stamped writes released: as the last frontmatter line and leaves the body alone', () => {
    expect(
      ReleaseStampText.stamped({
        text: front('title: 0.4.9', 'version: 0.4.9'),
        date: '2026-11-20',
      }),
    ).toBe(front('title: 0.4.9', 'version: 0.4.9', 'released: 2026-11-20'));
  });

  test('stamped keeps CRLF line endings', () => {
    expect(
      ReleaseStampText.stamped({
        text: '---\r\ntitle: 0.4.9\r\n---\r\nBody.\r\n',
        date: '2026-11-20',
      }),
    ).toBe('---\r\ntitle: 0.4.9\r\nreleased: 2026-11-20\r\n---\r\nBody.\r\n');
  });

  test('stamped is idempotent for the same date and refuses another date', () => {
    const dated = front('title: 0.4.9', 'released: 2026-11-20');

    expect(ReleaseStampText.stamped({ text: dated, date: '2026-11-20' })).toBeUndefined();
    expect(() => ReleaseStampText.stamped({ text: dated, date: '2026-11-21' })).toThrow(
      'already says released: 2026-11-20',
    );
  });

  test('stamped refuses a file with no frontmatter', () => {
    expect(() => ReleaseStampText.stamped({ text: 'Body only.\n', date: '2026-11-20' })).toThrow(
      'no frontmatter',
    );
  });

  test('the released: line is read on its own line only: an empty value does not take the next line', () => {
    expect(ReleaseStampConstants.RELEASED.source).toContain('[ \\t]*');
    expect(ReleaseStampText.releasedOf({ text: front('released:', 'version: 0.4.9') })).toBe(
      undefined,
    );
    expect(ReleaseStampText.releasedOf({ text: front('released:  2026-11-20 ') })).toBe(
      '2026-11-20',
    );
  });

  test('only the frontmatter is read: a released: line in the body is not a stamp', () => {
    const text = `${front('title: 0.4.9')}released: 2026-11-19\n`;

    expect(ReleaseStampText.releasedOf({ text })).toBeUndefined();
    expect(ReleaseStampText.stamped({ text, date: '2026-11-20' })).toContain(
      'title: 0.4.9\nreleased: 2026-11-20\n---',
    );
  });

  test('problemOf dry-runs the stamp: none for a fresh folder, the reason for a dated or bare one', () => {
    const fresh = front('title: 0.4.9');
    const dated = front('title: 0.4.9', 'released: 2026-11-20');
    const date = '2026-11-20';

    expect(ReleaseStampText.problemOf({ text: fresh, healing: false, date })).toBeUndefined();
    expect(ReleaseStampText.problemOf({ text: dated, healing: false, date })).toContain(
      'already says released',
    );
    expect(
      ReleaseStampText.problemOf({ text: dated, healing: false, date: '2026-11-21' }),
    ).toContain('already says released');
    expect(ReleaseStampText.problemOf({ text: 'Body.\n', healing: false, date })).toContain(
      'no frontmatter',
    );
    // An empty released: line is refused, not read as no date: the stamp would not overwrite it.
    expect(
      ReleaseStampText.problemOf({
        text: front('title: 0.4.9', 'released:'),
        healing: false,
        date,
      }),
    ).toContain('already says released');
    // A run that continues one which already made the stamped release commit accepts its date.
    expect(
      ReleaseStampText.problemOf({ text: dated, healing: true, date: '2026-11-21' }),
    ).toBeUndefined();
    expect(ReleaseStampText.problemOf({ text: 'Body.\n', healing: true, date })).toContain(
      'no frontmatter',
    );
  });
});

describe('ReleaseMergeBack.resolveStampConflict', () => {
  const resolveStamp = (opts: { base: string; ours: string; theirs: string }) =>
    ReleaseMergeBack.resolveStampConflict({
      ...opts,
      scratchRoot: makeScratch({ prefix: 'merge-back-ardor-scratch-' }),
    });
  const BASE = front('title: 0.4.9', "version: '0.4.9'");

  test('keeps the edit of develop and the released: line of the release', () => {
    expect(
      resolveStamp({
        base: BASE,
        ours: front('title: 0.4.9', 'version: 0.4.9'),
        theirs: front('title: 0.4.9', "version: '0.4.9'", 'released: 2026-11-20'),
      }),
    ).toEqual({ text: front('title: 0.4.9', 'version: 0.4.9', 'released: 2026-11-20') });
  });

  test('stops when other lines conflict, the base is released, neither side is, or the dates differ', () => {
    expect(
      resolveStamp({
        base: BASE,
        ours: front('title: 0.4.9', 'version: a'),
        theirs: front('title: 0.4.9', 'version: b', 'released: 2026-11-20'),
      }).problem,
    ).toContain('other lines conflict');
    expect(
      resolveStamp({ base: front('released: 2026-11-19'), ours: BASE, theirs: BASE }).problem,
    ).toContain('frozen');
    expect(resolveStamp({ base: BASE, ours: BASE, theirs: BASE }).problem).toContain('not a stamp');
    expect(
      resolveStamp({
        base: BASE,
        ours: front('title: 0.4.9', "version: '0.4.9'", 'released: 2026-11-19'),
        theirs: front('title: 0.4.9', "version: '0.4.9'", 'released: 2026-11-20'),
      }).problem,
    ).toContain('differently');
  });
});

describe('ReleaseMergeBack.mergeInto: the stamped log.md of a version folder', () => {
  /** main and develop share the folder; `release` holds the stable and the stamp; develop then edits the folder. */
  const prepared = (opts: { path?: string } = {}): string => {
    const path = opts.path ?? LOG_PATH;
    const root = fixture({ developVersion: '0.4.10-0' });

    write({ root, path, text: front('title: 0.4.9', "version: '0.4.9'") });
    run({ cwd: root, args: ['add', '-A'] });
    run({ cwd: root, args: ['commit', '-q', '-m', 'the folder'] });
    run({ cwd: root, args: ['checkout', '-q', 'develop'] });
    run({ cwd: root, args: ['merge', '-q', '--no-edit', 'main'] });
    run({ cwd: root, args: ['checkout', '-q', '-b', 'release', 'main'] });
    release({ root, version: '0.4.9', message: 'chore(ardor): release v0.4.9' });
    write({ root, path, text: front('title: 0.4.9', "version: '0.4.9'", 'released: 2026-11-20') });
    run({ cwd: root, args: ['commit', '-q', '-am', 'the stamp'] });
    run({ cwd: root, args: ['checkout', '-q', 'develop'] });
    write({ root, path, text: front('title: 0.4.9', 'version: 0.4.9') });
    run({ cwd: root, args: ['commit', '-q', '-am', 'develop edits the last frontmatter line'] });

    return root;
  };

  test('a conflict that is only the released: line is resolved, and the edit of develop stays', () => {
    const root = prepared();
    const result = ReleaseMergeBack.mergeInto({
      cwd: root,
      from: 'release',
      scratchRoot: makeScratch({ prefix: 'merge-back-ardor-scratch-' }),
      commit: { message: 'Merge main into develop' },
    });

    expect(result.problems).toEqual([]);
    expect(result.resolved).toContain(LOG_PATH);
    expect(readFileSync(join(root, LOG_PATH), 'utf8')).toBe(
      front('title: 0.4.9', 'version: 0.4.9', 'released: 2026-11-20'),
    );
  });

  test('only <X.Y.Z>/log.md goes through the resolver: another file of the same shape stops the merge', () => {
    const root = prepared({ path: 'docs/changelogs/0.4.9/notes.md' });
    const result = ReleaseMergeBack.mergeInto({
      cwd: root,
      from: 'release',
      scratchRoot: makeScratch({ prefix: 'merge-back-ardor-scratch-' }),
    });

    expect(result.problems.join('\n')).toContain('docs/changelogs/0.4.9/notes.md');
    expect(result.resolved).not.toContain('docs/changelogs/0.4.9/notes.md');
  });
});

describe('ReleaseMergeBack.trial: the stamp the release commit of ardor writes', () => {
  /** main and develop share the manifest and the 0.4.9 folder; `mainLog` is the folder on main. */
  const prepared = (opts: { mainLog?: string } = {}): string => {
    const root = fixture({ developVersion: '0.4.10-0' });

    write({
      root,
      path: '.agents/vulcan.manifest.json',
      text: '{"knowledge":{"changelogs":"docs/changelogs"}}\n',
    });
    write({ root, path: LOG_PATH, text: opts.mainLog ?? front('title: 0.4.9') });
    run({ cwd: root, args: ['add', '-A'] });
    run({ cwd: root, args: ['commit', '-q', '-m', 'the folder'] });
    run({ cwd: root, args: ['checkout', '-q', 'develop'] });
    run({ cwd: root, args: ['merge', '-q', '--no-edit', 'main'] });
    run({ cwd: root, args: ['checkout', '-q', 'main'] });

    return root;
  };
  const trial = (opts: { root: string; stampDate?: string }) =>
    ReleaseMergeBack.trial({
      cwd: opts.root,
      versions: allAt('0.4.9'),
      main: 'main',
      develop: 'develop',
      scratchRoot: makeScratch({ prefix: 'merge-back-ardor-scratch-' }),
      stampDate: opts.stampDate,
    });
  const onDevelop = (opts: { root: string; text: string }): void => {
    run({ cwd: opts.root, args: ['checkout', '-q', 'develop'] });
    write({ root: opts.root, path: LOG_PATH, text: opts.text });
    run({ cwd: opts.root, args: ['commit', '-q', '-am', 'develop changes the folder'] });
    run({ cwd: opts.root, args: ['checkout', '-q', 'main'] });
  };

  test('with a date the release commit carries the stamp, and a develop that dated the folder another day stops it', () => {
    const root = prepared();

    expect(trial({ root, stampDate: '2026-11-20' }).problems).toEqual([]);

    onDevelop({ root, text: front('title: 0.4.9', 'released: 2026-11-19') });
    expect(trial({ root, stampDate: '2026-11-20' }).problems.join('\n')).toContain('differently');
  });

  test('without a date (a run that does not make the release commit of ardor) the trial stamps nothing', () => {
    const root = prepared();

    onDevelop({ root, text: front('title: 0.4.9', 'released: 2026-11-19') });
    expect(trial({ root }).problems).toEqual([]);
  });

  test('a folder the stamp cannot be written into is a problem of the trial, not a crash', () => {
    expect(
      trial({ root: prepared({ mainLog: 'Body only.\n' }), stampDate: '2026-11-20' }).problems.join(
        '\n',
      ),
    ).toContain(`${LOG_PATH}: has no frontmatter`);
    expect(
      trial({
        root: prepared({ mainLog: front('title: 0.4.9', 'released: 2026-11-10') }),
        stampDate: '2026-11-20',
      }).problems.join('\n'),
    ).toContain('already says released: 2026-11-10');
  });
});

describe('merge-back.ts is copied alone to the runner', () => {
  const FILE = join(import.meta.dir, '..', 'merge-back.ts');

  test('it has no relative import', () => {
    expect(readFileSync(FILE, 'utf8')).not.toMatch(
      /^\s*(?:import|export)\b[^;]*\bfrom\s+['"]\.\.?\//m,
    );
  });

  test('a copy of it alone in an empty folder runs: usage, exit 2, not a missing module', () => {
    const directory = makeScratch({ prefix: 'merge-back-alone-' });

    roots.push(directory);
    writeFileSync(join(directory, 'merge-back.ts'), readFileSync(FILE, 'utf8'));

    const child = Bun.spawnSync(['bun', join(directory, 'merge-back.ts')], {
      cwd: directory,
      stdout: 'pipe',
      stderr: 'pipe',
      // The copy would make its default scratch folder two levels above itself.
      env: { ...process.env, RUNNER_TEMP: directory },
    });

    expect(child.stderr.toString()).not.toContain('Cannot find module');
    expect(child.stderr.toString()).toContain('merge-back: trial');
    expect(child.exitCode).toBe(2);
  });

  test('a copy of it alone resolves a stamped log.md in the merge back it applies', () => {
    const directory = makeScratch({ prefix: 'merge-back-alone-' });
    const root = fixture({ developVersion: '0.4.10-0' });

    roots.push(directory);
    write({ root, path: LOG_PATH, text: front('title: 0.4.9', "version: '0.4.9'") });
    run({ cwd: root, args: ['add', '-A'] });
    run({ cwd: root, args: ['commit', '-q', '-m', 'the folder'] });
    run({ cwd: root, args: ['checkout', '-q', 'develop'] });
    run({ cwd: root, args: ['merge', '-q', '--no-edit', 'main'] });
    write({ root, path: LOG_PATH, text: front('title: 0.4.9', 'version: 0.4.9') });
    run({ cwd: root, args: ['commit', '-q', '-am', 'develop edits the folder'] });
    run({ cwd: root, args: ['checkout', '-q', 'main'] });
    write({
      root,
      path: LOG_PATH,
      text: front('title: 0.4.9', "version: '0.4.9'", 'released: 2026-11-20'),
    });
    run({ cwd: root, args: ['commit', '-q', '-am', 'the stamp'] });
    run({ cwd: root, args: ['checkout', '-q', 'develop'] });
    writeFileSync(join(directory, 'merge-back.ts'), readFileSync(FILE, 'utf8'));

    const child = Bun.spawnSync(
      ['bun', join(directory, 'merge-back.ts'), 'apply', '--from', 'main', '--repo', root],
      {
        cwd: directory,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, RUNNER_TEMP: directory },
      },
    );

    expect(child.stderr.toString()).toBe('');
    expect(child.exitCode).toBe(0);
    expect(readFileSync(join(root, LOG_PATH), 'utf8')).toBe(
      front('title: 0.4.9', 'version: 0.4.9', 'released: 2026-11-20'),
    );
  });
});
