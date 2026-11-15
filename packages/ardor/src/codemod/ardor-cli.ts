import { CodemodFlags, NamespaceCommand, USAGE_ERROR_CODE } from './cli';

const USAGE = `Usage: ardor <command>

Commands:
  codemod namespace   move the removed bare names to the class members that replace them
  codemod --list      print the name of each codemod, one per line

Run "ardor codemod namespace --help" for the options.

Run it as "bun run ardor ..." from a package that depends on @venizia/ardor, or as
"bun x --no-install ardor ...". Without --no-install, bunx fetches an unrelated package named
"ardor" from npm when the bin is not installed, and runs it.`;

class CliWords {
  static readonly CODEMOD = 'codemod';
  static readonly LIST = '--list';
}

/** The `ardor` bin of `@venizia/ardor`: `ardor codemod namespace [paths...] [--write | --check]`. */
export class ArdorCli {
  /** The codemods by the name `ardor codemod <name>` takes; `--list` prints these keys. */
  static readonly CODEMODS = new Map<
    string,
    (opts: { root: string; args: string[] }) => Promise<number>
  >([[NamespaceCommand.NAME, (opts) => NamespaceCommand.run(opts)]]);

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
