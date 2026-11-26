/**
 * The release notes of a version folder (`changelogs/<X.Y.Z>/log.md` and `migration.yaml`), from the text of its files.
 * It imports nothing, so the release scripts load it as it is: the publish job installs nothing.
 *
 * This is the logic of `VersionNotes` of VULCAN's atlas (`packages/atlas/src/changelogs/notes.ts`), which the command
 * `vulcan migrate notes` runs. ARDOR cannot import it from the publish job, so `release-notes.test.ts` checks this
 * copy against that command on every folder. A change to the rule is made in VULCAN first.
 */
export class ReleaseNotes {
  /** The frontmatter block at the top of a markdown file. */
  static readonly FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

  /** The notes of a version whose `log.md` says nothing: the changelog records what affects users, and nothing did. */
  static readonly NO_USER_CHANGES = 'No change for users of the packages in this release.';

  /** `log.md` without its front matter; empty when nothing else is in it. */
  static bodyOf(opts: { log: string }): string {
    return opts.log.replace(ReleaseNotes.FRONT_MATTER, '').trim();
  }

  /** Whether `migration.yaml` holds a block: an absent file, an empty one and `{}` hold none. */
  static hasBlocks(opts: { migration?: string }): boolean {
    if (opts.migration === undefined || opts.migration.trim() === '') {
      return false;
    }

    try {
      const parsed: unknown = Bun.YAML.parse(opts.migration);

      return typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0;
    } catch (error) {
      // A file that does not parse is not "no block": it ships, and the changelog gate reports it.
      console.error(
        `release notes: migration.yaml does not parse, so it ships: ${error instanceof Error ? error.message : String(error)}`,
      );

      return true;
    }
  }

  /** `## Packages`, a link per package at the version: what every Release lists under its notes. */
  static packagesOf(opts: { names: string[]; version: string }): string {
    return [
      '## Packages',
      '',
      ...opts.names.map(
        (name) =>
          `- [${name}@${opts.version}](https://www.npmjs.com/package/${name}/v/${opts.version})`,
      ),
    ].join('\n');
  }

  /** The notes: the body of `log.md`, then the packages. */
  static notesOf(opts: { log: string; names: string[]; version: string }): string {
    const body = ReleaseNotes.bodyOf({ log: opts.log });

    return `${[body === '' ? ReleaseNotes.NO_USER_CHANGES : body, '', ReleaseNotes.packagesOf(opts)].join('\n')}\n`;
  }
}
