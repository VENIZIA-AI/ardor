import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { CodemodFiles } from './files';
import { Migration } from './migrate';
import type { IFinding, TTypeScript } from './transform';

const USAGE = `Usage: ardor codemod namespace [paths...] [--hooks] [--write [--allow-dirty] | --check]

Moves the names removed from @venizia/ardor to what replaces them:

  isDefined, isString, isNumber, isObject, isValidDate   ValueUtility.<name>
  isBrowser                                             BrowserUtility.isBrowser
  toDataUrl                                             FileUtility.toDataUrl
  getRuntimeConfig                                      RuntimeConfig.get
  createAppDispatch, createAppSelectors                 DispatchHooks.create, SelectorHooks.create
  resolveApplicationProviders                           ApplicationProviders.resolve
  hasPendingFeatureMessages, loadFeatureMessages        Features.hasPendingMessages, Features.loadMessages
  NumberIdType, StringIdType, NullableType              number, string, undefined | null | void
  BaseHelper, LogLevels, ILogger, TLogLevel             the same names from @venizia/ignis-helpers/core
  Logger.getInstance({ scope }), new Logger({ scope })  LoggerFactory.getLogger([scope]) (enableDebug is dropped, with a note)
  Logger (a type)                                       ILogger

Removed with nothing to write in their place, so only listed with their line: isEditableTarget,
TDataCount, ISyncFC, useSizer (use useElementSize), useInjectableContainer (renamed useApplicationContainer), App.DEFAULT_LOCALE, HeaderConstants.REQUEST_DEVICE_INFO, HeaderConstants.RESPONSE_FORMAT,
the enableDebug prop of ArdorApplication (pass logger instead), and a Logger use with no one-line form.

It rewrites a name imported from @venizia/ardor, @venizia/ardor-kernel, @venizia/ardor-react or
@venizia/ardor-admin, its uses, and the import. It reads syntax only: a name the file also declares
itself, a re-export by name and a class name already taken are listed with their line and left for you.

  --hooks    also move a hook imported from @venizia/ardor to the Ardor namespace (useRepository()
             becomes Ardor.useRepository()). A hook imported from @venizia/ardor-react or
             @venizia/ardor-admin is never touched: those packages cannot import Ardor.
  --write    write the changed files (without it, nothing is written)
  --allow-dirty  with --write, also write a file that has local changes, such as one another codemod
             just changed (devz codemod namespace-functions --write leaves the tree dirty)
  --check    dry run that exits 1 when anything would change or is left (for CI)
  --help     print this text and exit

With no flag it lists what would change and writes nothing. Inside a git repository it reads the
files git knows (tracked, or untracked and not ignored), and --write refuses a file with local
changes (changed, staged or untracked), so git can undo the codemod: the file is listed as "refused"
with its path, the summary counts it and the run exits 1. Commit or stash it and run again, or run
again with --allow-dirty to write it anyway (it keeps the other codemod's edits). To run two codemods
one after the other in a dirty tree, give this one --write --allow-dirty.
Run your formatter afterwards: the new names are appended to the import they join.`;

/** A usage error: nothing was read or written. */
const USAGE_ERROR_CODE = 2;

class CodemodFlags {
  static readonly WRITE = '--write';
  static readonly CHECK = '--check';
  static readonly HOOKS = '--hooks';
  static readonly ALLOW_DIRTY = '--allow-dirty';
  static readonly HELP = '--help';
  static readonly HELP_SHORT = '-h';

  static readonly SCHEME_SET = new Set([
    this.WRITE,
    this.CHECK,
    this.HOOKS,
    this.ALLOW_DIRTY,
    this.HELP,
    this.HELP_SHORT,
  ]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

/** `ardor codemod namespace`: a dry run unless `--write`; `--check` is the dry run that fails on work left. */
export class NamespaceCommand {
  static readonly USAGE = USAGE;

  /** Runs the command and returns the exit code; prints to the console. */
  static async run(opts: { root: string; args: string[] }): Promise<number> {
    const { root, args } = opts;

    if (args.includes(CodemodFlags.HELP) || args.includes(CodemodFlags.HELP_SHORT)) {
      console.log(USAGE);

      return 0;
    }

    const unknown = args.filter(
      (argument) => argument.startsWith('-') && !CodemodFlags.isValid(argument),
    );

    if (unknown.length > 0) {
      console.error(
        `ardor codemod: unknown option ${unknown.map((flag) => `"${flag}"`).join(', ')}\n${USAGE}`,
      );

      return USAGE_ERROR_CODE;
    }

    const isWrite = args.includes(CodemodFlags.WRITE);
    const isCheck = args.includes(CodemodFlags.CHECK);

    if (isWrite && isCheck) {
      console.error(
        `ardor codemod: ${CodemodFlags.WRITE} and ${CodemodFlags.CHECK} contradict each other\n${USAGE}`,
      );

      return USAGE_ERROR_CODE;
    }

    const isAllowDirty = args.includes(CodemodFlags.ALLOW_DIRTY);

    if (isAllowDirty && !isWrite) {
      console.error(
        `ardor codemod: ${CodemodFlags.ALLOW_DIRTY} only goes with ${CodemodFlags.WRITE}: a dry run writes nothing\n${USAGE}`,
      );

      return USAGE_ERROR_CODE;
    }

    const ts = await NamespaceCommand.loadTypeScript();

    if (!ts) {
      console.error(
        'ardor codemod: the "typescript" package is not installed here. Install it (it is a dev dependency of any TypeScript project) and run again.',
      );

      return USAGE_ERROR_CODE;
    }

    const paths = args.filter((argument) => !argument.startsWith('-'));
    const targets = (paths.length > 0 ? paths : ['.']).map((path) => resolve(root, path));
    const hooks = args.includes(CodemodFlags.HOOKS);

    return NamespaceCommand.sweep({ root, ts, targets, hooks, isWrite, isCheck, isAllowDirty });
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
    ts: TTypeScript;
    targets: string[];
    hooks: boolean;
    isWrite: boolean;
    isCheck: boolean;
    isAllowDirty: boolean;
  }): number {
    const { root, ts, targets, hooks, isWrite, isCheck, isAllowDirty } = opts;
    const files = [...new Set(targets.flatMap((target) => CodemodFiles.collect({ target })))];
    const dirty =
      isWrite && !isAllowDirty
        ? new Set(targets.flatMap((target) => [...(CodemodFiles.dirty({ target }) ?? [])]))
        : new Set<string>();
    const changes: Array<{ path: string; renamed: number }> = [];
    const refused: string[] = [];
    const left: Array<{ path: string; finding: IFinding }> = [];
    const notes: Array<{ path: string; finding: IFinding }> = [];

    for (const path of files) {
      const text = readFileSync(path, 'utf8');
      const result = Migration.run({ ts, fileName: path, text, hooks });

      for (const finding of result.findings) {
        (finding.kind === 'note' ? notes : left).push({ path, finding });
      }

      if (result.text === text) {
        continue;
      }

      if (isWrite && dirty.has(path)) {
        refused.push(path);
        continue;
      }

      changes.push({ path, renamed: result.renamed });

      if (isWrite) {
        writeFileSync(path, result.text);
      }
    }

    return NamespaceCommand.report({ root, isWrite, isCheck, changes, refused, left, notes });
  }

  private static report(opts: {
    root: string;
    isWrite: boolean;
    isCheck: boolean;
    changes: Array<{ path: string; renamed: number }>;
    refused: string[];
    left: Array<{ path: string; finding: IFinding }>;
    notes: Array<{ path: string; finding: IFinding }>;
  }): number {
    const { root, isWrite, isCheck, changes, refused, left, notes } = opts;
    const verb = isWrite ? 'changed' : 'would change';
    const show = (path: string): string => relative(root, path) || path;

    for (const change of changes) {
      console.log(
        `${verb} ${show(change.path)} (${change.renamed} use${change.renamed === 1 ? '' : 's'})`,
      );
    }

    for (const path of refused) {
      console.error(
        `refused ${show(path)}: it has local changes, so git cannot undo the codemod there; commit or stash it and run again, or run again with ${CodemodFlags.ALLOW_DIRTY}`,
      );
    }

    // A note is a change made on purpose that is worth knowing; it is not work left, so --check ignores it.
    for (const { path, finding } of notes) {
      console.log(`note ${show(path)}:${finding.line} ${finding.name}: ${finding.reason}`);
    }

    for (const { path, finding } of left) {
      console.error(`left ${show(path)}:${finding.line} ${finding.name}: ${finding.reason}`);
    }

    const refusedNote = refused.length > 0 ? `, ${refused.length} refused (listed above)` : '';

    console.log(
      `${changes.length} file${changes.length === 1 ? '' : 's'} ${verb}${refusedNote}, ${left.length} left for you${isWrite || changes.length === 0 ? '' : '. Run again with --write to apply.'}`,
    );

    if (refused.length > 0) {
      return 1;
    }

    return isCheck && (changes.length > 0 || left.length > 0) ? 1 : 0;
  }
}
