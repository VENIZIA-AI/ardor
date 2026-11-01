import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { WikiBuild } from '../../../docs/wiki/scripts/check-build.mts';

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const HOME =
  '<footer class="vh site-footer"><canvas class="dust"></canvas></footer><canvas class="dust"></canvas>';

describe('WikiBuild: what a build that exits 0 can hide', () => {
  // one line per pattern, so each pattern must be the one that catches its line
  test.each([
    ['a ReferenceError', 'ReferenceError: matchMedia is not defined'],
    ['a TypeError or SyntaxError', 'TypeError: x.map is not a function'],
    ['a TypeError or SyntaxError', 'SyntaxError: Unexpected token'],
    ['"is not defined"', 'window is not defined'],
    ['a Vue warning', '[Vue warn]: Unhandled error during execution of setup function'],
    ['a hydration message', 'Hydration completed but contains mismatches'],
  ])('a build log line with %s is a problem', (name, line) => {
    const log = ['- rendering pages...', line, 'build complete in 5s.'].join('\n');
    const problems = WikiBuild.scanLog({ log });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
  });

  test('a clean build log has no problem', () => {
    expect(
      WikiBuild.scanLog({ log: '- building client + server bundles...\nbuild complete in 5s.' }),
    ).toEqual([]);
  });

  test('the home page needs its footer and two canvases', () => {
    expect(WikiBuild.scanHome({ html: HOME })).toEqual([]);
    expect(WikiBuild.scanHome({ html: '<div class="vh"></div>' })).toHaveLength(2);
    expect(
      WikiBuild.scanHome({ html: '<footer class="vh site-footer"></footer><canvas></canvas>' }),
    ).toHaveLength(1);
    expect(WikiBuild.scanHome({ html: '<footer class="vh site-footer"></footer>' })).toHaveLength(
      1,
    );
    expect(WikiBuild.scanHome({ html: '<canvas></canvas><canvas></canvas>' })).toHaveLength(1);
  });

  test('an inner page must have no footer', () => {
    expect(WikiBuild.scanInner({ html: '<main></main>', page: 'references/index.html' })).toEqual(
      [],
    );
    expect(WikiBuild.scanInner({ html: HOME, page: 'references/index.html' })).toHaveLength(1);
  });

  test('a built site is checked as a whole', () => {
    const dist = mkdtempSync(join(tmpdir(), 'wiki-dist-'));

    roots.push(dist);
    mkdirSync(join(dist, 'references'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), HOME);
    writeFileSync(join(dist, 'references', 'index.html'), '<main></main>');
    expect(WikiBuild.check({ dist, log: '' })).toEqual([]);

    // what the server render of the old useDust left behind: an error in the log, no footer, no canvases
    writeFileSync(join(dist, 'index.html'), '<div class="vh"></div>');
    // one problem from the log, two from the home page
    expect(
      WikiBuild.check({ dist, log: 'ReferenceError: matchMedia is not defined' }),
    ).toHaveLength(3);
    expect(WikiBuild.check({ dist: join(dist, 'missing'), log: '' })).toHaveLength(1);

    // a site with no inner page to look at is not sound either: it must not be skipped silently
    rmSync(join(dist, 'references'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), HOME);
    expect(WikiBuild.check({ dist, log: '' })).toHaveLength(1);
  });
});
