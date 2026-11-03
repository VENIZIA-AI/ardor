import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.git']);
const SOURCE_PATTERN = /\.(?:ts|tsx|mts|cts)$/;
const DECLARATION_PATTERN = /\.d\.(?:ts|mts|cts)$/;

/**
 * The source files a codemod may touch. Inside a git repository the list comes from git, so a
 * `.gitignore`d folder (a worktree, a build output) is never entered; outside git the walk skips
 * `node_modules`, `dist`, `build` and every dot-directory.
 */
export class CodemodFiles {
  static isSource(opts: { name: string }): boolean {
    return SOURCE_PATTERN.test(opts.name) && !DECLARATION_PATTERN.test(opts.name);
  }

  /** Every source file under `target`; a file target is returned as it is. */
  static collect(opts: { target: string }): string[] {
    const { target } = opts;

    if (statSync(target).isFile()) {
      return [target];
    }

    return CodemodFiles.fromGit({ target }) ?? CodemodFiles.fromWalk({ target });
  }

  /** Tracked files plus untracked files git does not ignore; `undefined` outside a repository. */
  private static fromGit(opts: { target: string }): string[] | undefined {
    const { target } = opts;
    let output: string;

    try {
      output = execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        {
          cwd: target,
          encoding: 'utf8',
          maxBuffer: 256 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      );
      // eslint-disable-next-line venizia/no-silent-catch -- not a git repository (or no git) is an answer: the caller walks the folder instead
    } catch {
      return undefined;
    }

    return output
      .split('\0')
      .filter((path) => path !== '' && CodemodFiles.isSource({ name: path }))
      .filter((path) => !path.split('/').some((segment) => SKIPPED_DIRECTORIES.has(segment)))
      .map((path) => join(target, path))
      .filter((path) => existsSync(path) && statSync(path).isFile());
  }

  private static fromWalk(opts: { target: string }): string[] {
    const files: string[] = [];

    for (const entry of readdirSync(opts.target, { withFileTypes: true })) {
      const path = join(opts.target, entry.name);

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.')) {
          files.push(...CodemodFiles.fromWalk({ target: path }));
        }
      } else if (entry.isFile() && CodemodFiles.isSource({ name: entry.name })) {
        files.push(path);
      }
    }

    return files;
  }

  /**
   * The files under `target` a write could not be undone with git: changed, staged or untracked.
   * `undefined` outside a repository or without git, where there is nothing to check.
   */
  static dirty(opts: { target: string }): Set<string> | undefined {
    const { target } = opts;
    const cwd = statSync(target).isFile() ? dirname(target) : target;
    const queries = [
      ['ls-files', '--modified', '--others', '--exclude-standard', '-z'],
      ['diff', '--cached', '--name-only', '--relative', '-z'],
    ];
    const paths = new Set<string>();

    for (const query of queries) {
      let output: string;

      try {
        output = execFileSync('git', query, {
          cwd,
          encoding: 'utf8',
          maxBuffer: 256 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        // eslint-disable-next-line venizia/no-silent-catch -- git cannot answer for this folder: the caller treats the file as unknown to git
      } catch {
        return undefined;
      }

      for (const path of output.split('\0')) {
        if (path !== '') {
          paths.add(join(cwd, path));
        }
      }
    }

    return paths;
  }
}
