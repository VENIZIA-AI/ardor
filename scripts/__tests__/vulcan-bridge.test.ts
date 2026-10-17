import { describe, expect, test } from 'bun:test';
import { resolveCommand } from '../vulcan-bridge';

describe('resolveCommand', () => {
  test('okf runs the ARDOR generator, with --strict folded into its full check', () => {
    expect(resolveCommand({ args: ['x', 'okf', 'gen'] })).toEqual([
      'bun',
      '.agents/knowledge-tools/okf.ts',
      'gen',
    ]);
    expect(resolveCommand({ args: ['x', 'okf', 'check', '--strict'] })).toEqual([
      'bun',
      '.agents/knowledge-tools/okf.ts',
      'check',
    ]);
  });

  test('each atlas table runs the ARDOR script that owns it', () => {
    expect(resolveCommand({ args: ['x', 'atlas', 'surface', 'check'] })).toEqual([
      'bun',
      'scripts/public-surface.ts',
      'check',
    ]);
    expect(resolveCommand({ args: ['x', 'atlas', 'symbols', 'gen'] })).toEqual([
      'bun',
      'scripts/atlas-symbols.ts',
      'gen',
    ]);
    expect(resolveCommand({ args: ['x', 'atlas', 'releases', 'check'] })).toEqual([
      'bun',
      'scripts/atlas-releases.ts',
      'check',
    ]);
  });

  test('every other command goes to VULCAN unchanged', () => {
    expect(resolveCommand({ args: ['sync'] })).toEqual([
      'bun',
      'x',
      '--no-install',
      'vulcan',
      'sync',
    ]);
    expect(resolveCommand({ args: ['doctor'] })).toEqual([
      'bun',
      'x',
      '--no-install',
      'vulcan',
      'doctor',
    ]);
    expect(resolveCommand({ args: ['x', 'atlas', 'mcp'] })).toEqual([
      'bun',
      'x',
      '--no-install',
      'vulcan',
      'x',
      'atlas',
      'mcp',
    ]);
  });
});
