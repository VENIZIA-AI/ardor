import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { ArdorCli } from '@/codemod/ardor-cli';
import { NamespaceCommand } from '@/codemod/cli';

describe('ardor', () => {
  let output: string[] = [];
  let errors: string[] = [];
  const spies: Array<{ mockRestore: () => void }> = [];

  const run = (argv: string[]) => ArdorCli.run({ root: process.cwd(), argv });

  beforeEach(() => {
    output = [];
    errors = [];
    spies.push(
      spyOn(console, 'log').mockImplementation((line: unknown) => {
        output.push(String(line));
      }),
      spyOn(console, 'error').mockImplementation((line: unknown) => {
        errors.push(String(line));
      }),
    );
  });

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }
  });

  describe('help', () => {
    test('says how to run the bin without fetching another package of that name', async () => {
      const code = await run([]);
      const text = output.join('\n') + errors.join('\n');

      expect(code).not.toBe(1);
      expect(text).toContain('bun run ardor');
      expect(text).toContain('--no-install');
      expect(text).toContain('cache');
    });
  });

  describe('codemod --list', () => {
    test('prints the name of each codemod, one per line, and exits 0', async () => {
      const code = await run(['codemod', '--list']);
      expect(code).toBe(0);
      expect(output).toEqual([NamespaceCommand.NAME]);
      expect(errors).toEqual([]);
    });

    test('lists only names that codemod <name> runs', async () => {
      for (const name of ArdorCli.CODEMODS.keys()) {
        output = [];
        const code = await run(['codemod', name, '--help']);
        expect(code).toBe(0);
        expect(output[0]).toContain(`Usage: ardor codemod ${name}`);
      }
    });

    test('is an unknown command with another word after it', async () => {
      const code = await run(['codemod', '--list', NamespaceCommand.NAME]);
      expect(code).toBe(2);
      expect(output).toEqual([]);
      expect(errors[0]).toContain('unknown command "codemod --list"');
    });
  });

  describe('codemod <name>', () => {
    test('runs namespace and prints its usage for --help', async () => {
      const code = await run(['codemod', NamespaceCommand.NAME, '--help']);
      expect(code).toBe(0);
      expect(output[0]).toContain('Usage: ardor codemod namespace');
    });

    test('exits 2 for a name that is not a codemod', async () => {
      const code = await run(['codemod', 'nothing']);
      expect(code).toBe(2);
      expect(errors[0]).toContain('unknown command "codemod nothing"');
    });

    test('exits 2 for codemod alone', async () => {
      const code = await run(['codemod']);
      expect(code).toBe(2);
      expect(errors[0]).toContain('unknown command "codemod"');
    });

    test('exits 2 for --reverse, which no codemod takes', async () => {
      const code = await run(['codemod', NamespaceCommand.NAME, '--reverse']);
      expect(code).toBe(2);
      expect(errors[0]).toContain('unknown option "--reverse"');
    });
  });

  describe('the top level', () => {
    test('prints the usage on stdout and exits 0 for no command, --help and -h', async () => {
      for (const argv of [[], ['--help'], ['-h']]) {
        output = [];
        const code = await run(argv);
        expect(code).toBe(0);
        expect(output[0]).toContain('Usage: ardor <command>');
        expect(output[0]).toContain('codemod --list');
        expect(errors).toEqual([]);
      }
    });

    test('exits 2 on stderr for an unknown command', async () => {
      const code = await run(['foo']);
      expect(code).toBe(2);
      expect(output).toEqual([]);
      expect(errors[0]).toContain('unknown command "foo"');
    });
  });
});
