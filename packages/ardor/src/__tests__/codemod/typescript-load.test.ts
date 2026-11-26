import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const PACKAGE = join(import.meta.dir, '..', '..', '..');

// A process of its own: the broken `typescript` would otherwise stay for every later test.
const SCRIPT = `
  Bun.plugin({
    name: 'broken-typescript',
    setup(build) {
      build.module('typescript', () => {
        throw new Error('broken' + String.fromCharCode(27) + '[31m install');
      });
    },
  });
  const { CodemodCommand } = await import('./src/codemod/command.ts');
  const spec = { name: 'x', usage: 'Usage', unit: 'use', extraFlags: [], isDetectOnly: false, transform: () => undefined };
  process.exit(await CodemodCommand.run({ root: process.cwd(), args: [], spec }));
`;

describe('a typescript that does not load', () => {
  test('is reported with its reason, control characters replaced, before the way to install it', () => {
    const run = Bun.spawnSync([process.execPath, '-e', SCRIPT], {
      cwd: PACKAGE,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stderr = run.stderr.toString();

    expect(stderr).toContain('ardor codemod: "typescript" did not load: broken?[31m install');
    expect(stderr.indexOf('did not load')).toBeLessThan(
      stderr.indexOf('the "typescript" package is not installed here'),
    );
    expect(run.exitCode).toBe(2);
  });
});
