/**
 * Run INSIDE a sandbox: loads the sub-path as an application does, then fails if any module came
 * from outside the sandbox (this repository's `node_modules` sits above it).
 *
 * Usage: bun bun-probe.ts <specifier>   (cwd = the sandbox)
 */
import { realpathSync } from 'node:fs';
import { sep } from 'node:path';

const sandbox = realpathSync(process.cwd());

// Resolved from the sandbox: this file lives in the repository, whose `node_modules` would answer.
await import(Bun.resolveSync('reflect-metadata', sandbox));
await import(Bun.resolveSync(process.argv[2], sandbox));

const outside = Object.keys(require.cache).filter((file) => {
  const real = realpathSync(file);
  return real !== sandbox && !real.startsWith(sandbox + sep);
});

if (outside.length > 0) {
  console.error(`error: ${process.argv[2]} loaded outside the sandbox: ${outside[0]}`);
  process.exit(1);
}
