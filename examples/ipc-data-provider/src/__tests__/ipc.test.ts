import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

// The example is a script: it runs its round trip and exits 1 on unexpected data, so it is run as one.
describe('the IPC data provider', () => {
  test('lists, reads and signs in over the in-memory transport', () => {
    const run = Bun.spawnSync(['bun', 'src/index.ts'], {
      cwd: resolve(import.meta.dir, '..', '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(run.stderr.toString()).toBe('');
    expect(run.stdout.toString()).toContain('[ipc] OK');
    expect(run.exitCode).toBe(0);
  });
});
