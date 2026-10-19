/**
 * The example gates. The examples are templates that carry their own package.json scripts, so make
 * does not drive them: CI and the pre-commit hook call this script next to `make lint-all`.
 * Every command needs a build: an example resolves the packages through their dist (B-05).
 *
 *   bun scripts/examples.ts check       lint and typecheck - the pre-commit gate
 *   bun scripts/examples.ts lint        every example's `lint` script
 *   bun scripts/examples.ts typecheck   every example's `typecheck` script
 *   bun scripts/examples.ts build       every example's `build` script (typecheck, then vite build) - CI
 */

/** Runs one command with the terminal attached; resolves to its exit code. */
const run = async (opts: { command: string[] }): Promise<number> => {
  const proc = Bun.spawn(opts.command, { stdout: 'inherit', stderr: 'inherit' });
  return proc.exited;
};

const lint = async (): Promise<number> => {
  console.log('🔍 Linting all examples...');
  return run({ command: ['bun', 'run', '--filter', './examples/*', 'lint'] });
};

// oxlint and oxfmt do not typecheck, and no example is in `make build-all`.
const typecheck = async (): Promise<number> => {
  console.log('🔍 Typechecking all examples...');
  return run({ command: ['bun', 'run', '--filter', './examples/*', 'typecheck'] });
};

const build = async (): Promise<number> => {
  console.log('🔍 Building all examples against the built packages...');
  return run({ command: ['bun', 'run', '--filter', './examples/*', 'build'] });
};

/** Runs each step in order and stops at the first that fails. */
const series = async (steps: Array<() => Promise<number>>): Promise<number> => {
  for (const step of steps) {
    const code = await step();
    if (code !== 0) {
      return code;
    }
  }
  return 0;
};

const COMMANDS: Record<string, () => Promise<number>> = {
  check: () => series([lint, typecheck]),
  lint,
  typecheck,
  build,
};

const name = process.argv[2] ?? '';
const command = COMMANDS[name];
if (!command) {
  console.error(
    `[examples] Unknown command "${name}" | Use one of: ${Object.keys(COMMANDS).join(', ')}`,
  );
  process.exit(1);
}

process.exit(await command());

export {};
