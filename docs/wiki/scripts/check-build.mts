/**
 * Builds the wiki and fails on what a build that exits 0 can hide. The same checks as VULCAN's
 * scripts/wiki-shared/build.ts, which is the canonical copy: keep the patterns and the page rules in step.
 *
 * VitePress renders every page on the server first. A component that touches `window`, `document` or
 * `matchMedia` while it sets up throws there; VitePress prints the error, drops that component from the
 * page and still exits 0, so the built home page lacks it and the browser reports a hydration mismatch.
 * This runs the build, then fails when:
 *
 *   - the build output holds an error of that kind (`ReferenceError`, `is not defined`, a Vue warning,
 *     a hydration message);
 *   - the built home page has no footer or fewer than two dust canvases (the hero and the footer draw
 *     one each);
 *   - a built inner page has a footer (inner pages have none).
 *
 * A hydration warning itself appears only in a browser; the server HTML checked here is its cause.
 *
 *   bun scripts/check-build.mts            build the wiki (vitepress build site) and check it
 *   bun scripts/check-build.mts --check    check the last build without building again
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WIKI = new URL('..', import.meta.url).pathname;
const DIST = join(WIKI, 'site', '.vitepress', 'dist');
const LOG_PATTERNS: [RegExp, string][] = [
  [/\bReferenceError\b/, 'a ReferenceError'],
  [/\b(TypeError|SyntaxError)\b/, 'a TypeError or SyntaxError'],
  [/is not defined/, '"is not defined"'],
  [/\[Vue warn\]/, 'a Vue warning'],
  [/hydration/i, 'a hydration message'],
];
/** Inner pages to look at, the first that was built: this wiki's own sections. */
const INNER_PAGES = ['references/index.html', 'guides/index.html', 'changelogs/index.html'];

export class WikiBuild {
  /** What the build printed that a successful build must not print, one problem per offending line. */
  static scanLog(opts: { log: string }): string[] {
    const problems: string[] = [];

    for (const line of opts.log.split('\n')) {
      const hit = LOG_PATTERNS.find(([pattern]) => pattern.test(line));

      if (hit) {
        problems.push(`the build printed ${hit[1]}: ${line.trim().slice(0, 200)}`);
      }
    }

    return problems;
  }

  /** What the server HTML of the home page must hold: the footer and the dust canvases of the hero and the footer. */
  static scanHome(opts: { html: string }): string[] {
    const problems: string[] = [];
    const canvases = opts.html.match(/<canvas\b/g)?.length ?? 0;

    if (!/class="[^"]*\bsite-footer\b/.test(opts.html)) {
      problems.push(
        'the built home page has no footer: a component threw while it was rendered on the server',
      );
    }

    if (canvases < 2) {
      problems.push(
        `the built home page has ${canvases} dust canvas(es), expected 2 (hero, footer)`,
      );
    }

    return problems;
  }

  /** An inner page has no footer. */
  static scanInner(opts: { html: string; page: string }): string[] {
    return /class="[^"]*\bsite-footer\b/.test(opts.html)
      ? [`the built inner page ${opts.page} has a footer; only the home page has one`]
      : [];
  }

  /** The checks over a built site and the output of its build; the problems, none when it is sound. */
  static check(opts: { dist: string; log: string }): string[] {
    const problems = WikiBuild.scanLog({ log: opts.log });
    const home = join(opts.dist, 'index.html');

    if (!existsSync(home)) {
      return [...problems, `no built home page at ${home}`];
    }

    problems.push(...WikiBuild.scanHome({ html: readFileSync(home, 'utf8') }));

    const inner = INNER_PAGES.find((page) => existsSync(join(opts.dist, page)));

    if (inner) {
      problems.push(
        ...WikiBuild.scanInner({ html: readFileSync(join(opts.dist, inner), 'utf8'), page: inner }),
      );
    } else {
      // not skipped: a renamed section or a broken build would otherwise pass without its inner pages looked at
      problems.push(`no built inner page to check (looked for ${INNER_PAGES.join(', ')})`);
    }

    return problems;
  }

  /** Builds the wiki, prints its output, then checks it; the exit code. */
  static run(opts: { wiki: string; dist: string; build: boolean }): number {
    let log = '';

    if (opts.build) {
      const built = Bun.spawnSync(['bun', 'run', 'vitepress', 'build', 'site'], {
        cwd: opts.wiki,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      log = `${built.stdout.toString()}${built.stderr.toString()}`;
      process.stdout.write(log);

      if (built.exitCode !== 0) {
        console.error(`wiki build: vitepress build exited ${built.exitCode}`);

        return 1;
      }
    }

    const problems = WikiBuild.check({ dist: opts.dist, log });

    for (const problem of problems) {
      console.error(`wiki build: ${problem}`);
    }

    if (problems.length === 0) {
      console.log(
        'wiki build: sound (no server render error; the home page has its footer and canvases; inner pages have no footer)',
      );
    }

    return problems.length === 0 ? 0 : 1;
  }
}

if (import.meta.main) {
  process.exit(WikiBuild.run({ wiki: WIKI, dist: DIST, build: !process.argv.includes('--check') }));
}
