#!/usr/bin/env node
import { NamespaceCommand } from './cli';

const USAGE = `Usage: ardor <command>

Commands:
  codemod namespace   move the deprecated bare names to the class members that replace them

Run "ardor codemod namespace --help" for the options.`;

/** The `ardor` bin of `@venizia/ardor`: `ardor codemod namespace [paths...] [--write | --check]`. */
const main = async (): Promise<number> => {
  const [command, name, ...rest] = process.argv.slice(2);

  if (command === 'codemod' && name === 'namespace') {
    return NamespaceCommand.run({ root: process.cwd(), args: rest });
  }

  if (command === undefined || command === '--help' || command === '-h') {
    console.log(USAGE);

    return 0;
  }

  console.error(`ardor: unknown command "${[command, name].filter(Boolean).join(' ')}"\n${USAGE}`);

  return 2;
};

const result = await main();
process.exitCode = result;
