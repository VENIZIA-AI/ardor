import {
  AuthOptionsCommand,
  BaseApplicationImportCommand,
  CodemodFlags,
  DefaultProvidersCommand,
  HttpMethodsCommand,
  NamespaceCommand,
  NoAuthCommand,
  USAGE_ERROR_CODE,
} from './cli';

const USAGE = `Usage: ardor <command>

Commands:
  codemod namespace                move the removed bare names to the class members that replace them
  codemod auth-options             add use: true to the auth provider options of an app with sign-in
  codemod base-application-import  import BaseArdorApplication from @venizia/ardor-admin
  codemod default-providers        list the default providers an app wires by hand (detect only)
  codemod no-auth                  move noAuthPaths and noAuthPathRegex into noAuth: { paths, regex }
  codemod http-methods             move RequestMethods to HTTP.Methods of @venizia/ignis-helpers
  codemod --list                   print the name of each codemod, one per line

Run "ardor codemod <name> --help" for the options.

Run it as "bun run ardor ..." inside a package that depends on @venizia/ardor: that runs the
bin the package installed. A fetching runner (bunx, npx) may fetch and run an unrelated package
named "ardor" from npm when no bin is installed, and "--no-install" only stops the fetch: it can
still run a copy that an earlier fetch left in the runner cache.`;

class CliWords {
  static readonly CODEMOD = 'codemod';
  static readonly LIST = '--list';
}

/** The `ardor` bin of `@venizia/ardor`: `ardor codemod <name> [paths...] [--write | --check]`. */
export class ArdorCli {
  /** The codemods by the name `ardor codemod <name>` takes; `--list` prints these keys. */
  static readonly CODEMODS = new Map<
    string,
    (opts: { root: string; args: string[] }) => Promise<number>
  >([
    [NamespaceCommand.NAME, (opts) => NamespaceCommand.run(opts)],
    [AuthOptionsCommand.NAME, (opts) => AuthOptionsCommand.run(opts)],
    [BaseApplicationImportCommand.NAME, (opts) => BaseApplicationImportCommand.run(opts)],
    [DefaultProvidersCommand.NAME, (opts) => DefaultProvidersCommand.run(opts)],
    [NoAuthCommand.NAME, (opts) => NoAuthCommand.run(opts)],
    [HttpMethodsCommand.NAME, (opts) => HttpMethodsCommand.run(opts)],
  ]);

  /** Runs the command and returns the exit code; prints to the console. */
  static async run(opts: { root: string; argv: string[] }): Promise<number> {
    const { root, argv } = opts;
    const [command, name, ...rest] = argv;
    const codemod = name === undefined ? undefined : this.CODEMODS.get(name);

    if (command === CliWords.CODEMOD && codemod !== undefined) {
      return codemod({ root, args: rest });
    }

    if (command === CliWords.CODEMOD && name === CliWords.LIST && rest.length === 0) {
      for (const codemodName of this.CODEMODS.keys()) {
        console.log(codemodName);
      }

      return 0;
    }

    if (
      command === undefined ||
      command === CodemodFlags.HELP ||
      command === CodemodFlags.HELP_SHORT
    ) {
      console.log(USAGE);

      return 0;
    }

    console.error(
      `ardor: unknown command "${[command, name].filter(Boolean).join(' ')}"\n${USAGE}`,
    );

    return USAGE_ERROR_CODE;
  }
}
