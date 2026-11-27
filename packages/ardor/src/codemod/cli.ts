import { CodemodCommand, CodemodFlags, type ICodemodSpec, USAGE_ERROR_CODE } from './command';
import { AuthOptionsTransform } from './auth-options';
import { BaseApplicationTransform } from './base-application';
import { DefaultProvidersTransform } from './default-providers';
import { Migration } from './migrate';
import { NoAuthTransform } from './no-auth';

export { CodemodFlags, USAGE_ERROR_CODE };

const NAMESPACE_USAGE = `Usage: ardor codemod namespace [paths...] [--hooks] [--write [--allow-dirty] | --check]

Moves the names removed from @venizia/ardor to what replaces them:

  isDefined, isString, isNumber                         ValueUtility.<name>
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
  ISendResponse                                         INetworkResponse
  IAuthUser, IArtifactIndex                             IStoredAuthUser, IArdorArtifactIndex
  IApplication                                          IArdorApplicationProps

Removed with nothing to write in their place, so only listed with their line: isObject and isValidDate (also ValueUtility.isObject and .isValidDate), isEditableTarget,
TDataCount, ISyncFC, IListFilter.offset (use skip; listed wherever a file that imports IListFilter or ListFilterBuilder reads or sets .offset), useSizer (use useElementSize), useInjectableContainer (renamed useApplicationContainer), App.DEFAULT_LOCALE, NetworkResponseReader.toError (use HttpResponseReader.toApplicationError), HeaderConstants (use HTTP.Headers), NetworkHeaders (use HttpHeaders), Authentication (use App.TOKEN_TYPE), AuthRecovery (renamed AuthRecoveryHelper),
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

--write is all or nothing: it reads and rewrites every file in memory first, and writes only if every
file went through. A file that cannot be parsed or rewritten is listed as "failed" with its path, the
run exits 1 and nothing is written. A file that is not valid UTF-8 and would change is a failure too:
it is left alone rather than damaged. Outside a git repository nothing can undo a write, so --write
refuses unless you give --allow-dirty.

With no flag it lists what would change and writes nothing. Inside a git repository it reads the
files git knows (tracked, or untracked and not ignored), and --write refuses a file with local
changes (changed, staged or untracked), so git can undo the codemod: the file is listed as "refused"
with its path, the summary counts it and the run exits 1. Commit or stash it and run again, or run
again with --allow-dirty to write it anyway (it keeps the other codemod's edits). To run two codemods
one after the other in a dirty tree, give this one --write --allow-dirty.
Run your formatter afterwards: the new names are appended to the import they join.`;

const AUTH_OPTIONS_USAGE = `Usage: ardor codemod auth-options [paths...] [--write [--allow-dirty] | --check]

Adds use: true to the auth provider options of an app with sign-in, which 0.4.8 needs to turn
sign-in on. It rewrites the object literal of

  <x>.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({ ... })
  a method decorated @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }) whose body returns { ... }

to start with use: true. The key may also be the string '@app/application/options/auth', and
CoreBindings may be imported under another name. A literal that already has use (true or false) is
left as it is. Options that are not a plain object literal (a variable, a call, only a spread) are
listed with their line and left for you, and so is a type that no longer fits the options: a return
type, as or satisfies naming IAuthProviderOptions (it has no use). An app with no sign-in binds no
options and needs nothing.

  --write    write the changed files (without it, nothing is written)
  --allow-dirty  with --write, also write a file that has local changes, such as one another codemod
             just changed
  --check    dry run that exits 1 when anything would change or is left (for CI)
  --help     print this text and exit

Like every codemod it reads the files git knows (tracked, or untracked and not ignored) and --write
refuses a file with local changes, so git can undo it. --write is all or nothing. Run your formatter
afterwards.`;

const BASE_APPLICATION_USAGE = `Usage: ardor codemod base-application-import [paths...] [--write [--allow-dirty] | --check]

Moves BaseArdorApplication from @venizia/ardor-kernel to @venizia/ardor-admin: the import and the
re-export (export { BaseArdorApplication } from ...), with type modifiers and aliases kept. An import
that names other members is split, and the new line joins an import of @venizia/ardor-admin that
the file already has. An import from @venizia/ardor is correct already and is left.

Listed with their line and left for you: a namespace import of the kernel that reads
BaseArdorApplication. An export * from the kernel is printed as a note and never fails --check.
A package that depends only on the kernel
should extend AbstractArdorApplication instead of importing this class.

  --write    write the changed files (without it, nothing is written)
  --allow-dirty  with --write, also write a file that has local changes, such as one another codemod
             just changed
  --check    dry run that exits 1 when anything would change or is left (for CI)
  --help     print this text and exit

Like every codemod it reads the files git knows (tracked, or untracked and not ignored) and --write
refuses a file with local changes, so git can undo it. --write is all or nothing. Run your formatter
afterwards.`;

const DEFAULT_PROVIDERS_USAGE = `Usage: ardor codemod default-providers [paths...] [--check]

Lists, and never changes, every place that wires a default provider by hand: a @provide
method that returns <expr>.instantiate(X).value(<expr>) for a default provider class
(DefaultRestDataProvider, DefaultAuthProvider, DefaultI18nProvider, DefaultAuthService) or under one
of the keys DEFAULT_REST_DATA_PROVIDER, DEFAULT_AUTH_PROVIDER and DEFAULT_I18N_PROVIDER. Each line is

  path:line  the pattern  what to do

Delete the method for a default provider: 0.4.8 binds it. Replace it by a bindContext() line,
.toProvider(X), for any other class. This codemod is done by hand: --write is a usage error.

  --check    exits 1 when it finds a place (for CI); without it the exit code is 0
  --help     print this text and exit`;

const NO_AUTH_USAGE = `Usage: ardor codemod no-auth [paths...] [--write [--allow-dirty] | --check]

Moves the options noAuthPaths and noAuthPathRegex into noAuth: { paths, regex }. In a file that
imports from ARDOR it rewrites an object literal that holds them as plain values:

  { url, noAuthPaths: ['/auth/sign-in'] }  ->  { url, noAuth: { paths: ['/auth/sign-in'] } }

Listed with their line and left for you: a literal that has a spread or noAuth, that is spread or
Object.assigned into another object, that is typed INoAuthOptions, or that has a comment, a getter,
a method or a computed name in what would move; every literal when the file makes a noAuth elsewhere
(a literal, an assignment, a class field or a constructor parameter property); a literal with one
option when another literal of the file holds the other one; reads (options.noAuthPaths),
destructurings, type and class members; and a file that imports nothing from ARDOR.

A rewritten literal is printed as a note unless it goes straight to its consumer. Check every place
that merges two options objects, in any file: a spread keeps only the last noAuth, the request then
carries the token and nothing throws. The protected members of a DefaultNetworkRequestService
subclass (this.noAuthPaths) keep their names. A provider or network service given a removed option
throws.

  --write    write the changed files (without it, nothing is written)
  --allow-dirty  with --write, also write a file that has local changes, such as one another codemod
             just changed
  --check    dry run that exits 1 when anything would change or is left (for CI)
  --help     print this text and exit

Like every codemod it reads the files git knows (tracked, or untracked and not ignored) and --write
refuses a file with local changes, so git can undo it. --write is all or nothing. Run your formatter
afterwards.`;

/** `ardor codemod namespace`: the removed bare names move to the class members that replace them. */
export class NamespaceCommand {
  static readonly NAME = 'namespace';
  static readonly USAGE = NAMESPACE_USAGE;
  static readonly SPEC: ICodemodSpec = {
    name: NamespaceCommand.NAME,
    usage: NAMESPACE_USAGE,
    unit: 'use',
    extraFlags: [CodemodFlags.HOOKS],
    isDetectOnly: false,
    transform: (opts) => Migration.run(opts),
  };

  /** Runs the command and returns the exit code; prints to the console. */
  static run(opts: { root: string; args: string[] }): Promise<number> {
    return CodemodCommand.run({ ...opts, spec: NamespaceCommand.SPEC });
  }
}

/** `ardor codemod auth-options`: the auth provider options gain `use: true`. */
export class AuthOptionsCommand {
  static readonly NAME = 'auth-options';
  static readonly USAGE = AUTH_OPTIONS_USAGE;
  static readonly SPEC: ICodemodSpec = {
    name: AuthOptionsCommand.NAME,
    usage: AUTH_OPTIONS_USAGE,
    unit: 'binding',
    extraFlags: [],
    isDetectOnly: false,
    transform: (opts) => AuthOptionsTransform.run(opts),
  };

  static run(opts: { root: string; args: string[] }): Promise<number> {
    return CodemodCommand.run({ ...opts, spec: AuthOptionsCommand.SPEC });
  }
}

/** `ardor codemod base-application-import`: `BaseArdorApplication` is imported from the admin package. */
export class BaseApplicationImportCommand {
  static readonly NAME = 'base-application-import';
  static readonly USAGE = BASE_APPLICATION_USAGE;
  static readonly SPEC: ICodemodSpec = {
    name: BaseApplicationImportCommand.NAME,
    usage: BASE_APPLICATION_USAGE,
    unit: 'import',
    extraFlags: [],
    isDetectOnly: false,
    transform: (opts) => BaseApplicationTransform.run(opts),
  };

  static run(opts: { root: string; args: string[] }): Promise<number> {
    return CodemodCommand.run({ ...opts, spec: BaseApplicationImportCommand.SPEC });
  }
}

/** `ardor codemod no-auth`: the two no-auth options move into `noAuth`. */
export class NoAuthCommand {
  static readonly NAME = 'no-auth';
  static readonly USAGE = NO_AUTH_USAGE;
  static readonly SPEC: ICodemodSpec = {
    name: NoAuthCommand.NAME,
    usage: NO_AUTH_USAGE,
    unit: 'literal',
    extraFlags: [],
    isDetectOnly: false,
    transform: (opts) => NoAuthTransform.run(opts),
  };

  static run(opts: { root: string; args: string[] }): Promise<number> {
    return CodemodCommand.run({ ...opts, spec: NoAuthCommand.SPEC });
  }
}

/** `ardor codemod default-providers`: lists the hand-wired default providers; it never writes. */
export class DefaultProvidersCommand {
  static readonly NAME = 'default-providers';
  static readonly USAGE = DEFAULT_PROVIDERS_USAGE;
  static readonly SPEC: ICodemodSpec = {
    name: DefaultProvidersCommand.NAME,
    usage: DEFAULT_PROVIDERS_USAGE,
    unit: 'place',
    extraFlags: [],
    isDetectOnly: true,
    transform: (opts) => DefaultProvidersTransform.run(opts),
  };

  static run(opts: { root: string; args: string[] }): Promise<number> {
    return CodemodCommand.run({ ...opts, spec: DefaultProvidersCommand.SPEC });
  }
}
