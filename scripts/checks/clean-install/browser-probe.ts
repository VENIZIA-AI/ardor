/**
 * Run INSIDE a sandbox: builds one entry for the browser with every import held to the sandbox.
 *
 * Usage: bun browser-probe.ts <entry> <outdir> [external ...]   (cwd = the sandbox)
 */
import { createSandboxGuard } from './sandbox-guard';

const [entry, outdir, ...external] = process.argv.slice(2);
const result = await Bun.build({
  entrypoints: [entry],
  outdir,
  target: 'browser',
  external,
  plugins: [createSandboxGuard({ sandbox: process.cwd() })],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(String(log));
  }
  process.exit(1);
}
