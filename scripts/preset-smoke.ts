/**
 * Proves the packed VULCAN preset of @venizia/ardor makes a green app, from outside this repository:
 * every package is packed, the preset is read from the extracted tarball, and the app is created,
 * installed and checked in a temp folder, so nothing works only because this repo hoists it.
 *
 *   solo      `vulcan init --preset ardor`: the app passes its checks and builds; no `{{` is left
 *   refusal   `vulcan add --preset ardor` into a catalog pinning an IGNIS outside ARDOR's peer range
 *   pair      IGNIS backends from `IGNIS_DIR`, then `vulcan add --preset ardor --api <backend>`; the
 *             proxy targets that backend's port. Skipped when IGNIS_DIR is not set.
 *
 * Needs `make build-all` first (a package is packed with its dist).
 *
 * Usage: bun scripts/preset-smoke.ts [solo|refusal|pair]   (default: every scenario that can run)
 * Env:   VULCAN_CMD  how to run VULCAN (default `bun x @venizia/vulcan@latest`; before VULCAN 0.3.0 is
 *                    on npm: `bun <vulcan checkout>/packages/cli/src/cli.ts`)
 *        VULCAN_TGZ  comma-separated packed tarballs of @venizia/vulcan, vulcan-atlas and vulcan-okf,
 *                    used instead of the registry's
 *        IGNIS_DIR   an IGNIS checkout, built (read only: it is only packed)
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SCENARIOS = ['solo', 'refusal', 'pair'] as const;

type TScenario = (typeof SCENARIOS)[number];
type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = (opts: { path: string }): TRecord => {
  const value: unknown = JSON.parse(readFileSync(opts.path, 'utf8'));

  if (!isRecord(value)) {
    throw new Error(`[readJson] ${opts.path} | expected a JSON object`);
  }

  return value;
};

const tempFolder = mkdtempSync(join(tmpdir(), 'ardor-preset-smoke-'));
let step = 0;

/** Runs one command; a non-zero exit stops the smoke with the command, its folder and its output. */
const run = (opts: {
  cwd: string;
  command: string[];
  env?: Record<string, string>;
  expectFailure?: boolean;
}): { code: number; output: string } => {
  step += 1;
  const proc = Bun.spawnSync(opts.command, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  const label = `${String(step).padStart(2, '0')} ${opts.command.join(' ')}`;

  writeFileSync(
    join(tempFolder, `step-${String(step).padStart(2, '0')}.log`),
    `$ ${label}\n${output}`,
  );

  if ((proc.exitCode === 0) === (opts.expectFailure === true)) {
    throw new Error(
      `[preset-smoke] ${opts.expectFailure ? 'expected a failure' : `exit ${proc.exitCode}`} | ${label}\n  in ${opts.cwd}\n${output.split('\n').slice(-40).join('\n')}`,
    );
  }

  console.log(`  ok  ${label}${opts.expectFailure ? ' (refused, as expected)' : ''}`);

  return { code: proc.exitCode, output };
};

/** A first run is silent: a line with `(!)` or "warning" is something a new user should never see. */
const WARNING = /\(!\)|warning/i;

const assertNoWarnings = (opts: { output: string; label: string }) => {
  const lines = opts.output.split('\n').filter((line) => WARNING.test(line));

  assert({
    condition: lines.length === 0,
    message: `${opts.label} prints no warning${lines.length === 0 ? '' : ` | ${lines.join(' | ')}`}`,
  });
};

const assert = (opts: { condition: boolean; message: string }) => {
  if (!opts.condition) {
    throw new Error(`[preset-smoke] assertion failed | ${opts.message}`);
  }

  console.log(`  ok  ${opts.message}`);
};

/** Packs every publishable package under `directory/packages`; returns name to tarball. */
const packAll = (opts: { directory: string; destination: string }): Map<string, string> => {
  const packed = new Map<string, string>();

  mkdirSync(opts.destination, { recursive: true });

  for (const entry of readdirSync(join(opts.directory, 'packages'))) {
    const manifestPath = join(opts.directory, 'packages', entry, 'package.json');

    if (!existsSync(manifestPath)) {
      continue;
    }

    const manifest = readJson({ path: manifestPath });

    if (manifest.private === true || typeof manifest.name !== 'string') {
      continue;
    }

    const { output } = run({
      cwd: join(opts.directory, 'packages', entry),
      command: ['bun', 'pm', 'pack', '--quiet', '--destination', opts.destination],
    });

    packed.set(manifest.name, output.trim().split('\n').at(-1) ?? '');
  }

  return packed;
};

/** Extracts a packed tarball; the package is at `<destination>/package`. */
const extract = (opts: { tarball: string; destination: string }): string => {
  mkdirSync(opts.destination, { recursive: true });
  run({ cwd: opts.destination, command: ['tar', '-xzf', opts.tarball] });

  return join(opts.destination, 'package');
};

/** The name in a tarball's package.json. */
const packageNameOf = (opts: { tarball: string }): string => {
  const proc = Bun.spawnSync(['tar', '-xOzf', opts.tarball, 'package/package.json']);
  const { name } = JSON.parse(proc.stdout.toString());

  if (typeof name !== 'string') {
    throw new Error(`[preset-smoke] no package name in ${opts.tarball}`);
  }

  return name;
};

const vulcanCommand = (): string[] =>
  (process.env.VULCAN_CMD ?? 'bun x @venizia/vulcan@latest').split(/\s+/).filter(Boolean);

const vulcan = (opts: {
  cwd: string;
  args: string[];
  env?: Record<string, string>;
  expectFailure?: boolean;
}) =>
  run({
    cwd: opts.cwd,
    command: [...vulcanCommand(), ...opts.args],
    env: opts.env,
    expectFailure: opts.expectFailure,
  });

const NO_INSTALL = { VULCAN_NO_INSTALL: '1' };

/** Root `overrides`: bun applies a `file:` override to a transitive dependency too. */
const addOverrides = (opts: { project: string; tarballs: Map<string, string> }) => {
  const path = join(opts.project, 'package.json');
  const manifest = readJson({ path });
  const overrides = Object.fromEntries(
    [...opts.tarballs].map(([name, tarball]) => [name, `file:${tarball}`]),
  );

  writeFileSync(path, `${JSON.stringify({ ...manifest, overrides }, null, 2)}\n`);
};

const checksOf = (opts: { presetRoot: string }): string[] => {
  const { checks } = readJson({ path: join(opts.presetRoot, 'dist/vulcan-preset/preset.json') });

  return Array.isArray(checks) ? checks.map(String) : [];
};

/** install, sync, each app's checks, then the project's own contract. */
const freePort = (): number => {
  const server = Bun.serve({ port: 0, fetch: () => new Response('') });
  const { port } = server;

  void server.stop(true);

  return port as number;
};

/**
 * Starts the app's `dev` script on a free port, loads the page and its entry module, and checks
 * the server's output: the first run of a new project prints no warning.
 */
const assertDevServer = async (opts: { cwd: string }) => {
  step += 1;
  const port = freePort();
  const proc = Bun.spawn(['bun', 'run', 'dev'], {
    cwd: opts.cwd,
    env: { ...process.env, PORT: String(port) },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  let output = '';
  const decoder = new TextDecoder();
  const collect = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) {
      output += decoder.decode(chunk);
    }
  };

  void collect(proc.stdout);
  void collect(proc.stderr);

  const deadline = Date.now() + 60_000;

  while (!output.includes(`:${port}`) && Date.now() < deadline) {
    await Bun.sleep(200);
  }

  try {
    for (const path of ['/', '/src/main.tsx']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);

      assert({
        condition: response.ok,
        message: `the dev server answers ${path} (${response.status})`,
      });
    }

    // Dependency pre-bundling and reloads print on the first request, so wait for them.
    await Bun.sleep(2_000);
  } finally {
    proc.kill();
    await proc.exited;
  }

  writeFileSync(join(tempFolder, `step-${String(step).padStart(2, '0')}.log`), output);
  assert({ condition: output.includes(`:${port}`), message: `the dev server listens on :${port}` });
  assertNoWarnings({ output, label: 'bun run dev' });
};

const install = async (opts: {
  project: string;
  apps: Array<{ folder: string; checks: string[]; firstRun?: boolean }>;
}) => {
  run({ cwd: opts.project, command: ['bun', 'install'] });
  run({
    cwd: opts.project,
    command: ['bun', join(opts.project, 'node_modules/.bin/vulcan'), 'sync'],
  });

  for (const app of opts.apps) {
    for (const check of app.checks) {
      const { output } = run({
        cwd: join(opts.project, app.folder),
        command: ['bun', 'run', check],
      });

      if (app.firstRun === true && check === 'build') {
        assertNoWarnings({ output, label: 'bun run build' });
      }
    }

    if (app.firstRun === true) {
      await assertDevServer({ cwd: join(opts.project, app.folder) });
    }
  }

  run({
    cwd: opts.project,
    command: ['bun', join(opts.project, 'node_modules/.bin/vulcan'), 'doctor'],
  });
  run({
    cwd: opts.project,
    command: [
      'bun',
      join(opts.project, 'node_modules/.bin/vulcan'),
      'x',
      'okf',
      'check',
      '--strict',
    ],
  });
};

/** Every file under `folder` (node_modules and dist left out) that still holds a `{{` token. */
const unsubstituted = (opts: { folder: string }): string[] =>
  readdirSync(opts.folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !/[\\/](node_modules|dist)[\\/]/.test(path))
    .filter((path) => readFileSync(path, 'utf8').includes('{{'));

const main = async () => {
  const requested = process.argv[2];

  if (requested !== undefined && !SCENARIOS.includes(requested as TScenario)) {
    throw new Error(
      `[preset-smoke] unknown scenario "${requested}" | use one of ${SCENARIOS.join(', ')}`,
    );
  }

  const scenarios = SCENARIOS.filter((name) => requested === undefined || requested === name);
  const ignisDirectory = process.env.IGNIS_DIR;
  const vulcanTarballs = (process.env.VULCAN_TGZ ?? '').split(',').filter(Boolean);

  console.log('preset smoke: pack the packages and read the preset from the tarball');
  run({ cwd: ROOT, command: ['make', 'preset-build'] });
  const tarballs = packAll({ directory: ROOT, destination: join(tempFolder, 'tgz') });
  const ardorTarball = tarballs.get('@venizia/ardor');

  if (ardorTarball === undefined) {
    throw new Error('[preset-smoke] @venizia/ardor was not packed');
  }

  const presetRoot = extract({ tarball: ardorTarball, destination: join(tempFolder, 'preset') });
  const ardorChecks = checksOf({ presetRoot });
  const ownTarballs = new Map([
    ...tarballs,
    ...vulcanTarballs.map((tarball): [string, string] => [packageNameOf({ tarball }), tarball]),
  ]);

  if (scenarios.includes('solo')) {
    console.log('\nscenario solo: vulcan init --preset ardor');
    const work = join(tempFolder, 'solo');

    mkdirSync(work, { recursive: true });
    vulcan({
      cwd: work,
      env: NO_INSTALL,
      args: [
        'init',
        '--preset',
        `file:${presetRoot}`,
        '--project',
        'demo',
        '--frontend-dir',
        'apps',
        '--app',
        'admin',
      ],
    });
    const project = join(work, 'demo');

    addOverrides({ project, tarballs: ownTarballs });
    await install({
      project,
      apps: [{ folder: 'apps/admin', checks: ardorChecks, firstRun: true }],
    });
    assert({
      condition: !existsSync(join(project, 'apps/admin/_env.example')),
      message: '_env.example is renamed',
    });
    assert({
      condition:
        readFileSync(join(project, 'apps/admin/.env.example'), 'utf8').trim() === 'PORT=5173',
      message: '.env.example holds PORT=5173',
    });
    assert({
      condition: unsubstituted({ folder: join(project, 'apps/admin') }).length === 0,
      message: 'no file of the app still holds a {{ token',
    });
    assert({
      condition: existsSync(join(project, 'apps/admin/dist/index.html')),
      message: 'vite build wrote dist/index.html',
    });
  }

  if (scenarios.includes('refusal')) {
    console.log('\nscenario refusal: a catalog IGNIS outside the peer range');
    const work = join(tempFolder, 'refusal');

    mkdirSync(work, { recursive: true });
    vulcan({
      cwd: work,
      env: NO_INSTALL,
      args: [
        'init',
        '--preset',
        `file:${presetRoot}`,
        '--project',
        'demo',
        '--frontend-dir',
        'apps',
        '--app',
        'admin',
      ],
    });
    const project = join(work, 'demo');
    const manifestPath = join(project, 'package.json');
    const manifest = readJson({ path: manifestPath });
    const workspaces = isRecord(manifest.workspaces) ? manifest.workspaces : {};
    const catalog = isRecord(workspaces.catalog) ? workspaces.catalog : {};

    writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, workspaces: { ...workspaces, catalog: { ...catalog, '@venizia/ignis-kernel': '0.1.0' } } }, null, 2)}\n`,
    );

    const { output } = vulcan({
      cwd: project,
      env: NO_INSTALL,
      expectFailure: true,
      args: [
        'add',
        '--preset',
        `file:${presetRoot}`,
        '--frontend-dir',
        'apps',
        '--app',
        'second',
        '--no-api',
      ],
    });
    const peers = readJson({ path: join(presetRoot, 'dist/vulcan-preset/preset.json') }).peers;
    const range = isRecord(peers) ? String(peers['@venizia/ignis-kernel']) : '';

    assert({
      condition:
        output.includes('@venizia/ignis-kernel') &&
        output.includes('0.1.0') &&
        output.includes(range) &&
        range !== '',
      message: `add refuses, naming the catalog's 0.1.0 and the preset's ${range}`,
    });
    assert({
      condition: !existsSync(join(project, 'apps/second')),
      message: 'the refused add wrote nothing',
    });
  }

  if (scenarios.includes('pair')) {
    if (ignisDirectory === undefined) {
      console.log('\nscenario pair: skipped, IGNIS_DIR is not set');
    } else {
      console.log(
        '\nscenario pair: IGNIS backends, then vulcan add --preset ardor --api <backend>',
      );
      const ignisTarballs = packAll({
        directory: ignisDirectory,
        destination: join(tempFolder, 'ignis-tgz'),
      });
      const ignisTarball = ignisTarballs.get('@venizia/ignis');

      if (ignisTarball === undefined) {
        throw new Error('[preset-smoke] @venizia/ignis was not packed from IGNIS_DIR');
      }

      const ignisRoot = extract({
        tarball: ignisTarball,
        destination: join(tempFolder, 'ignis-preset'),
      });
      const ignisChecks = checksOf({ presetRoot: ignisRoot });
      const work = join(tempFolder, 'pair');

      mkdirSync(work, { recursive: true });
      vulcan({
        cwd: work,
        env: NO_INSTALL,
        args: [
          'init',
          '--preset',
          `file:${ignisRoot}`,
          '--project',
          'demo',
          '--backend-dir',
          'services',
          '--app',
          'core-api',
        ],
      });
      const project = join(work, 'demo');

      vulcan({
        cwd: project,
        env: NO_INSTALL,
        args: [
          'add',
          '--preset',
          `file:${ignisRoot}`,
          '--backend-dir',
          'services',
          '--app',
          'billing-api',
        ],
      });
      vulcan({
        cwd: project,
        env: NO_INSTALL,
        args: [
          'add',
          '--preset',
          `file:${presetRoot}`,
          '--frontend-dir',
          'apps',
          '--app',
          'admin',
          '--api',
          'billing-api',
        ],
      });
      addOverrides({ project, tarballs: new Map([...ignisTarballs, ...ownTarballs]) });
      await install({
        project,
        apps: [
          { folder: 'services/core-api', checks: ignisChecks },
          { folder: 'services/billing-api', checks: ignisChecks },
          { folder: 'apps/admin', checks: ardorChecks, firstRun: true },
        ],
      });
      const port = readFileSync(join(project, 'services/billing-api/.env.example'), 'utf8').match(
        /PORT=(\d+)/,
      )?.[1];

      assert({ condition: port === '3001', message: 'the second backend took port 3001' });
      assert({
        condition: readFileSync(join(project, 'apps/admin/vite.config.mts'), 'utf8').includes(
          `'http://localhost:${port}'`,
        ),
        message: `apps/admin/vite.config.mts proxies /api to http://localhost:${port}`,
      });
    }
  }
};

try {
  await main();
  rmSync(tempFolder, { recursive: true, force: true });
  console.log('\npreset smoke OK');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(`\npreset smoke FAILED | kept for inspection: ${tempFolder}`);
  process.exit(1);
}
