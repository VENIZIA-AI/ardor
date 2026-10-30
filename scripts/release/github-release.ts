/**
 * Ported from VENIZIA-AI/vulcan, scripts/release/github-release.ts, at d3dc02b6 (VULCAN #558, S9 of the release card).
 * ARDOR changes: a run releases several packages and tags each, so the Release is made on the tag of the LAST package of
 * the run (`ardor-v<version>` for a full run) and its Packages section lists the packages of the run; the tag is worked
 * out from the manifest's `tagPattern` (`<dir>-v<version>`), never taken from the command line; the title is
 * `ARDOR <version>`; a tag the run did not make is skipped, not a failure; the release commits of the packages are left
 * out of a prerelease's subjects; there is no `backfill` (Releases are made from now on, not for old versions) and
 * `create` takes `--dry-run`; the imports carry no `.ts`. Fix a defect in VULCAN first and copy the fix.
 *
 * The GitHub Release of a release run: one Release on the tag the run made.
 *
 *   bun scripts/release/github-release.ts create --version <v> --kind stable|prerelease --packages kernel,react,admin,ardor
 *     [--dry-run]
 *
 * A stable is marked Latest only when no higher stable tag exists, titled `ARDOR <version>`, with the changelog entries
 * added since the previous stable tag as notes; a prerelease is a Pre-release, never Latest, with the `@next` install
 * line and up to 30 `[#N]` subjects. A tag that has a Release is skipped. It never creates, edits or moves the
 * `atlas-index` release, and `--dry-run` writes nothing to GitHub.
 */

import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { ReleaseMergeBack } from './merge-back';
import { ReleaseKinds, type TReleaseKind } from './release-plan';
import { isReleaseVersion } from './release-version';

export class GithubReleaseConstants {
  /** The release the atlas index publishes its pairs to. */
  static readonly ATLAS_INDEX_TAG = 'atlas-index';
  static readonly MANIFEST = '.agents/vulcan.manifest.json';
  static readonly MAX_PRERELEASE_SUBJECTS = 30;
  /** A subject longer than this is cut: the whole body must stay under GitHub's 125000 characters. */
  static readonly MAX_SUBJECT_LENGTH = 300;
  /** The notes of a stable longer than this are cut with a closing line. */
  static readonly MAX_NOTES_LENGTH = 100000;
  static readonly DATED_ENTRY = /^\d{4}-\d{2}-\d{2}-.*\.md$/;
  static readonly FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
  static readonly DATE_HEADING = /^# Changelog - \d{4}-\d{2}-\d{2}\s*$/m;
  /** `## ARDOR X.Y.Z: title` or `## ARDOR 0.4.0: title`: the product and version prefix of an entry's heading. */
  static readonly VERSION_HEADING = /^(##\s+)ARDOR\s+(?:X\.Y\.Z|\d[^:\n]*):\s*(\S)/m;
  static readonly ISSUE_SUBJECT = /^\[#\d+\]/;
  /** The release commit of a package: `[#450] chore(kernel): release v0.4.6-1 [0.4.6-1]`. */
  static readonly RELEASE_COMMIT = /^\[#\d+\] chore\([\w-]+\): release v\d/;
  static readonly TITLE_PREFIX = 'ARDOR';
  /** The notes of a stable with no changelog entry: the changelog records what affects users, and nothing did. */
  static readonly NO_USER_CHANGES = 'No change for users of the packages in this release.';
  static readonly USAGE =
    'github-release: create --version <v> --kind stable|prerelease --packages <dir,dir,...> [--dry-run]';
}

export interface IGithubReleasePackage {
  name: string;
  dir: string;
}

export interface IGithubReleaseManifest {
  /** `<dir>-v<version>`: how a package names its release tag. */
  tagPattern: string;
  changelogs: string;
  /** The packages that are not retired, in release order: the last is the one users install. */
  packages: IGithubReleasePackage[];
}

export interface IGhResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type TGh = (opts: { args: string[] }) => IGhResult;

export type TGithubReleaseState =
  | 'created'
  | 'exists'
  | 'planned'
  | 'skipped'
  | 'refused'
  | 'failed';

export interface IGithubReleaseOutcome {
  state: TGithubReleaseState;
  message: string;
}

export class GithubRelease {
  static ghOf(opts: { cwd: string }): TGh {
    return ({ args }) => {
      const child = Bun.spawnSync(['gh', ...args], {
        cwd: opts.cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      return {
        status: child.exitCode,
        stdout: child.stdout.toString(),
        stderr: child.stderr.toString(),
      };
    };
  }

  static isRecord(opts: { value: unknown }): opts is { value: Record<string, unknown> } {
    return typeof opts.value === 'object' && opts.value !== null && !Array.isArray(opts.value);
  }

  static manifestOf(opts: { cwd: string }): IGithubReleaseManifest {
    const parsed: unknown = JSON.parse(
      readFileSync(join(opts.cwd, GithubReleaseConstants.MANIFEST), 'utf8'),
    );
    const root = { value: parsed };

    if (!GithubRelease.isRecord(root)) {
      throw new Error(`${GithubReleaseConstants.MANIFEST} is not an object`);
    }

    const release = { value: root.value['release'] };
    const knowledge = { value: root.value['knowledge'] };
    const packages = root.value['packages'];
    const pattern = GithubRelease.isRecord(release) ? release.value['tagPattern'] : undefined;
    const changelogs = GithubRelease.isRecord(knowledge)
      ? knowledge.value['changelogs']
      : undefined;

    if (typeof pattern !== 'string' || typeof changelogs !== 'string' || !Array.isArray(packages)) {
      throw new Error(
        `${GithubReleaseConstants.MANIFEST} needs release.tagPattern, knowledge.changelogs and packages`,
      );
    }

    return {
      tagPattern: pattern,
      changelogs,
      packages: packages.flatMap((entry) => {
        const holder = { value: entry };

        if (
          !GithubRelease.isRecord(holder) ||
          typeof holder.value['name'] !== 'string' ||
          typeof holder.value['dir'] !== 'string' ||
          holder.value['retired'] === true
        ) {
          return [];
        }

        return [{ name: holder.value['name'], dir: holder.value['dir'] }];
      }),
    };
  }

  /** The tag a package names a version with: the manifest's pattern with the package and the version put in. */
  static tagOf(opts: { pattern: string; dir: string; version: string }): string {
    // Replacer functions: a `$&` or `$'` in a value is text, not a replacement pattern.
    return opts.pattern.replace('<dir>', () => opts.dir).replace('<version>', () => opts.version);
  }

  /** Whether a version is plain semver (`x.y.z` or `x.y.z-pre`): no build metadata, no padding, nothing to split on. */
  static isStrictVersion(opts: { version: string }): boolean {
    return isReleaseVersion({ value: opts.version }) && !opts.version.includes('+');
  }

  /**
   * The version a tag names for one package. A tag whose version is not plain semver (`ardor-v9zzz`,
   * `ardor-v0.4.6.1`) names none: a stray tag cannot make a comparison throw and stop every Release.
   */
  static versionOfTag(opts: { tag: string; pattern: string; dir: string }): string | undefined {
    const escaped = opts.pattern
      .replace('<dir>', () => opts.dir)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('<version>', '(\\d\\S*)');
    const version = new RegExp(`^${escaped}$`).exec(opts.tag)?.[1];

    return version !== undefined && GithubRelease.isStrictVersion({ version })
      ? version
      : undefined;
  }

  /** The highest tag of this package below `version`: of stables only when `stableOnly`, of every kind otherwise. */
  static previousTag(opts: {
    tags: string[];
    pattern: string;
    dir: string;
    version: string;
    stableOnly: boolean;
  }): string | undefined {
    let best: { tag: string; version: string } | undefined;

    for (const tag of opts.tags) {
      const version = GithubRelease.versionOfTag({ tag, pattern: opts.pattern, dir: opts.dir });

      if (
        version === undefined ||
        Bun.semver.order(version, opts.version) >= 0 ||
        (opts.stableOnly && version.includes('-')) ||
        (best !== undefined && Bun.semver.order(version, best.version) <= 0)
      ) {
        continue;
      }

      best = { tag, version };
    }

    return best?.tag;
  }

  /** Whether no stable tag of this package is above `version`: the only case in which a Release may be Latest. */
  static isNewestStable(opts: {
    tags: string[];
    pattern: string;
    dir: string;
    version: string;
  }): boolean {
    return opts.tags.every((tag) => {
      const version = GithubRelease.versionOfTag({ tag, pattern: opts.pattern, dir: opts.dir });

      return (
        version === undefined ||
        version.includes('-') ||
        Bun.semver.order(version, opts.version) <= 0
      );
    });
  }

  static tagsOf(opts: { cwd: string }): string[] {
    return ReleaseMergeBack.mustGit({ cwd: opts.cwd, args: ['tag', '--list'] })
      .split('\n')
      .filter((tag) => tag !== '');
  }

  /**
   * The dated changelog files added in `from..to`, oldest first; `from` absent means everything up to `to`.
   * Renames are not followed: an entry renamed inside the range counts under its new name.
   */
  static entriesAdded(opts: { cwd: string; from?: string; to: string; folder: string }): string[] {
    const range = opts.from === undefined ? opts.to : `${opts.from}..${opts.to}`;
    const names = ReleaseMergeBack.mustGit({
      cwd: opts.cwd,
      args: [
        'log',
        '--no-renames',
        '--diff-filter=A',
        '--name-only',
        '--format=',
        range,
        '--',
        opts.folder,
      ],
    })
      .split('\n')
      .filter((path) => GithubReleaseConstants.DATED_ENTRY.test(path.split('/').pop() ?? ''));

    return [...new Set(names)].sort();
  }

  /**
   * An entry as a Release shows it: no front matter, no date heading, and its heading without the
   * `ARDOR X.Y.Z:` prefix (the Release is titled with the version already).
   */
  static stripEntry(opts: { text: string }): string {
    return opts.text
      .replace(GithubReleaseConstants.FRONT_MATTER, '')
      .replace(GithubReleaseConstants.DATE_HEADING, '')
      .replace(
        GithubReleaseConstants.VERSION_HEADING,
        (_match, heading: string, first: string) => `${heading}${first.toUpperCase()}`,
      )
      .trim();
  }

  /** The notes of a stable: the entries added since the previous stable, joined; empty when there are none. */
  static stableNotes(opts: { cwd: string; from?: string; to: string; folder: string }): string {
    return GithubRelease.entriesAdded(opts)
      .map((path) => {
        const shown = ReleaseMergeBack.git({ cwd: opts.cwd, args: ['show', `${opts.to}:${path}`] });

        return shown.status === 0 ? GithubRelease.stripEntry({ text: shown.stdout }) : '';
      })
      .filter((text) => text !== '')
      .join('\n\n');
  }

  /** The `[#N]` subjects of the commits in `from..to`, newest first; the release commits of the packages are left out. */
  static subjectsOf(opts: { cwd: string; from?: string; to: string }): string[] {
    const range = opts.from === undefined ? opts.to : `${opts.from}..${opts.to}`;

    return ReleaseMergeBack.mustGit({
      cwd: opts.cwd,
      args: ['log', '--no-merges', '--format=%s', range],
    })
      .split('\n')
      .filter(
        (subject) =>
          GithubReleaseConstants.ISSUE_SUBJECT.test(subject) &&
          !GithubReleaseConstants.RELEASE_COMMIT.test(subject),
      );
  }

  /** A fenced list: a line in it cannot ping anyone, close an issue or break the markdown. */
  static fencedLines(opts: { lines: string[] }): string[] {
    return ['```text', ...opts.lines.map((line) => line.replaceAll('```', "'''")), '```'];
  }

  /** At most `MAX_PRERELEASE_SUBJECTS` subjects, with a closing line that says how many were left out. */
  static cappedSubjects(opts: { subjects: string[] }): string[] {
    const max = GithubReleaseConstants.MAX_PRERELEASE_SUBJECTS;
    const length = GithubReleaseConstants.MAX_SUBJECT_LENGTH;
    const subjects = opts.subjects.map((subject) =>
      subject.length > length ? `${subject.slice(0, length - 3)}...` : subject,
    );

    return subjects.length <= max
      ? subjects
      : [...subjects.slice(0, max), `... and ${subjects.length - max} more`];
  }

  static packagesOf(opts: { names: string[]; version: string }): string[] {
    return [
      '## Packages',
      '',
      ...opts.names.map(
        (name) =>
          `- [${name}@${opts.version}](https://www.npmjs.com/package/${name}/v/${opts.version})`,
      ),
    ];
  }

  static bodyOf(opts: {
    kind: TReleaseKind;
    version: string;
    notes: string;
    subjects: string[];
    /** The packages of the run, in release order: the last is the one named in the install line of a prerelease. */
    packages: string[];
  }): string {
    const sections =
      opts.kind === ReleaseKinds.STABLE
        ? [opts.notes]
        : [
            `Install: \`npm install ${opts.packages.at(-1) ?? ''}@next\``,
            '',
            ...(opts.subjects.length === 0
              ? []
              : [
                  'Changes since the previous tag:',
                  '',
                  ...GithubRelease.fencedLines({ lines: opts.subjects }),
                ]),
          ];

    return [
      ...sections,
      '',
      ...GithubRelease.packagesOf({ names: opts.packages, version: opts.version }),
      '',
    ].join('\n');
  }

  /**
   * Makes the Release of the tag the run made, or says why it did not: a git or filesystem failure is an outcome too.
   * With `dryRun` it stops before `gh` creates anything and returns the notes as the message.
   */
  static create(opts: {
    cwd: string;
    kind: string;
    version: string;
    /** The package folders of the run (`kernel`, `react`, ...), in release order. */
    dirs: string[];
    gh: TGh;
    scratchRoot: string;
    dryRun?: boolean;
  }): IGithubReleaseOutcome {
    if (opts.kind !== ReleaseKinds.STABLE && opts.kind !== ReleaseKinds.PRERELEASE) {
      return { state: 'refused', message: `the kind '${opts.kind}' is not stable or prerelease` };
    }

    try {
      return GithubRelease.make({ ...opts, kind: opts.kind });
    } catch (error) {
      return { state: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  }

  private static make(opts: {
    cwd: string;
    kind: TReleaseKind;
    version: string;
    dirs: string[];
    gh: TGh;
    scratchRoot: string;
    dryRun?: boolean;
  }): IGithubReleaseOutcome {
    if (!GithubRelease.isStrictVersion({ version: opts.version })) {
      return { state: 'refused', message: `'${opts.version}' is not a plain semver version` };
    }

    const manifest = GithubRelease.manifestOf({ cwd: opts.cwd });
    const run = opts.dirs.map((dir) => manifest.packages.find((entry) => entry.dir === dir));
    const unknown = opts.dirs.filter((_dir, index) => run[index] === undefined);

    if (opts.dirs.length === 0 || unknown.length > 0) {
      return {
        state: 'refused',
        message: `the packages '${opts.dirs.join(',')}' are not all live packages of the manifest${unknown.length > 0 ? ` (unknown: ${unknown.join(', ')})` : ''}`,
      };
    }

    const packages = run.flatMap((entry) => (entry === undefined ? [] : [entry]));
    const last = packages.at(-1);

    if (last === undefined) {
      return { state: 'refused', message: 'the run names no package' };
    }

    const tag = GithubRelease.tagOf({
      pattern: manifest.tagPattern,
      dir: last.dir,
      version: opts.version,
    });

    if (tag === GithubReleaseConstants.ATLAS_INDEX_TAG) {
      return {
        state: 'refused',
        message: `${tag} is the release of the atlas index, not of a publish`,
      };
    }

    if (opts.gh({ args: ['release', 'view', tag, '--json', 'tagName'] }).status === 0) {
      return { state: 'exists', message: `${tag} already has a Release - skipped` };
    }

    // The run tags its packages in order; the last tag is missing from the remote when the run stopped before it.
    // Only a 404 means that: a missing right or a server error is a failure, not a quiet skip.
    const remoteTag = opts.gh({
      args: ['api', `repos/{owner}/{repo}/git/ref/tags/${tag}`, '--silent'],
    });

    if (remoteTag.status !== 0) {
      return /\b404\b|Not Found/i.test(remoteTag.stderr)
        ? { state: 'skipped', message: `${tag} is not on the remote - no Release` }
        : { state: 'failed', message: `could not look up ${tag}: ${remoteTag.stderr.trim()}` };
    }

    const stable = opts.kind === ReleaseKinds.STABLE;
    const tags = GithubRelease.tagsOf({ cwd: opts.cwd });
    const from = GithubRelease.previousTag({
      tags,
      pattern: manifest.tagPattern,
      dir: last.dir,
      version: opts.version,
      stableOnly: stable,
    });
    let notes = stable
      ? GithubRelease.stableNotes({
          cwd: opts.cwd,
          from,
          to: tag,
          folder: manifest.changelogs,
        })
      : '';

    // No entry since the previous stable is no fault: the changelog records only what affects users.
    if (stable && notes === '') {
      notes = GithubReleaseConstants.NO_USER_CHANGES;
    }

    if (notes.length > GithubReleaseConstants.MAX_NOTES_LENGTH) {
      notes = `${notes.slice(0, GithubReleaseConstants.MAX_NOTES_LENGTH)}\n\n... the notes are cut here: see the changelog`;
    }

    const subjects = stable ? [] : GithubRelease.subjectsOf({ cwd: opts.cwd, from, to: tag });
    const body = GithubRelease.bodyOf({
      kind: opts.kind,
      version: opts.version,
      notes,
      subjects: GithubRelease.cappedSubjects({ subjects }),
      packages: packages.map((entry) => entry.name),
    });
    // Latest is the repository's, not a package's: only a run that ends in the umbrella (the last live package)
    // may take it, so a run of the first packages alone never moves it.
    const latest =
      stable &&
      last.dir === manifest.packages.at(-1)?.dir &&
      GithubRelease.isNewestStable({
        tags,
        pattern: manifest.tagPattern,
        dir: last.dir,
        version: opts.version,
      });

    if (opts.dryRun) {
      return {
        state: 'planned',
        message: `${tag} (${opts.kind}, ${latest ? 'Latest' : 'not Latest'}), notes since ${from ?? 'the start of history'}:\n\n${body}`,
      };
    }

    mkdirSync(opts.scratchRoot, { recursive: true });
    const directory = mkdtempSync(join(opts.scratchRoot, 'github-release-'));

    try {
      const file = join(directory, 'notes.md');

      writeFileSync(file, body);

      const created = opts.gh({
        args: [
          'release',
          'create',
          tag,
          '--title',
          `${GithubReleaseConstants.TITLE_PREFIX} ${opts.version}`,
          '--notes-file',
          file,
          '--verify-tag',
          stable ? (latest ? '--latest' : '--latest=false') : '--prerelease',
        ],
      });

      return created.status === 0
        ? { state: 'created', message: `${tag}: ${created.stdout.trim()}` }
        : { state: 'failed', message: `gh release create ${tag}: ${created.stderr.trim()}` };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  static summaryOf(opts: { outcome: IGithubReleaseOutcome }): string {
    return ['### GitHub Release', '', `- ${opts.outcome.state}: ${opts.outcome.message}`, ''].join(
      '\n',
    );
  }

  /** The version, kind and package folders a `create` asks for; `undefined` when the flags do not give them. */
  static requestOf(opts: {
    args: string[];
  }): { version: string; kind: string; dirs: string[] } | undefined {
    const version = ReleaseMergeBack.flagValue({ args: opts.args, flag: '--version' });
    const kind = ReleaseMergeBack.flagValue({ args: opts.args, flag: '--kind' });
    const packages = ReleaseMergeBack.flagValue({ args: opts.args, flag: '--packages' });

    return version === undefined || kind === undefined || packages === undefined
      ? undefined
      : { version, kind, dirs: packages.split(',').filter((dir) => dir !== '') };
  }

  static main(opts: {
    args: string[];
    env: Record<string, string | undefined>;
    cwd?: string;
    gh?: TGh;
  }): number {
    const [command] = opts.args;
    const cwd = opts.cwd ?? process.cwd();
    const scratchRoot = opts.env['RUNNER_TEMP'] ?? join(cwd, '.agents', 'local', 'tmp');
    const summary = opts.env['GITHUB_STEP_SUMMARY'];

    try {
      if (command === 'create') {
        const request = GithubRelease.requestOf({ args: opts.args });

        if (request === undefined) {
          console.error(GithubReleaseConstants.USAGE);

          return 2;
        }

        const outcome = GithubRelease.create({
          cwd,
          ...request,
          gh: opts.gh ?? GithubRelease.ghOf({ cwd }),
          scratchRoot,
          dryRun: opts.args.includes('--dry-run'),
        });

        // Indented: a line of notes that starts with `::` would be a workflow command if this ran in CI.
        const shown = outcome.message.split('\n').join('\n  ');

        console.log(`github-release: ${outcome.state} - ${shown}`);

        if (summary !== undefined) {
          appendFileSync(summary, GithubRelease.summaryOf({ outcome }));
        }

        return outcome.state === 'failed' || outcome.state === 'refused' ? 1 : 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`ERROR | ${message}`);

      if (summary !== undefined) {
        appendFileSync(summary, GithubRelease.summaryOf({ outcome: { state: 'failed', message } }));
      }

      return 1;
    }

    console.error(GithubReleaseConstants.USAGE);

    return 2;
  }
}

if (import.meta.main) {
  process.exit(GithubRelease.main({ args: process.argv.slice(2), env: process.env }));
}
