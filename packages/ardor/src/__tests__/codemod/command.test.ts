import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ArdorCli } from '@/codemod/ardor-cli';
import {
  AuthOptionsCommand,
  BaseApplicationImportCommand,
  DefaultProvidersCommand,
} from '@/codemod/cli';
import { makeScratch, removeScratch, writeFiles } from '../vite/fixture';

const git = (opts: { cwd: string; args: string[] }) =>
  Bun.spawnSync({
    cmd: ['git', '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...opts.args],
    cwd: opts.cwd,
    stdout: 'ignore',
    stderr: 'ignore',
  });

const AUTH_OLD = [
  "import { CoreBindings, provide } from '@venizia/ardor';",
  '',
  'export class AuthConfiguration {',
  '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
  '  authProviderOptions() {',
  "    return { paths: { afterLogin: '/products' } };",
  '  }',
  '}',
  '',
].join('\n');
const AUTH_NEW = AUTH_OLD.replace('return { paths', 'return { use: true, paths');

const BASE_OLD =
  "import { BaseArdorApplication } from '@venizia/ardor-kernel';\nexport class App extends BaseArdorApplication {}\n";
const BASE_NEW = BASE_OLD.replace('ardor-kernel', 'ardor-admin');

const PROVIDERS = [
  "import { CoreBindings, DefaultAuthProvider, provide } from '@venizia/ardor';",
  '',
  'export class AuthConfiguration {',
  '  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })',
  '  authProvider() {',
  '    return this.application.instantiate(DefaultAuthProvider).value(this.application);',
  '  }',
  '}',
  '',
].join('\n');

interface IWriter {
  name: string;
  run: (opts: { root: string; args: string[] }) => Promise<number>;
  old: string;
  changed: string;
}

const WRITERS: IWriter[] = [
  {
    name: 'auth-options',
    run: (opts) => AuthOptionsCommand.run(opts),
    old: AUTH_OLD,
    changed: AUTH_NEW,
  },
  {
    name: 'base-application-import',
    run: (opts) => BaseApplicationImportCommand.run(opts),
    old: BASE_OLD,
    changed: BASE_NEW,
  },
];

describe('the codemod commands', () => {
  let root = '';
  let output: string[] = [];
  let errors: string[] = [];
  const spies: Array<{ mockRestore: () => void }> = [];

  const seed = (files: Record<string, string>) => {
    writeFiles({ root, files });
    git({ cwd: root, args: ['add', '-A'] });
    git({ cwd: root, args: ['commit', '-q', '-m', 'seed'] });
  };

  beforeEach(() => {
    root = makeScratch({ prefix: 'ardor-codemod-wave2-' });
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
    git({ cwd: root, args: ['init', '-q'] });
  });

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }

    removeScratch({ root });
  });

  for (const writer of WRITERS) {
    describe(`ardor codemod ${writer.name}`, () => {
      const run = (args: string[]) => writer.run({ root, args });

      beforeEach(() => {
        seed({ 'src/a.ts': writer.old, 'src/untouched.ts': 'export const b = 1;\n' });
      });

      test('without a flag it lists the change and writes nothing', async () => {
        const code = await run([]);

        expect(code).toBe(0);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.old);
        expect(output.join('\n')).toContain('would change src/a.ts');
        expect(output.join('\n')).toContain('Run again with --write');
      });

      test('--write rewrites exactly the file, and a second run finds nothing', async () => {
        const result = await run(['--write']);
        expect(result).toBe(0);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.changed);
        expect(readFileSync(join(root, 'src/untouched.ts'), 'utf8')).toBe('export const b = 1;\n');

        git({ cwd: root, args: ['commit', '-q', '-am', 'codemod'] });
        output.length = 0;

        const result2 = await run(['--check']);
        expect(result2).toBe(0);
        expect(output.join('\n')).toContain('0 files would change');
      });

      test('--check exits 1 while something would change, and writes nothing', async () => {
        const result3 = await run(['--check']);
        expect(result3).toBe(1);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.old);
      });

      test('--write refuses a file with local changes, and --allow-dirty writes it', async () => {
        const edited = `${writer.old}// a local edit\n`;

        writeFileSync(join(root, 'src/a.ts'), edited);

        const result4 = await run(['--write']);
        expect(result4).toBe(1);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(edited);
        expect(errors.join('\n')).toContain('refused src/a.ts');

        const result5 = await run(['--write', '--allow-dirty']);
        expect(result5).toBe(0);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(
          `${writer.changed}// a local edit\n`,
        );
      });

      test('--allow-dirty without --write and --write with --check are usage errors', async () => {
        const result6 = await run(['--allow-dirty']);
        expect(result6).toBe(2);
        const result7 = await run(['--write', '--check']);
        expect(result7).toBe(2);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.old);
      });

      test('--hooks and an unknown option are usage errors that name the usage', async () => {
        const result8 = await run(['--hooks']);
        expect(result8).toBe(2);
        const result9 = await run(['--nope']);
        expect(result9).toBe(2);
        expect(errors.join('\n')).toContain(`Usage: ardor codemod ${writer.name}`);
        expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.old);
      });

      test('a path that does not exist is a usage error', async () => {
        const result10 = await run(['nope']);
        expect(result10).toBe(2);
        expect(errors.join('\n')).toContain('no such file or folder');
      });

      test('a link planted at the temporary name is not written through: nothing is changed', async () => {
        const elsewhere = makeScratch({ prefix: 'ardor-codemod-wave2-victim-' });

        try {
          writeFiles({ root: elsewhere, files: { 'victim.ts': 'export const victim = 1;\n' } });
          symlinkSync(join(elsewhere, 'victim.ts'), join(root, `src/a.ts.${process.pid}.codemod`));

          const result = await run(['--write']);

          expect(result).toBe(1);
          expect(readFileSync(join(elsewhere, 'victim.ts'), 'utf8')).toBe(
            'export const victim = 1;\n',
          );
          expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.old);
        } finally {
          rmSync(elsewhere, { recursive: true, force: true });
        }
      });

      test('a symlink is never written through, and --help prints the usage', async () => {
        const elsewhere = makeScratch({ prefix: 'ardor-codemod-wave2-target-' });

        try {
          writeFiles({ root: elsewhere, files: { 'other.ts': writer.old } });
          symlinkSync(join(elsewhere, 'other.ts'), join(root, 'src/linked.ts'));
          git({ cwd: root, args: ['add', '-A'] });
          git({ cwd: root, args: ['commit', '-q', '-m', 'link'] });

          const result11 = await run(['--write']);
          expect(result11).toBe(0);
          const result12 = await run(['src/linked.ts', '--write']);
          expect(result12).toBe(0);
          expect(readFileSync(join(elsewhere, 'other.ts'), 'utf8')).toBe(writer.old);
          expect(output.join('\n')).not.toContain('linked.ts');
          expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(writer.changed);

          output.length = 0;

          const result13 = await run(['--help']);
          expect(result13).toBe(0);
          expect(output[0]).toContain(`Usage: ardor codemod ${writer.name}`);
        } finally {
          removeScratch({ root: elsewhere });
        }
      });
    });
  }

  describe('ardor codemod auth-options: what it lists', () => {
    test('options that are not a literal are listed, left, and fail --check', async () => {
      const text = AUTH_OLD.replace("{ paths: { afterLogin: '/products' } }", 'OPTIONS');

      seed({ 'src/a.ts': text });

      const result14 = await AuthOptionsCommand.run({ root, args: ['--write'] });
      expect(result14).toBe(0);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(text);
      expect(errors.join('\n')).toContain('left src/a.ts:6 CoreBindings.AUTH_PROVIDER_OPTIONS');
      expect(output.join('\n')).toContain('0 files changed, 1 left for you');

      const result15 = await AuthOptionsCommand.run({ root, args: ['--check'] });
      expect(result15).toBe(1);
    });

    test('a rewrite prints a note and exits 0 with --write', async () => {
      seed({ 'src/a.ts': AUTH_NEW.replace('use: true, ', '') });

      const result16 = await AuthOptionsCommand.run({ root, args: ['--write'] });
      expect(result16).toBe(0);
      expect(output.join('\n')).toContain('note src/a.ts:6 CoreBindings.AUTH_PROVIDER_OPTIONS');
    });
  });

  describe('ardor codemod default-providers', () => {
    const run = (args: string[]) => DefaultProvidersCommand.run({ root, args });

    beforeEach(() => {
      seed({ 'src/a.ts': PROVIDERS, 'src/untouched.ts': 'export const b = 1;\n' });
    });

    test('prints path:line, the pattern and what to do, exits 0 and writes nothing', async () => {
      const result17 = await run([]);
      expect(result17).toBe(0);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(PROVIDERS);
      expect(output).toEqual([
        'src/a.ts:4  authProvider(): instantiate(DefaultAuthProvider).value()  delete this method and the APPLICATION_INSTANCE it injects if nothing else uses it: ARDOR binds DefaultAuthProvider itself',
        '1 place found. Nothing was changed: default-providers only lists them.',
      ]);
      expect(errors).toEqual([]);
    });

    const seedOnly = (text: string) => {
      writeFileSync(join(root, 'src/a.ts'), text);
    };

    test('lists a bare instantiate(DefaultAuthService) that a method returns', async () => {
      seedOnly(
        [
          "import { CoreBindings, DefaultAuthService, provide } from '@venizia/ardor';",
          'export class AuthConfiguration {',
          '  @provide({ key: CoreBindings.DEFAULT_AUTH_SERVICE })',
          '  authService() {',
          '    return this.application.instantiate(DefaultAuthService);',
          '  }',
          '}',
          '',
        ].join('\n'),
      );

      const result = await run([]);

      expect(result).toBe(0);
      expect(output.join('\n')).toContain(
        'src/a.ts:3  authService(): instantiate(DefaultAuthService)  delete this method',
      );
    });

    test('does not say delete under a key of the application: deleting it would unbind that key', async () => {
      seedOnly(
        [
          "import { DefaultAuthProvider, provide } from '@venizia/ardor';",
          'export class AuthConfiguration {',
          "  @provide({ key: 'my.auth' })",
          '  authProvider() {',
          '    return this.application.instantiate(DefaultAuthProvider).value(this.application);',
          '  }',
          '}',
          '',
        ].join('\n'),
      );

      await run([]);

      expect(output.join('\n')).toContain('.toProvider(DefaultAuthProvider)');
      expect(output.join('\n')).not.toContain('delete this method');
    });

    test("says to bind the auth options when the provider under the default key is the application's own", async () => {
      seedOnly(
        [
          "import { CoreBindings, provide } from '@venizia/ardor';",
          "import { CustomAuthProvider } from './custom';",
          'export class AuthConfiguration {',
          '  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })',
          '  authProvider() {',
          '    return this.application.instantiate(CustomAuthProvider).value(this.application);',
          '  }',
          '}',
          '',
        ].join('\n'),
      );

      await run([]);

      expect(output.join('\n')).toContain('AUTH_PROVIDER_OPTIONS');
      expect(output.join('\n')).toContain('{ use: true');
    });

    test('--check exits 1 when it finds a place, and 0 when it finds none', async () => {
      const result18 = await run(['--check']);
      expect(result18).toBe(1);

      writeFileSync(join(root, 'src/a.ts'), 'export const a = 1;\n');
      output.length = 0;

      const result19 = await run(['--check']);
      expect(result19).toBe(0);
      expect(output).toEqual([
        '0 places found. Nothing was changed: default-providers only lists them.',
      ]);
    });

    test('--write is a usage error, with or without --allow-dirty, and writes nothing', async () => {
      const result20 = await run(['--write']);
      expect(result20).toBe(2);
      const result21 = await run(['--write', '--allow-dirty']);
      expect(result21).toBe(2);
      expect(errors.join('\n')).toContain('--write is not available');
      expect(errors.join('\n')).toContain('Usage: ardor codemod default-providers');
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(PROVIDERS);
      expect(output).toEqual([]);
    });

    test('--allow-dirty alone, --hooks, an unknown option and a missing path are usage errors', async () => {
      const result22 = await run(['--allow-dirty']);
      expect(result22).toBe(2);
      const result23 = await run(['--hooks']);
      expect(result23).toBe(2);
      const result24 = await run(['--nope']);
      expect(result24).toBe(2);
      const result25 = await run(['nope']);
      expect(result25).toBe(2);
    });

    test('a file with local changes is read, not refused: nothing is written', async () => {
      writeFileSync(join(root, 'src/a.ts'), `${PROVIDERS}// a local edit\n`);

      const result26 = await run([]);
      expect(result26).toBe(0);
      expect(output.join('\n')).toContain('src/a.ts:4');
      expect(errors).toEqual([]);
    });

    test('a symlink is not read', async () => {
      const elsewhere = makeScratch({ prefix: 'ardor-codemod-wave2-target-' });

      try {
        writeFiles({ root: elsewhere, files: { 'other.ts': PROVIDERS } });
        symlinkSync(join(elsewhere, 'other.ts'), join(root, 'src/linked.ts'));
        git({ cwd: root, args: ['add', '-A'] });
        git({ cwd: root, args: ['commit', '-q', '-m', 'link'] });

        const result27 = await run([]);
        expect(result27).toBe(0);
        expect(output.join('\n')).not.toContain('linked.ts');
        const result28 = await run(['src/linked.ts']);
        expect(result28).toBe(0);
        expect(output.join('\n')).toContain('0 places found');
      } finally {
        removeScratch({ root: elsewhere });
      }
    });

    test('--help prints the usage', async () => {
      const result29 = await run(['--help']);
      expect(result29).toBe(0);
      expect(output[0]).toContain('Usage: ardor codemod default-providers');
    });
  });

  describe('ardor codemod through the bin', () => {
    test('runs each new name and exits 2 for --write on the detect-only one', async () => {
      seed({ 'src/a.ts': BASE_OLD });

      const result30 = await ArdorCli.run({
        root,
        argv: ['codemod', 'base-application-import', '--write'],
      });
      expect(result30).toBe(0);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(BASE_NEW);
      const result31 = await ArdorCli.run({
        root,
        argv: ['codemod', 'default-providers', '--write'],
      });
      expect(result31).toBe(2);
      const result32 = await ArdorCli.run({ root, argv: ['codemod', 'auth-options', '--check'] });
      expect(result32).toBe(0);
    });
  });
});
