/**
 * The release of a stable writes the date into the version folder it releases: `released: YYYY-MM-DD` as the last line of
 * the frontmatter of `changelogs/<version>/log.md`, in the release commit of `ardor`, the last package of the run and the
 * one the GitHub Release is made on. A folder with that line is frozen.
 *
 *   bun scripts/release/stamp-release.ts --version <X.Y.Z> --date <YYYY-MM-DD>
 *
 * It prints the repository-relative path it stamped, and nothing when the project keeps no folder for that version. The
 * same date again writes nothing; a folder that already carries another date is refused. Copied from VULCAN
 * (`scripts/release/stamp-release.ts`, #949) by way of IGNIS #1241; a change to the rule is made in VULCAN first. The
 * text rules are in merge-back.ts, which is copied alone to the runner.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { GithubRelease } from './github-release';
import { ReleaseMergeBack, ReleaseStampConstants, ReleaseStampText } from './merge-back';

export class ReleaseStamp {
  /** The repository-relative `log.md` of a version folder, from the manifest's changelog folder. */
  static logPathOf(opts: { cwd: string; version: string }): string {
    const { changelogs } = GithubRelease.manifestOf({ cwd: opts.cwd });

    return `${changelogs}/${opts.version}/${ReleaseStampConstants.LOG_FILE}`;
  }

  static main(opts: { args: string[]; cwd?: string }): number {
    const version = ReleaseMergeBack.flagValue({ args: opts.args, flag: '--version' });
    const date = ReleaseMergeBack.flagValue({ args: opts.args, flag: '--date' });
    const cwd = opts.cwd ?? process.cwd();

    if (
      version === undefined ||
      date === undefined ||
      !ReleaseStampConstants.VERSION.test(version) ||
      !ReleaseStampConstants.DATE.test(date)
    ) {
      console.error(ReleaseStampConstants.USAGE);

      return 2;
    }

    try {
      const path = ReleaseStamp.logPathOf({ cwd, version });
      const file = join(cwd, path);

      if (!existsSync(file)) {
        return 0;
      }

      const next = ReleaseStampText.stamped({ text: readFileSync(file, 'utf8'), date });

      if (next !== undefined) {
        writeFileSync(file, next);
      }

      console.log(path);

      return 0;
    } catch (error) {
      console.error(
        `ERROR | stamp-release: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 1;
    }
  }
}

if (import.meta.main) {
  process.exit(ReleaseStamp.main({ args: process.argv.slice(2) }));
}
