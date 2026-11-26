import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeScratch } from '../../scratch';
import type { TGh } from '../github-release';
import { GithubRelease, GithubReleaseConstants } from '../github-release';
import { MergeBackConstants, ReleaseMergeBack } from '../merge-back';
import { ReleaseNotes } from '../release-notes';
import { captureConsole } from './console-capture';

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const scratch = (): string => {
  const root = makeScratch({ prefix: 'github-release-test-' });

  roots.push(root);

  return root;
};

const git = (opts: { cwd: string; args: string[] }): string =>
  ReleaseMergeBack.mustGit({ cwd: opts.cwd, args: [...MergeBackConstants.IDENTITY, ...opts.args] });

const PATTERN = '<dir>-v<version>';
const ALL = ['kernel', 'react', 'admin', 'ardor'];

const entry = (opts: { title: string; body: string }): string =>
  `---\ntitle: "${opts.title}"\npackages: ['@x/ardor']\n---\n\n# Changelog - 2026-10-20\n\n## ${opts.title}\n\n${opts.body}\n`;

const commit = (opts: { root: string; message: string; files?: Record<string, string> }): void => {
  for (const [path, text] of Object.entries(opts.files ?? {})) {
    mkdirSync(dirname(join(opts.root, path)), { recursive: true });
    writeFileSync(join(opts.root, path), text);
  }

  git({ cwd: opts.root, args: ['add', '-A'] });
  git({ cwd: opts.root, args: ['commit', '-q', '--allow-empty', '-m', opts.message] });
};

const tag = (opts: { root: string; name: string }): void => {
  git({ cwd: opts.root, args: ['tag', '-a', opts.name, '-m', opts.name] });
};

/** The four packages of a run, each tagged at the commit where the run stands. */
const tagRun = (opts: { root: string; version: string; dirs?: string[] }): void => {
  for (const dir of opts.dirs ?? ALL) {
    tag({ root: opts.root, name: `${dir}-v${opts.version}` });
  }
};

/**
 * 0.4.5 (stable) holds one old entry; 0.4.6-0 adds entry b; 0.4.6-1 adds entry c, a commit with no issue and the four
 * release commits; 0.4.6 (stable) adds nothing. Every tag of a run sits on its last commit.
 */
const fixture = (): string => {
  const root = scratch();

  git({ cwd: root, args: ['init', '-q', '-b', 'develop'] });
  commit({
    root,
    message: '[#1] feat(a): the first',
    files: {
      '.agents/vulcan.manifest.json': `${JSON.stringify({
        release: { tagPattern: PATTERN, ignoreTags: [] },
        knowledge: { changelogs: 'docs/changelogs' },
        packages: [
          { name: '@x/kernel', dir: 'kernel', retired: false },
          { name: '@x/react', dir: 'react', retired: false },
          { name: '@x/admin', dir: 'admin', retired: false },
          { name: '@x/ardor', dir: 'ardor', retired: false },
          { name: '@x/ui-kit', dir: 'ui-kit', retired: true },
        ],
      })}\n`,
      'docs/changelogs/2026-10-01-old.md': entry({ title: 'Old change', body: 'Before 0.4.5.' }),
      'docs/changelogs/index.md': '# index\n',
    },
  });
  tagRun({ root, version: '0.4.5' });
  commit({
    root,
    message: '[#10] feat(b): second change',
    files: {
      'docs/changelogs/2026-10-20-b.md': entry({
        title: 'ARDOR X.Y.Z: change b is described',
        body: 'B body line.',
      }),
    },
  });
  commit({ root, message: '[#12] chore(kernel): release v0.4.6-0 [0.4.6-0]' });
  tagRun({ root, version: '0.4.6-0' });
  commit({
    root,
    message: '[#11] fix(c): third change',
    files: {
      'docs/changelogs/2026-10-25-c.md': entry({ title: 'Change C', body: 'C body line.' }),
    },
  });
  commit({ root, message: 'chore: housekeeping with no issue' });
  commit({ root, message: '[#12] chore(ardor): release v0.4.6-1 [0.4.6-1]' });
  tagRun({ root, version: '0.4.6-1' });
  commit({ root, message: '[#13] chore(ardor): release v0.4.6 [0.4.6]' });
  tagRun({ root, version: '0.4.6' });
  tag({ root, name: 'atlas-index' });

  return root;
};

interface IStubGh {
  gh: TGh;
  calls: string[][];
  /** The notes file of the last create, read while it still existed. */
  notes: () => string;
  created: () => string[];
  /** The files the last create attached, by name, read while they still existed. */
  assets: () => Record<string, string>;
}

/** A stand-in for `gh`: records every call, and reads the notes file while it still exists. */
const stubGh = (opts: {
  existing?: boolean;
  createFails?: boolean;
  tagMissing?: boolean;
  tagLookupFails?: boolean;
}): IStubGh => {
  const calls: string[][] = [];
  let notes = '';
  let assets: Record<string, string> = {};

  return {
    calls,
    notes: () => notes,
    assets: () => assets,
    created: () => calls.find((call) => call[1] === 'create') ?? [],
    gh: ({ args }) => {
      calls.push(args);

      if (args[0] === 'api') {
        if (opts.tagLookupFails === true) {
          return {
            status: 1,
            stdout: '',
            stderr: 'HTTP 403: Resource not accessible by integration',
          };
        }

        return opts.tagMissing === true
          ? { status: 1, stdout: '', stderr: 'HTTP 404' }
          : { status: 0, stdout: '', stderr: '' };
      }

      if (args[1] === 'view') {
        return { status: opts.existing === true ? 0 : 1, stdout: '', stderr: 'release not found' };
      }

      notes = readFileSync(args[args.indexOf('--notes-file') + 1] ?? '', 'utf8');
      assets = Object.fromEntries(
        args
          .slice(3, args.indexOf('--title'))
          .map((file) => [file.split('/').pop() ?? '', readFileSync(file, 'utf8')]),
      );

      return opts.createFails === true
        ? { status: 1, stdout: '', stderr: 'HTTP 422: tag does not exist' }
        : { status: 0, stdout: `https://github.com/x/y/releases/tag/${args[2]}\n`, stderr: '' };
    },
  };
};

const make = (opts: {
  root: string;
  kind: string;
  version: string;
  stub: IStubGh;
  dirs?: string[];
  dryRun?: boolean;
}) =>
  GithubRelease.create({
    cwd: opts.root,
    kind: opts.kind,
    version: opts.version,
    dirs: opts.dirs ?? ALL,
    gh: opts.stub.gh,
    scratchRoot: scratch(),
    dryRun: opts.dryRun,
  });

describe('GithubRelease: tags and versions', () => {
  const tags = [
    'ardor-v0.4.5',
    'ardor-v0.4.6-0',
    'ardor-v0.4.6-1',
    'ardor-v0.4.6',
    'kernel-v0.4.6',
    'ardor-v0.4.10-0',
    'atlas-index',
  ];

  test('a tag names a version for its own package only', () => {
    expect(
      GithubRelease.versionOfTag({ tag: 'ardor-v0.4.6-1', pattern: PATTERN, dir: 'ardor' }),
    ).toBe('0.4.6-1');
    expect(
      GithubRelease.versionOfTag({ tag: 'kernel-v0.4.6', pattern: PATTERN, dir: 'ardor' }),
    ).toBeUndefined();
    expect(
      GithubRelease.versionOfTag({ tag: 'atlas-index', pattern: PATTERN, dir: 'ardor' }),
    ).toBeUndefined();
    expect(
      GithubRelease.versionOfTag({ tag: 'ardor-vnext', pattern: PATTERN, dir: 'ardor' }),
    ).toBeUndefined();
  });

  test('the previous tag of a stable is the highest stable below it; of a prerelease, the highest of any kind', () => {
    const base = { tags, pattern: PATTERN, dir: 'ardor' };

    expect(GithubRelease.previousTag({ ...base, version: '0.4.6', stableOnly: true })).toBe(
      'ardor-v0.4.5',
    );
    expect(GithubRelease.previousTag({ ...base, version: '0.4.6-1', stableOnly: false })).toBe(
      'ardor-v0.4.6-0',
    );
    expect(
      GithubRelease.previousTag({ ...base, version: '0.4.5', stableOnly: true }),
    ).toBeUndefined();
    // Numbers compare as numbers: 0.4.10-0 is above 0.4.6, not below.
    expect(GithubRelease.previousTag({ ...base, version: '0.4.10', stableOnly: false })).toBe(
      'ardor-v0.4.10-0',
    );
  });

  test('a release is Latest only when no higher stable tag exists', () => {
    const base = { tags, pattern: PATTERN, dir: 'ardor' };

    expect(GithubRelease.isNewestStable({ ...base, version: '0.4.6' })).toBe(true);
    expect(GithubRelease.isNewestStable({ ...base, version: '0.4.5' })).toBe(false);
  });
});

describe('GithubRelease.stripEntry', () => {
  test('removes the front matter, the date heading and the ARDOR X.Y.Z prefix of the heading', () => {
    const stripped = GithubRelease.stripEntry({
      text: entry({ title: 'ARDOR X.Y.Z: change b is described', body: 'Body.' }),
    });

    expect(stripped).toBe('## Change b is described\n\nBody.');
    expect(
      GithubRelease.stripEntry({ text: entry({ title: 'ARDOR 0.4.0: a title', body: 'x' }) }),
    ).toContain('## A title');
    // A heading with no colon is not a prefixed one: it stays.
    expect(
      GithubRelease.stripEntry({
        text: entry({ title: 'ARDOR 0.4.1 follows IGNIS 0.4.1', body: 'x' }),
      }),
    ).toContain('## ARDOR 0.4.1 follows IGNIS 0.4.1');
  });
});

describe('GithubRelease.create: a stable', () => {
  test('is Latest, titled ARDOR <version>, with the entries added since the previous stable', () => {
    const root = fixture();
    const stub = stubGh({});
    const outcome = make({ root, kind: 'stable', version: '0.4.6', stub });

    expect(outcome.state).toBe('created');
    expect(stub.created()).toEqual([
      'release',
      'create',
      'ardor-v0.4.6',
      '--title',
      'ARDOR 0.4.6',
      '--notes-file',
      expect.any(String),
      '--verify-tag',
      '--latest',
    ]);
    // Entries b and c were added after 0.4.5; the old one and index.md were not.
    expect(stub.notes()).toContain('## Change b is described');
    expect(stub.notes()).toContain('B body line.');
    expect(stub.notes()).toContain('C body line.');
    expect(stub.notes()).not.toContain('Before 0.4.5.');
    expect(stub.notes()).not.toContain('# index');
    expect(stub.notes()).not.toContain('Changelog - 2026');
    expect(stub.notes()).toContain(
      '- [@x/ardor@0.4.6](https://www.npmjs.com/package/@x/ardor/v/0.4.6)',
    );
  });

  test('a stable with no entry since the previous stable says there is no change for users', () => {
    const root = fixture();
    const stub = stubGh({});

    // 0.4.6 adds no entry after 0.4.6-1, but the entries since 0.4.5 count; use a stable whose range has none.
    commit({ root, message: '[#20] chore(ardor): release v0.4.7 [0.4.7]' });
    tagRun({ root, version: '0.4.7' });

    const outcome = make({ root, kind: 'stable', version: '0.4.7', stub });

    expect(outcome.state).toBe('created');
    expect(stub.notes()).toContain(ReleaseNotes.NO_USER_CHANGES);
  });

  test('an older stable is not Latest when a higher stable tag exists', () => {
    const root = fixture();
    const stub = stubGh({});
    const outcome = make({ root, kind: 'stable', version: '0.4.5', stub, dryRun: true });

    expect(outcome.state).toBe('planned');
    expect(outcome.message).toContain('ardor-v0.4.5 (stable, not Latest)');
  });

  test('a stable with a higher stable tag is created with --latest=false', () => {
    const root = fixture();
    const stub = stubGh({});

    make({ root, kind: 'stable', version: '0.4.5', stub });
    expect(stub.created()).toContain('--latest=false');
    expect(stub.created()).not.toContain('--prerelease');
  });
});

describe('GithubRelease.create: a prerelease makes no Release', () => {
  test('a prerelease is skipped: exit 0, and gh is never asked', () => {
    const root = fixture();
    const stub = stubGh({});
    const outcome = make({ root, kind: 'prerelease', version: '0.4.6-1', stub });

    expect(outcome.state).toBe('skipped');
    expect(outcome.message).toContain('only a stable has a GitHub Release');
    expect(stub.calls).toEqual([]);
    const printed = captureConsole(() =>
      GithubRelease.main({
        args: [
          'create',
          '--version',
          '0.4.6-1',
          '--kind',
          'prerelease',
          '--packages',
          ALL.join(','),
        ],
        env: { RUNNER_TEMP: scratch() },
        cwd: root,
        gh: stub.gh,
      }),
    );

    expect(printed.value).toBe(0);
    expect(printed.out).toEqual([
      expect.stringContaining('github-release: skipped - 0.4.6-1 is a prerelease'),
    ]);
    expect(printed.err).toEqual([]);
    expect(stub.calls).toEqual([]);
  });
});

/** The four live packages of the fixture manifest, in release order: the set a version folder belongs to. */
const SET = ['@x/kernel', '@x/react', '@x/admin', '@x/ardor'];
const REAL_LOG = readFileSync(
  join(import.meta.dir, '..', '..', '..', 'docs/wiki/content/changelogs/0.4.7/log.md'),
  'utf8',
);

/** The fixture with a stable 0.4.7 whose release commit holds the version folder `docs/changelogs/0.4.7/`. */
const folderFixture = (opts: { log?: string; migration?: string; dirs?: string[] }): string => {
  const root = fixture();

  commit({
    root,
    message: '[#20] chore(ardor): release v0.4.7 [0.4.7]',
    files: {
      'docs/changelogs/0.4.7/log.md': opts.log ?? REAL_LOG,
      ...(opts.migration === undefined
        ? {}
        : { 'docs/changelogs/0.4.7/migration.yaml': opts.migration }),
    },
  });
  tagRun({ root, version: '0.4.7', dirs: opts.dirs });

  return root;
};

describe('GithubRelease.create: a stable with a version folder', () => {
  test('the notes are the body of the real 0.4.7 log.md, then the packages of the set', () => {
    const root = folderFixture({});
    const stub = stubGh({});
    const outcome = make({ root, kind: 'stable', version: '0.4.7', stub });

    expect(outcome.state).toBe('created');
    expect(stub.notes()).toBe(
      ReleaseNotes.notesOf({ log: REAL_LOG, names: SET, version: '0.4.7' }),
    );
    expect(stub.notes().startsWith('ARDOR 0.4.7 moves utility functions')).toBe(true);
    expect(stub.notes()).not.toContain('released: 2026-11-03');
    // The dated entries of the fixture are not read for a version that has a folder.
    expect(stub.notes()).not.toContain('B body line.');
    expect(stub.created()).toEqual([
      'release',
      'create',
      'ardor-v0.4.7',
      '--title',
      'ARDOR 0.4.7',
      '--notes-file',
      expect.any(String),
      '--verify-tag',
      '--latest',
    ]);
  });

  test('a log.md with nothing but its frontmatter says there is no change for users', () => {
    const stub = stubGh({});

    make({
      root: folderFixture({ log: '---\ntitle: 0.4.7\nversion: 0.4.7\n---\n' }),
      kind: 'stable',
      version: '0.4.7',
      stub,
    });
    expect(stub.notes()).toBe(ReleaseNotes.notesOf({ log: '', names: SET, version: '0.4.7' }));
    expect(stub.notes().startsWith(ReleaseNotes.NO_USER_CHANGES)).toBe(true);
  });

  test('migration.yaml with a block is attached as migration-<version>.yaml', () => {
    const migration = 'an-item:\n  symbols: [A]\n';
    const stub = stubGh({});

    make({ root: folderFixture({ migration }), kind: 'stable', version: '0.4.7', stub });

    expect((stub.created()[3] ?? '').endsWith('/migration-0.4.7.yaml')).toBe(true);
    expect(stub.created()[4]).toBe('--title');
    expect(stub.assets()).toEqual({ 'migration-0.4.7.yaml': migration });
  });

  test('no asset when migration.yaml is absent, empty or {}', () => {
    for (const migration of [undefined, '', '{}\n']) {
      const stub = stubGh({});

      make({ root: folderFixture({ migration }), kind: 'stable', version: '0.4.7', stub });
      expect(stub.created()[3]).toBe('--title');
      expect(stub.assets()).toEqual({});
    }
  });

  test('a dry run names the folder and the asset, and creates nothing', () => {
    const stub = stubGh({});
    const outcome = make({
      root: folderFixture({ migration: 'an-item:\n  symbols: [A]\n' }),
      kind: 'stable',
      version: '0.4.7',
      stub,
      dryRun: true,
    });

    expect(outcome.state).toBe('planned');
    expect(outcome.message).toContain('notes from docs/changelogs/0.4.7/log.md');
    expect(outcome.message).toContain('migration-0.4.7.yaml attached');
    expect(stub.created()).toEqual([]);
  });

  test('a Release made on another package than the umbrella does not read the folder', () => {
    const stub = stubGh({});

    make({
      root: folderFixture({ dirs: ['kernel', 'react'] }),
      kind: 'stable',
      version: '0.4.7',
      stub,
      dirs: ['kernel', 'react'],
    });
    expect(stub.created()).toContain('react-v0.4.7');
    expect(stub.notes()).not.toContain('ARDOR 0.4.7 moves utility functions');
    expect(stub.assets()).toEqual({});
  });
});

describe('GithubRelease.create: what it refuses, skips or reports', () => {
  test('refuses a kind that is not stable or prerelease', () => {
    const outcome = make({ root: fixture(), kind: 'nightly', version: '0.4.6', stub: stubGh({}) });

    expect(outcome.state).toBe('refused');
  });

  test('refuses a package that is not a live package of the manifest, a retired one included', () => {
    for (const dirs of [['kernel', 'nope'], ['ui-kit'], []]) {
      const stub = stubGh({});
      const outcome = make({ root: fixture(), kind: 'stable', version: '0.4.6', stub, dirs });

      expect(outcome.state).toBe('refused');
      expect(stub.calls).toEqual([]);
    }
  });

  test('never makes the release of the atlas index', () => {
    const root = fixture();
    const stub = stubGh({});

    // A manifest whose pattern is the tag of the atlas index would make this tag; the script refuses it.
    const manifestPath = join(root, GithubReleaseConstants.MANIFEST);

    writeFileSync(
      manifestPath,
      readFileSync(manifestPath, 'utf8').replace('<dir>-v<version>', 'atlas-index'),
    );

    const outcome = make({ root, kind: 'stable', version: '0.4.6', stub });

    expect(outcome.state).toBe('refused');
    expect(outcome.message).toContain('atlas index');
    expect(stub.created()).toEqual([]);
  });

  test('skips a tag that already has a Release', () => {
    const stub = stubGh({ existing: true });
    const outcome = make({ root: fixture(), kind: 'stable', version: '0.4.6', stub });

    expect(outcome.state).toBe('exists');
    expect(stub.created()).toEqual([]);
  });

  test('skips, without failing, a tag the run did not make', () => {
    const stub = stubGh({ tagMissing: true });
    const outcome = make({ root: fixture(), kind: 'stable', version: '0.4.6', stub });

    expect(outcome.state).toBe('skipped');
    expect(stub.created()).toEqual([]);
  });

  test('reports a gh failure as a failed outcome, not as a throw', () => {
    const outcome = make({
      root: fixture(),
      kind: 'stable',
      version: '0.4.6',
      stub: stubGh({ createFails: true }),
    });

    expect(outcome.state).toBe('failed');
    expect(outcome.message).toContain('HTTP 422');
  });

  test('reports a repository it cannot read as a failed outcome', () => {
    const outcome = make({ root: scratch(), kind: 'stable', version: '0.4.6', stub: stubGh({}) });

    expect(outcome.state).toBe('failed');
  });

  test('a dry run shows the notes and creates nothing', () => {
    const stub = stubGh({});
    const outcome = make({ root: fixture(), kind: 'stable', version: '0.4.6', stub, dryRun: true });

    expect(outcome.state).toBe('planned');
    expect(outcome.message).toContain('ardor-v0.4.6 (stable, Latest)');
    expect(outcome.message).toContain('B body line.');
    expect(stub.created()).toEqual([]);
  });
});

describe('GithubRelease.main', () => {
  test('exits 2 with the usage when a flag is missing or the command is unknown', () => {
    for (const args of [['create', '--version', '0.4.6'], ['nope'], []]) {
      const root = fixture();
      const printed = captureConsole(() =>
        GithubRelease.main({ args, env: {}, cwd: root, gh: stubGh({}).gh }),
      );

      expect(printed.value).toBe(2);
      expect(printed.out).toEqual([]);
      expect(printed.err).toEqual([GithubReleaseConstants.USAGE]);
    }
  });

  test('exits 0 on a created Release and writes the run summary', () => {
    const root = fixture();
    const summary = join(scratch(), 'summary.md');

    writeFileSync(summary, '');

    const printed = captureConsole(() =>
      GithubRelease.main({
        args: ['create', '--version', '0.4.6', '--kind', 'stable', '--packages', ALL.join(',')],
        env: { GITHUB_STEP_SUMMARY: summary, RUNNER_TEMP: scratch() },
        cwd: root,
        gh: stubGh({}).gh,
      }),
    );

    expect(printed.value).toBe(0);
    expect(printed.out).toEqual([
      expect.stringContaining('github-release: created - ardor-v0.4.6: https://github.com/'),
    ]);
    expect(printed.err).toEqual([]);
    expect(readFileSync(summary, 'utf8')).toContain('- created: ardor-v0.4.6');
  });

  test('exits 1 on a failure and 0 on a skip', () => {
    const base = {
      args: ['create', '--version', '0.4.6', '--kind', 'stable', '--packages', ALL.join(',')],
      env: { RUNNER_TEMP: scratch() },
      cwd: fixture(),
    };

    const run = (stub: ReturnType<typeof stubGh>) =>
      captureConsole(() => GithubRelease.main({ ...base, gh: stub.gh }));
    const failed = run(stubGh({ createFails: true }));
    const skipped = run(stubGh({ tagMissing: true }));
    const existing = run(stubGh({ existing: true }));

    expect([failed.value, skipped.value, existing.value]).toEqual([1, 0, 0]);
    expect(failed.out).toEqual([
      expect.stringContaining('github-release: failed - gh release create ardor-v0.4.6: HTTP 422'),
    ]);
    expect(skipped.out).toEqual([
      expect.stringContaining('github-release: skipped - ardor-v0.4.6 is not on the remote'),
    ]);
    expect(existing.out).toEqual([
      expect.stringContaining('github-release: exists - ardor-v0.4.6 already has a Release'),
    ]);
    expect([...failed.err, ...skipped.err, ...existing.err]).toEqual([]);
  });
});

describe('GithubRelease.create: the findings of the security review', () => {
  test("Latest is the repository's: a stable run that does not end in the umbrella never takes it", () => {
    const root = fixture();

    commit({ root, message: '[#40] chore(react): release v0.4.8 [0.4.8]' });
    tagRun({ root, version: '0.4.8', dirs: ['kernel', 'react'] });

    const stub = stubGh({});
    const outcome = make({
      root,
      kind: 'stable',
      version: '0.4.8',
      stub,
      dirs: ['kernel', 'react'],
    });

    expect(outcome.state).toBe('created');
    expect(stub.created()).toContain('react-v0.4.8');
    expect(stub.created()).toContain('--latest=false');
    expect(stub.created()).not.toContain('--latest');
  });

  test('a tag lookup that fails for another reason than a 404 is a failure, not a quiet skip', () => {
    const outcome = make({
      root: fixture(),
      kind: 'stable',
      version: '0.4.6',
      stub: stubGh({ tagLookupFails: true }),
    });

    expect(outcome.state).toBe('failed');
    expect(outcome.message).toContain('HTTP 403');
  });

  test('refuses a version that is not plain semver before any gh call', () => {
    for (const version of ['0.4.7/../../x', '0.4', '0.4.6+build', '', "1$&$'x", 'v0.4.6']) {
      const stub = stubGh({});
      const outcome = make({ root: fixture(), kind: 'stable', version, stub });

      expect(outcome.state).toBe('refused');
      expect(stub.calls).toEqual([]);
    }
  });

  test('a stray tag cannot make a comparison throw: it names no version', () => {
    const root = fixture();

    for (const name of ['ardor-v9zzz', 'ardor-v0.4.6.1', 'ardor-v99.0.0+x', 'ardor-v00.4.6']) {
      tag({ root, name });
    }

    const stub = stubGh({});
    const outcome = make({ root, kind: 'stable', version: '0.4.6', stub });

    expect(outcome.state).toBe('created');
    expect(stub.created()).toContain('--latest');
    expect(stub.notes()).toContain('B body line.');
  });

  test('tagOf takes a value as text, not as a replacement pattern', () => {
    expect(GithubRelease.tagOf({ pattern: PATTERN, dir: 'ardor', version: "1$&$'x" })).toBe(
      "ardor-v1$&$'x",
    );
  });

  test('the notes of a stable that would not fit GitHub are cut with a closing line', () => {
    const root = fixture();

    commit({
      root,
      message: '[#50] feat(a): a very long entry',
      files: {
        'docs/changelogs/2026-10-29-long.md': entry({
          title: 'Long',
          body: 'word '.repeat(40_000),
        }),
      },
    });
    commit({ root, message: '[#51] chore(ardor): release v0.4.7 [0.4.7]' });
    tagRun({ root, version: '0.4.7' });

    const stub = stubGh({});

    make({ root, kind: 'stable', version: '0.4.7', stub });
    expect(stub.notes().length).toBeLessThan(120_000);
    expect(stub.notes()).toContain('... the notes are cut here');
    expect(stub.notes()).toContain('## Packages');
  });

  test('a dry run prints its notes indented, so no line of them can be a runner command', () => {
    const root = fixture();

    commit({
      root,
      message: '[#60] feat(a): a command-like entry',
      files: {
        'docs/changelogs/2026-10-30-cmd.md': entry({ title: 'Cmd', body: '::error::forged' }),
      },
    });
    commit({ root, message: '[#61] chore(ardor): release v0.4.7 [0.4.7]' });
    tagRun({ root, version: '0.4.7' });

    const lines: string[] = [];
    const original = console.log;

    console.log = (message: string) => {
      lines.push(message);
    };

    try {
      GithubRelease.main({
        args: [
          'create',
          '--version',
          '0.4.7',
          '--kind',
          'stable',
          '--packages',
          ALL.join(','),
          '--dry-run',
        ],
        env: {},
        cwd: root,
        gh: stubGh({}).gh,
      });
    } finally {
      console.log = original;
    }

    expect(
      lines
        .join('\n')
        .split('\n')
        .some((line) => line.startsWith('::')),
    ).toBe(false);
    expect(lines.join('\n')).toContain('  ::error::forged');
  });
});
