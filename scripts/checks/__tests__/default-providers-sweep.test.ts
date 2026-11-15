import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');

class Sweep {
  static readonly GLOBS = [
    'presets/app/files/src/**/*.{ts,tsx}',
    'examples/*/src/**/*.{ts,tsx}',
    'examples/*/README.md',
    'README.md',
    'packages/*/README.md',
    'docs/wiki/site/.vitepress/theme/home-content.ts',
  ];

  /** What an application used to write to build a default provider by hand. */
  static readonly OLD_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    { name: 'instantiate(...).value(...)', pattern: /instantiate\(\w+\)\.value\(/ },
    { name: 'the injected application instance', pattern: /CoreBindings\.APPLICATION_INSTANCE/ },
    {
      name: 'a @provide method for a DEFAULT_* provider key',
      pattern: /@provide\(\{\s*key:\s*CoreBindings\.DEFAULT_\w+\s*\}\)/,
    },
    {
      name: 'a plain @provide for an options key (provideOption checks the return type)',
      pattern: /@provide\(\{\s*key:\s*CoreBindings\.\w+_OPTIONS\s*\}\)/,
    },
  ];

  static files(): string[] {
    return Sweep.GLOBS.flatMap((pattern) => [
      ...new Bun.Glob(pattern).scanSync({ cwd: ROOT, onlyFiles: true }),
    ]).filter((path) => !path.includes('node_modules') && !path.includes('/dist/'));
  }
}

describe('the scaffold, the examples and the READMEs bind only the options', () => {
  test('the sweep reads the preset, the three examples and the READMEs', () => {
    const files = Sweep.files();

    expect(files).toContain('presets/app/files/src/configurations/admin.configuration.ts');
    expect(files).toContain('examples/vert-admin/src/configurations/admin.configuration.ts');
    expect(files).toContain('examples/ipc-data-provider/src/index.ts');
    expect(files).toContain('packages/ardor/README.md');
  });

  for (const { name, pattern } of Sweep.OLD_PATTERNS) {
    test(`none writes ${name}`, () => {
      const offenders = Sweep.files().filter((path) =>
        pattern.test(readFileSync(join(ROOT, path), 'utf8')),
      );

      expect(offenders).toEqual([]);
    });
  }
});
