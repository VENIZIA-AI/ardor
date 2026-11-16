import { afterAll, describe, expect, spyOn, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeScratch } from '../../scratch';
import { ReleaseStamp } from '../stamp-release';

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const LOG = 'docs/changelogs/0.4.9/log.md';

/** A checkout with the manifest and, unless `log` is undefined, the 0.4.9 folder. */
const checkout = (opts: { log?: string }): string => {
  const root = makeScratch({ prefix: 'stamp-release-test-' });
  const files: Record<string, string> = {
    '.agents/vulcan.manifest.json': `${JSON.stringify({
      release: { tagPattern: '<dir>-v<version>' },
      knowledge: { changelogs: 'docs/changelogs', migrationFrom: '0.4.5' },
      packages: [{ name: '@x/ardor', dir: 'ardor', retired: false }],
    })}\n`,
    ...(opts.log === undefined ? {} : { [LOG]: opts.log }),
  };

  roots.push(root);

  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  return root;
};

/** Runs the CLI and keeps what it printed. */
const stamp = (opts: {
  cwd: string;
  args: string[];
}): { code: number; out: string; err: string } => {
  const out: string[] = [];
  const err: string[] = [];
  const log = spyOn(console, 'log').mockImplementation((line: string) => {
    out.push(line);
  });
  const error = spyOn(console, 'error').mockImplementation((line: string) => {
    err.push(line);
  });

  try {
    return { code: ReleaseStamp.main(opts), out: out.join('\n'), err: err.join('\n') };
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
};

const FRESH = '---\ntitle: 0.4.9\nversion: 0.4.9\n---\nBody.\n';

describe('stamp-release.ts: released: in the version folder of a stable', () => {
  test('writes released: as the last frontmatter line and prints the repository-relative path', () => {
    const root = checkout({ log: FRESH });
    const result = stamp({ cwd: root, args: ['--version', '0.4.9', '--date', '2026-11-20'] });

    expect(result).toEqual({ code: 0, out: LOG, err: '' });
    expect(readFileSync(join(root, LOG), 'utf8')).toBe(
      '---\ntitle: 0.4.9\nversion: 0.4.9\nreleased: 2026-11-20\n---\nBody.\n',
    );
  });

  test('the same date again changes nothing and still prints the path; another date is refused', () => {
    const root = checkout({ log: FRESH });

    stamp({ cwd: root, args: ['--version', '0.4.9', '--date', '2026-11-20'] });

    const stamped = readFileSync(join(root, LOG), 'utf8');

    expect(stamp({ cwd: root, args: ['--version', '0.4.9', '--date', '2026-11-20'] })).toEqual({
      code: 0,
      out: LOG,
      err: '',
    });

    const refused = stamp({ cwd: root, args: ['--version', '0.4.9', '--date', '2026-11-21'] });

    expect(refused.code).toBe(1);
    expect(refused.err).toContain('already says released: 2026-11-20');
    expect(readFileSync(join(root, LOG), 'utf8')).toBe(stamped);
  });

  test('a log.md with no frontmatter is refused and left as it was', () => {
    const root = checkout({ log: 'Body only.\n' });
    const result = stamp({ cwd: root, args: ['--version', '0.4.9', '--date', '2026-11-20'] });

    expect(result.code).toBe(1);
    expect(result.err).toContain('no frontmatter');
    expect(readFileSync(join(root, LOG), 'utf8')).toBe('Body only.\n');
  });

  test('no folder for the version: nothing written, nothing printed, exit 0', () => {
    expect(
      stamp({ cwd: checkout({}), args: ['--version', '0.4.9', '--date', '2026-11-20'] }),
    ).toEqual({ code: 0, out: '', err: '' });
  });

  test('a version that is not X.Y.Z or a date that is not YYYY-MM-DD is a usage error: no path is made from it', () => {
    const root = checkout({ log: FRESH });

    for (const args of [
      ['--version', '../0.4.9', '--date', '2026-11-20'],
      ['--version', '0.4.9-1', '--date', '2026-11-20'],
      ['--version', '0.4.9', '--date', '20 Nov'],
      ['--version', '0.4.9'],
      [],
    ]) {
      expect(stamp({ cwd: root, args }).code).toBe(2);
    }

    expect(readFileSync(join(root, LOG), 'utf8')).toBe(FRESH);
  });
});
