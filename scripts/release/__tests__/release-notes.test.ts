import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ReleaseNotes } from '../release-notes';

const ROOT = join(import.meta.dir, '..', '..', '..');
const CHANGELOGS = join(ROOT, 'docs/wiki/content/changelogs');
const NAMES = [
  '@venizia/ardor-kernel',
  '@venizia/ardor-react',
  '@venizia/ardor-admin',
  '@venizia/ardor',
];
const FOLDERS = ['0.4.5', '0.4.6', '0.4.7', '0.4.8'];

const readIf = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

describe('ReleaseNotes: the notes of a version folder', () => {
  test('the notes of a real released folder (0.4.7) are its log.md body, then the four packages', () => {
    const log = readFileSync(join(CHANGELOGS, '0.4.7/log.md'), 'utf8');
    const notes = ReleaseNotes.notesOf({ log, names: NAMES, version: '0.4.7' });

    expect(log).toContain('released: 2026-11-03');
    expect(notes.startsWith('ARDOR 0.4.7 moves utility functions onto classes')).toBe(true);
    expect(notes).not.toContain('released:');
    expect(notes).not.toContain('title: 0.4.7');
    expect(notes).toContain('\n## Breaking\n');
    expect(
      notes.endsWith(
        '- [@venizia/ardor@0.4.7](https://www.npmjs.com/package/@venizia/ardor/v/0.4.7)\n',
      ),
    ).toBe(true);
    expect(notes).toContain(
      '\n\n## Packages\n\n- [@venizia/ardor-kernel@0.4.7](https://www.npmjs.com/package/@venizia/ardor-kernel/v/0.4.7)\n',
    );
  });

  test('a log.md with no body says there is no change for users', () => {
    const notes = ReleaseNotes.notesOf({
      log: '---\ntitle: 0.4.9\nversion: 0.4.9\n---\n\n',
      names: ['@x/a'],
      version: '0.4.9',
    });

    expect(notes).toBe(
      `${ReleaseNotes.NO_USER_CHANGES}\n\n## Packages\n\n- [@x/a@0.4.9](https://www.npmjs.com/package/@x/a/v/0.4.9)\n`,
    );
  });

  test('a migration.yaml holds a block unless it is absent, empty or {}', () => {
    expect(ReleaseNotes.hasBlocks({ migration: undefined })).toBe(false);
    expect(ReleaseNotes.hasBlocks({ migration: '' })).toBe(false);
    expect(ReleaseNotes.hasBlocks({ migration: '  \n' })).toBe(false);
    expect(ReleaseNotes.hasBlocks({ migration: '{}\n' })).toBe(false);
    expect(ReleaseNotes.hasBlocks({ migration: 'an-item:\n  symbols: [A]\n' })).toBe(true);
    // A file that does not parse ships, and the changelog gate is where it fails.
    expect(ReleaseNotes.hasBlocks({ migration: 'a: [\n' })).toBe(true);
    expect(
      ReleaseNotes.hasBlocks({ migration: readIf(join(CHANGELOGS, '0.4.7/migration.yaml')) }),
    ).toBe(true);
  });
});

/** The installed VULCAN, run from this checkout: `undefined` when it cannot run. */
const vulcan = (args: string[]): { status: number; stdout: string } | undefined => {
  const child = Bun.spawnSync(['bun', 'x', '--no-install', 'vulcan', ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return child.exitCode === 0 || child.stdout.toString() !== ''
    ? { status: child.exitCode, stdout: child.stdout.toString() }
    : undefined;
};

const vulcanRuns = vulcan(['changelog', 'notes', '--version', '0.4.7']) !== undefined;

if (!vulcanRuns) {
  // The parity checks below need the VULCAN this repository pins; without it they are skipped, not passed.
  process.stderr.write(
    'release-notes.test.ts: `bun x --no-install vulcan changelog notes` does not run here - the parity tests are skipped\n',
  );
}

describe.skipIf(!vulcanRuns)('ReleaseNotes agrees with `vulcan changelog notes`', () => {
  test('the notes of 0.4.7 are byte for byte what the command prints', () => {
    const printed = vulcan(['changelog', 'notes', '--version', '0.4.7']);
    const log = readFileSync(join(CHANGELOGS, '0.4.7/log.md'), 'utf8');

    expect(printed?.status).toBe(0);
    expect(ReleaseNotes.notesOf({ log, names: NAMES, version: '0.4.7' })).toBe(
      printed?.stdout ?? '',
    );
  });

  test('every folder: the same notes, and the same decision on the migration file', () => {
    for (const version of FOLDERS) {
      const log = readFileSync(join(CHANGELOGS, version, 'log.md'), 'utf8');
      const migration = readIf(join(CHANGELOGS, version, 'migration.yaml'));
      const notes = vulcan(['changelog', 'notes', '--version', version]);
      const attached = vulcan(['changelog', 'notes', '--version', version, '--migration']);

      expect(ReleaseNotes.notesOf({ log, names: NAMES, version })).toBe(notes?.stdout ?? '');
      expect(ReleaseNotes.hasBlocks({ migration })).toBe((attached?.stdout.trim() ?? '') !== '');
    }
  });
});
