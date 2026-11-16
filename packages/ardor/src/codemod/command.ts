import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  type Stats,
  writeFileSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';

import { CodemodFiles } from './files';
import type { IFinding, TTypeScript } from './transform';

/** A usage error: nothing was read or written. */
export const USAGE_ERROR_CODE = 2;

/** What one codemod rewrote in one file: the new text, how many places changed, and what it left. */
export interface ICodemodResult {
  text: string;
  renamed: number;
  findings: IFinding[];
}

/** One codemod: the command runs every file through `transform` and owns the flags and the writing. */
export interface ICodemodSpec {
  name: string;
  /** Starts with `Usage: ardor codemod <name>`. */
  usage: string;
  /** What `renamed` counts, in the singular: the summary line says `3 uses`. */
  unit: string;
  /** Flags this codemod takes besides the shared ones. */
  extraFlags: string[];
  /** The codemod only lists places: it never writes, and `--write` is a usage error. */
  isDetectOnly: boolean;
  transform(opts: {
    ts: TTypeScript;
    fileName: string;
    text: string;
    hooks: boolean;
  }): ICodemodResult;
}

export class CodemodFlags {
  static readonly WRITE = '--write';
  static readonly CHECK = '--check';
  static readonly HOOKS = '--hooks';
  static readonly ALLOW_DIRTY = '--allow-dirty';
  static readonly HELP = '--help';
  static readonly HELP_SHORT = '-h';

  static readonly SCHEME_SET = new Set([
    this.WRITE,
    this.CHECK,
    this.ALLOW_DIRTY,
    this.HELP,
    this.HELP_SHORT,
  ]);

  /** A flag the shared command knows, or one the codemod adds. */
  static isValid(opts: { value: string; extraFlags: string[] }): boolean {
    return this.SCHEME_SET.has(opts.value) || opts.extraFlags.includes(opts.value);
  }
}

/**
 * The part every `ardor codemod <name>` shares: the flags, the files git knows, the refusal of a file
 * with local changes, the all-or-nothing write and the report. A dry run unless `--write`; `--check`
 * is the dry run that fails on work left.
 */
export class CodemodCommand {
  /** Runs the codemod and returns the exit code; prints to the console. */
  static async run(opts: { root: string; args: string[]; spec: ICodemodSpec }): Promise<number> {
    const { root, args, spec } = opts;
    const { usage } = spec;

    if (args.includes(CodemodFlags.HELP) || args.includes(CodemodFlags.HELP_SHORT)) {
      console.log(usage);

      return 0;
    }

    const unknown = args.filter(
      (argument) =>
        argument.startsWith('-') &&
        !CodemodFlags.isValid({ value: argument, extraFlags: spec.extraFlags }),
    );

    if (unknown.length > 0) {
      console.error(
        `ardor codemod: unknown option ${unknown.map((flag) => `"${flag}"`).join(', ')}\n${usage}`,
      );

      return USAGE_ERROR_CODE;
    }

    const isWrite = args.includes(CodemodFlags.WRITE);
    const isCheck = args.includes(CodemodFlags.CHECK);

    if (isWrite && spec.isDetectOnly) {
      console.error(
        `ardor codemod ${spec.name}: ${CodemodFlags.WRITE} is not available. This codemod only lists the places and never writes; change them by hand.\n${usage}`,
      );

      return USAGE_ERROR_CODE;
    }

    if (isWrite && isCheck) {
      console.error(
        `ardor codemod: ${CodemodFlags.WRITE} and ${CodemodFlags.CHECK} contradict each other\n${usage}`,
      );

      return USAGE_ERROR_CODE;
    }

    const isAllowDirty = args.includes(CodemodFlags.ALLOW_DIRTY);

    if (isAllowDirty && !isWrite) {
      console.error(
        `ardor codemod: ${CodemodFlags.ALLOW_DIRTY} only goes with ${CodemodFlags.WRITE}: a dry run writes nothing\n${usage}`,
      );

      return USAGE_ERROR_CODE;
    }

    const ts = await CodemodCommand.loadTypeScript();

    if (!ts) {
      console.error(
        'ardor codemod: the "typescript" package is not installed here. Install it (it is a dev dependency of any TypeScript project) and run again.',
      );

      return USAGE_ERROR_CODE;
    }

    const paths = args.filter((argument) => !argument.startsWith('-'));
    const targets = (paths.length > 0 ? paths : ['.']).map((path) => resolve(root, path));
    const hooks = args.includes(CodemodFlags.HOOKS);
    const missing = targets.filter((target) => !existsSync(target));

    if (missing.length > 0) {
      console.error(
        `ardor codemod: no such file or folder: ${missing.map(CodemodCommand.clean).join(', ')}`,
      );

      return USAGE_ERROR_CODE;
    }

    return CodemodCommand.sweep({ root, spec, ts, targets, hooks, isWrite, isCheck, isAllowDirty });
  }

  private static async loadTypeScript(): Promise<TTypeScript | undefined> {
    try {
      const loaded = await import('typescript');

      // TypeScript is CommonJS: Node puts the module on `default`, a bundler may not.
      return loaded.default ?? loaded;
      // eslint-disable-next-line venizia/no-silent-catch -- no `typescript` installed is an answer, not a failure: the caller prints how to install it
    } catch {
      return undefined;
    }
  }

  private static sweep(opts: {
    root: string;
    spec: ICodemodSpec;
    ts: TTypeScript;
    targets: string[];
    hooks: boolean;
    isWrite: boolean;
    isCheck: boolean;
    isAllowDirty: boolean;
  }): number {
    const { root, spec, ts, targets, hooks, isWrite, isCheck, isAllowDirty } = opts;
    const files = [...new Set(targets.flatMap((target) => CodemodFiles.collect({ target })))];
    const dirtyOf = targets.map((target) => CodemodFiles.dirty({ target }));

    if (isWrite && !isAllowDirty && dirtyOf.some((dirty) => dirty === undefined)) {
      console.error(
        `ardor codemod: this is not a git repository, so nothing can undo ${CodemodFlags.WRITE}; run again with ${CodemodFlags.ALLOW_DIRTY} to write anyway`,
      );

      return 1;
    }

    const dirty = new Set(isAllowDirty ? [] : dirtyOf.flatMap((paths) => [...(paths ?? [])]));
    const changes: Array<{ path: string; renamed: number }> = [];
    const pending: Array<{ path: string; text: string; stat: Stats }> = [];
    const refused: string[] = [];
    const failed: Array<{ path: string; reason: string }> = [];
    const left: Array<{ path: string; finding: IFinding }> = [];
    const notes: Array<{ path: string; finding: IFinding }> = [];

    for (const path of files) {
      try {
        const stat = lstatSync(path);
        const bytes = readFileSync(path);
        const text = bytes.toString('utf8');
        const result = spec.transform({ ts, fileName: path, text, hooks });

        for (const finding of result.findings) {
          (finding.kind === 'note' ? notes : left).push({ path, finding });
        }

        if (result.text === text) {
          continue;
        }

        if (!Buffer.from(text, 'utf8').equals(bytes)) {
          failed.push({ path, reason: 'it is not valid UTF-8, so a rewrite would damage it' });
          continue;
        }

        if (isWrite && dirty.has(path)) {
          refused.push(path);
          continue;
        }

        changes.push({ path, renamed: result.renamed });
        pending.push({ path, text: result.text, stat });
      } catch (error) {
        failed.push({ path, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (isWrite && failed.length === 0) {
      failed.push(...CodemodCommand.writeAll({ pending }));
    }

    return CodemodCommand.report({
      root,
      spec,
      isWrite,
      isCheck,
      changes,
      refused,
      failed,
      left,
      notes,
    });
  }

  /**
   * Writes every file next to itself first, and renames them into place only when all were written,
   * so a failure leaves no file changed. A file that is not the file that was read (a link swapped in,
   * an edit made meanwhile) is refused: the rename replaces a link instead of following it, and a
   * hard link is not written through.
   */
  private static writeAll(opts: {
    pending: Array<{ path: string; text: string; stat: Stats }>;
  }): Array<{ path: string; reason: string }> {
    const staged: Array<{ path: string; temp: string }> = [];
    const failures: Array<{ path: string; reason: string }> = [];

    for (const { path, text, stat } of opts.pending) {
      const temp = `${path}.${process.pid}.codemod`;

      try {
        const now = lstatSync(path);

        if (!now.isFile() || now.mtimeMs !== stat.mtimeMs || now.size !== stat.size) {
          failures.push({
            path,
            reason: 'it changed while the codemod ran, so it was not written',
          });
          continue;
        }

        writeFileSync(temp, text, { flag: 'wx' });
        chmodSync(temp, now.mode & 0o7777);
        staged.push({ path, temp });
      } catch (error) {
        rmSync(temp, { force: true });
        failures.push({ path, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (failures.length > 0) {
      for (const { temp } of staged) {
        rmSync(temp, { force: true });
      }

      return failures;
    }

    for (const { path, temp } of staged) {
      renameSync(temp, path);
    }

    return [];
  }

  /** Text for the terminal: control, format and line-separator characters, such as an escape sequence in a file name, become `?`. */
  private static clean(text: string): string {
    return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '?');
  }

  private static report(opts: {
    root: string;
    spec: ICodemodSpec;
    isWrite: boolean;
    isCheck: boolean;
    changes: Array<{ path: string; renamed: number }>;
    refused: string[];
    failed: Array<{ path: string; reason: string }>;
    left: Array<{ path: string; finding: IFinding }>;
    notes: Array<{ path: string; finding: IFinding }>;
  }): number {
    const { root, spec, isWrite, isCheck, changes, refused, failed, left, notes } = opts;
    // Nothing is written when a file failed, so the files are not "changed".
    const verb = isWrite && failed.length === 0 ? 'changed' : 'would change';
    // A path comes from the file system: a control character in it is shown as `?`, never sent to the terminal.
    const show = (path: string): string => CodemodCommand.clean(relative(root, path) || path);

    for (const change of changes) {
      console.log(
        `${verb} ${show(change.path)} (${change.renamed} ${spec.unit}${change.renamed === 1 ? '' : 's'})`,
      );
    }

    for (const path of refused) {
      console.error(
        `refused ${show(path)}: it has local changes, so git cannot undo the codemod there; commit or stash it and run again, or run again with ${CodemodFlags.ALLOW_DIRTY}`,
      );
    }

    for (const { path, reason } of failed) {
      console.error(CodemodCommand.clean(`failed ${show(path)}: ${reason}`));
    }

    // A note is a change made on purpose that is worth knowing; it is not work left, so --check ignores it.
    for (const { path, finding } of notes) {
      console.log(`note ${show(path)}:${finding.line} ${finding.name}: ${finding.reason}`);
    }

    // A detect-only codemod has nothing else to say: its places are the answer, so they go to stdout.
    for (const { path, finding } of left) {
      if (spec.isDetectOnly) {
        console.log(
          CodemodCommand.clean(`${show(path)}:${finding.line}  ${finding.name}  ${finding.reason}`),
        );
      } else {
        console.error(`left ${show(path)}:${finding.line} ${finding.name}: ${finding.reason}`);
      }
    }

    const refusedNote = [
      refused.length > 0 ? `, ${refused.length} refused (listed above)` : '',
      failed.length > 0
        ? `, ${failed.length} failed (listed above)${isWrite ? ', nothing was written' : ''}`
        : '',
    ].join('');

    if (spec.isDetectOnly) {
      console.log(
        `${left.length} place${left.length === 1 ? '' : 's'} found${refusedNote}. Nothing was changed: ${spec.name} only lists them.`,
      );
    } else {
      console.log(
        `${changes.length} file${changes.length === 1 ? '' : 's'} ${verb}${refusedNote}, ${left.length} left for you${isWrite || changes.length === 0 ? '' : '. Run again with --write to apply.'}`,
      );
    }

    if (refused.length > 0 || failed.length > 0) {
      return 1;
    }

    return isCheck && (changes.length > 0 || left.length > 0) ? 1 : 0;
  }
}
