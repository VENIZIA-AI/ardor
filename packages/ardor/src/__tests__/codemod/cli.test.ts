import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NamespaceCommand } from '@/codemod/cli';
import { makeScratch, removeScratch, writeFiles } from '../vite/fixture';

const OLD = "import { isDefined } from '@venizia/ardor';\nexport const a = isDefined(1);\n";
const NEW =
  "import { ValueUtility } from '@venizia/ardor';\nexport const a = ValueUtility.isDefined(1);\n";

const git = (opts: { cwd: string; args: string[] }) =>
  Bun.spawnSync({
    cmd: ['git', '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...opts.args],
    cwd: opts.cwd,
    stdout: 'ignore',
    stderr: 'ignore',
  });

describe('ardor codemod namespace', () => {
  let root = '';
  let output: string[] = [];
  let errors: string[] = [];
  const spies: Array<{ mockRestore: () => void }> = [];

  const run = (args: string[]) => NamespaceCommand.run({ root, args });

  // A clean tree: --write refuses a file with local changes, so a fixture is committed first.
  const seed = (files: Record<string, string>) => {
    writeFiles({ root, files });
    git({ cwd: root, args: ['add', '-A'] });
    git({ cwd: root, args: ['commit', '-q', '-m', 'seed'] });
  };

  beforeEach(() => {
    root = makeScratch({ prefix: 'ardor-codemod-' });
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
    seed({ 'src/a.ts': OLD, 'src/untouched.ts': 'export const b = 1;\n' });
  });

  afterEach(() => {
    for (const spy of spies.splice(0)) {
      spy.mockRestore();
    }

    removeScratch({ root });
  });

  test('without a flag it lists the change and writes nothing', async () => {
    const code = await run([]);

    expect(code).toBe(0);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(OLD);
    expect(output.join('\n')).toContain('would change');
    expect(output.join('\n')).toContain('a.ts');
    expect(output.join('\n')).toContain('Run again with --write');
  });

  test('--write rewrites the file, and a second run finds nothing to do', async () => {
    const result = await run(['--write']);
    expect(result).toBe(0);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(NEW);
    expect(readFileSync(join(root, 'src/untouched.ts'), 'utf8')).toBe('export const b = 1;\n');

    output.length = 0;

    const result2 = await run(['--check']);
    expect(result2).toBe(0);
    expect(output.join('\n')).toContain('0 files would change');
  });

  test('--check exits 1 while something would change, and writes nothing', async () => {
    const result = await run(['--check']);
    expect(result).toBe(1);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(OLD);
  });

  test('--check exits 1 for what the codemod leaves, and lists it with its line', async () => {
    seed({
      'src/b.ts':
        "import { isDefined } from '@venizia/ardor';\nexport const f = (isDefined: boolean) => isDefined;\n",
    });
    await run(['--write']);

    const result = await run(['--check']);
    expect(result).toBe(1);
    expect(errors.join('\n')).toContain('b.ts:1 isDefined');
  });

  test('--check exits 1 for the removed hooks useSizer and useInjectableContainer', async () => {
    seed({
      'src/removed.ts':
        "import { useInjectableContainer, useSizer } from '@venizia/ardor';\nexport const a = [useInjectableContainer, useSizer];\n",
    });
    await run(['--write']);

    const result = await run(['--check']);
    expect(result).toBe(1);
    expect(errors.join('\n')).toContain('removed.ts:1 useInjectableContainer');
    expect(errors.join('\n')).toContain('removed.ts:1 useSizer');
  });

  test('--hooks moves a hook from the umbrella; without it the hook stays', async () => {
    seed({
      'src/hook.ts':
        "import { useRepository } from '@venizia/ardor';\nexport const a = useRepository;\n",
    });
    await run(['--write']);

    expect(readFileSync(join(root, 'src/hook.ts'), 'utf8')).toContain('{ useRepository }');

    git({ cwd: root, args: ['commit', '-q', '-am', 'codemod'] });
    await run(['--write', '--hooks']);

    expect(readFileSync(join(root, 'src/hook.ts'), 'utf8')).toBe(
      "import { Ardor } from '@venizia/ardor';\nexport const a = Ardor.useRepository;\n",
    );
  });

  test('--write refuses a file with local changes in a git repository', async () => {
    // Clean tree: written.
    const result = await run(['--write']);
    expect(result).toBe(0);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(NEW);

    // Dirty file: refused, and still the way it was.
    const edited = `${OLD}// a local edit\n`;

    writeFileSync(join(root, 'src/a.ts'), edited);

    const result2 = await run(['--write']);
    expect(result2).toBe(1);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(edited);
    expect(errors.join('\n')).toContain('refused src/a.ts');
  });

  // The downstream case: another codemod already changed a file, so the tree is dirty when this one runs.
  describe('a file another codemod already changed', () => {
    const OTHER = `${OLD}// changed by another codemod\n`;
    const OTHER_NEW = `${NEW}// changed by another codemod\n`;

    beforeEach(() => {
      seed({ 'src/b.ts': OLD });
      writeFileSync(join(root, 'src/a.ts'), OTHER);
    });

    test('a refusal is listed by name with the way to proceed, counted in the summary, and exits 1', async () => {
      const dry = await run([]);
      expect(dry).toBe(0);
      expect(output.join('\n')).toContain('2 files would change, 0 left for you');

      output = [];
      errors = [];

      const result = await run(['--write']);
      expect(result).toBe(1);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(OTHER);
      expect(readFileSync(join(root, 'src/b.ts'), 'utf8')).toBe(NEW);
      expect(errors.join('\n')).toContain('refused src/a.ts');
      expect(errors.join('\n')).toContain('--allow-dirty');
      // one fewer than the dry run, and the line says why
      expect(output.join('\n')).toContain(
        '1 file changed, 1 refused (listed above), 0 left for you',
      );
    });

    test('--allow-dirty writes the file, keeps the other codemod edits, and matches the dry run', async () => {
      const result = await run(['--write', '--allow-dirty']);
      expect(result).toBe(0);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(OTHER_NEW);
      expect(readFileSync(join(root, 'src/b.ts'), 'utf8')).toBe(NEW);
      expect(errors).toEqual([]);
      expect(output.join('\n')).toContain('2 files changed, 0 left for you');
    });

    test('--allow-dirty without --write is a usage error and writes nothing', async () => {
      const result = await run(['--allow-dirty']);
      expect(result).toBe(2);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(OTHER);
      expect(errors.join('\n')).toContain('--allow-dirty only goes with --write');
    });
  });

  test('inside git it reads only the files git knows, so an ignored folder is never touched', async () => {
    seed({ '.gitignore': 'ignored/\n' });
    writeFiles({ root, files: { 'ignored/c.ts': OLD } });

    await run(['--write']);

    expect(readFileSync(join(root, 'ignored/c.ts'), 'utf8')).toBe(OLD);
  });

  test('outside git it walks the folder and skips node_modules, dist and dot-directories', async () => {
    const outside = makeScratch({ prefix: 'ardor-codemod-nogit-' });
    const ceiling = process.env.GIT_CEILING_DIRECTORIES;

    // The scratch folder lives inside this repository; the ceiling hides the repository from git.
    process.env.GIT_CEILING_DIRECTORIES = join(outside, '..');

    try {
      writeFiles({
        root: outside,
        files: {
          'src/a.ts': OLD,
          'node_modules/x/b.ts': OLD,
          'dist/c.ts': OLD,
          '.hidden/d.ts': OLD,
        },
      });

      const result = await NamespaceCommand.run({ root: outside, args: ['--write'] });
      expect(result).toBe(0);
      expect(readFileSync(join(outside, 'src/a.ts'), 'utf8')).toBe(NEW);
      expect(readFileSync(join(outside, 'node_modules/x/b.ts'), 'utf8')).toBe(OLD);
      expect(readFileSync(join(outside, 'dist/c.ts'), 'utf8')).toBe(OLD);
      expect(readFileSync(join(outside, '.hidden/d.ts'), 'utf8')).toBe(OLD);
    } finally {
      if (ceiling === undefined) {
        delete process.env.GIT_CEILING_DIRECTORIES;
      } else {
        process.env.GIT_CEILING_DIRECTORIES = ceiling;
      }

      removeScratch({ root: outside });
    }
  });

  test('a usage error exits 2 and touches nothing', async () => {
    const result = await run(['--nope']);
    expect(result).toBe(2);
    const result2 = await run(['--write', '--check']);
    expect(result2).toBe(2);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(OLD);
    expect(errors.join('\n')).toContain('Usage: ardor codemod namespace');
  });

  test('--help prints the usage', async () => {
    const result = await run(['--help']);
    expect(result).toBe(0);
    expect(output.join('\n')).toContain('ValueUtility.<name>');
  });
});
