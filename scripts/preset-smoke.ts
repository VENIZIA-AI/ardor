/**
 * Proves the packed VULCAN preset of @venizia/ardor makes a green app, from outside this repository:
 * every package is packed, the preset is read from the extracted tarball, and the app is created,
 * installed and checked in a temp folder, so nothing works only because this repo hoists it.
 *
 *   solo      `vulcan init --preset ardor`: the app passes its checks and builds; no `{{` is left. With a
 *             .env copied from .env.example it passes them again and the dev server reads PORT and API_URL
 *   refusal   `vulcan add --preset ardor` into a catalog pinning an IGNIS outside ARDOR's peer range
 *   pair      IGNIS backends, then `vulcan add --preset ardor --api <backend>`; the proxy targets that
 *             backend's port. The IGNIS preset is the one released on npm, or the one packed from `IGNIS_DIR`.
 *   lib       `vulcan add --preset ardor --lib merchant`: the package it makes passes its checks; `--lib`
 *             on a preset without a lib, and a bare `add` with no terminal, are refused and write nothing.
 *             Runs when asked for, or with VULCAN_LIB=1, because it needs a VULCAN that has `add --lib`.
 *   docker    the app's Dockerfile, built from the project root and run next to a stub backend: a build
 *             without a commit sha (none, HEAD, too short, not hex) stops, the image carries the commit as its
 *             revision label, and nginx serves the page, the SPA fallback, the hashed assets and `/api` through
 *             `API_UPSTREAM`; with an upstream that does not resolve it still starts and only `/api` is a 502; and
 *             `config.js` carries exactly the container's VITE_ variables, escaped, and never a secret. Runs
 *             where `docker` is installed (it is skipped elsewhere); the project's unreleased packages are
 *             copied into it (vendor/) because a Docker context cannot reach tarballs outside the project.
 *
 * Needs `make build-all` first (a package is packed with its dist).
 *
 * Usage: bun scripts/preset-smoke.ts [solo|refusal|pair|lib|docker]   (default: every scenario that can run)
 * Env:   VULCAN_CMD  how to run VULCAN (default `bun x @venizia/vulcan@latest`; before VULCAN 0.3.0 is
 *                    on npm: `bun <vulcan checkout>/packages/cli/src/cli.ts`)
 *        VULCAN_TGZ  comma-separated packed tarballs of @venizia/vulcan, vulcan-atlas and vulcan-okf,
 *                    used instead of the registry's
 *        IGNIS_DIR   an IGNIS checkout, built (read only: it is only packed), for the pair scenario; without it
 *                    the pair scenario takes the latest @venizia/ignis from the registry
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { chromium } from 'playwright-core';

import { isTarballLag, TARBALL_LAG_DELAYS_SECONDS } from './release-gates';

const ROOT = resolve(import.meta.dir, '..');
const SCENARIOS = ['solo', 'refusal', 'pair', 'lib', 'docker'] as const;

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
  /** Written to the command's stdin; none by default. */
  input?: string;
}): { code: number; output: string } => {
  step += 1;
  const spawn = () => {
    const spawned = Bun.spawnSync(opts.command, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdin: opts.input === undefined ? undefined : Buffer.from(opts.input),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    return { proc: spawned, output: `${spawned.stdout.toString()}${spawned.stderr.toString()}` };
  };
  let attempt = spawn();

  // A fresh @venizia version resolves minutes before its tarball does: retry only that 404.
  for (const seconds of TARBALL_LAG_DELAYS_SECONDS) {
    if (attempt.proc.exitCode === 0 || !isTarballLag({ output: attempt.output })) {
      break;
    }

    console.log(
      `  ..  ${opts.command.join(' ')}: a @venizia tarball is not served yet (404), retrying in ${seconds}s`,
    );
    Bun.sleepSync(seconds * 1000);
    attempt = spawn();
  }

  const { proc, output } = attempt;
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

/**
 * A first run is silent: a line with `(!)`, "warning" or "Sourcemap for" (a package shipping sourcemaps
 * that point at files it does not ship, which Vite reports once per file) is something a new user should
 * never see.
 */
const WARNING = /\(!\)|warning|Sourcemap for/i;
// A CI runner colours the output (`localhost:\x1b[1m5173`), which would split a port from its colon.
const ANSI = /\x1b\[[0-9;]*m/g;

const assertNoWarnings = (opts: { output: string; label: string }) => {
  const lines = opts.output
    .replace(ANSI, '')
    .split('\n')
    .filter((line) => WARNING.test(line));

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

/**
 * A registry answer, tried again: the registry now and then answers a request with an HTML error page
 * or drops the connection, which would stop the whole smoke for a reason that is not the preset's.
 */
const fetchRegistry = async (opts: {
  url: string;
  accept: (body: Uint8Array) => boolean;
}): Promise<Uint8Array> => {
  let failure = 'no answer';

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(opts.url);
      const body = new Uint8Array(await response.arrayBuffer());

      if (response.ok && opts.accept(body)) {
        return body;
      }

      failure = `HTTP ${response.status}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    await Bun.sleep(5_000 * (attempt + 1));
  }

  throw new Error(`[preset-smoke] the registry did not answer ${opts.url} | ${failure}`);
};

/** The latest release of a package, downloaded from the registry as a tarball. */
const downloadLatest = async (opts: { name: string; destination: string }): Promise<string> => {
  const answer = await fetchRegistry({
    url: `https://registry.npmjs.org/${opts.name}/latest`,
    accept: (body) => {
      try {
        JSON.parse(new TextDecoder().decode(body));

        return true;
      } catch {
        return false;
      }
    },
  });
  const metadata: unknown = JSON.parse(new TextDecoder().decode(answer));
  const dist = isRecord(metadata) && isRecord(metadata.dist) ? metadata.dist : {};

  if (typeof dist.tarball !== 'string') {
    throw new Error(`[preset-smoke] no tarball for ${opts.name} in the registry`);
  }

  mkdirSync(opts.destination, { recursive: true });
  const path = join(
    opts.destination,
    `${opts.name.replace(/^@/, '').replace('/', '-')}-latest.tgz`,
  );

  writeFileSync(path, await fetchRegistry({ url: dist.tarball, accept: () => true }));

  return path;
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

/** Pins one package of the root catalog, the way a user moves the catalog first. */
const setCatalog = (opts: { project: string; name: string; version: string }) => {
  const path = join(opts.project, 'package.json');
  const manifest = readJson({ path });
  const workspaces = isRecord(manifest.workspaces) ? manifest.workspaces : {};
  const catalog = isRecord(workspaces.catalog) ? workspaces.catalog : {};

  writeFileSync(
    path,
    `${JSON.stringify({ ...manifest, workspaces: { ...workspaces, catalog: { ...catalog, [opts.name]: opts.version } } }, null, 2)}\n`,
  );
};

/** The range the built preset asks of `name` (its `peers`). */
const peerRange = (opts: { presetRoot: string; name: string }): string => {
  const peers = readJson({ path: appPresetPath({ presetRoot: opts.presetRoot }) }).peers;

  return isRecord(peers) ? String(peers[opts.name]) : '';
};

/** Root `overrides`: bun applies a `file:` override to a transitive dependency too. */
const addOverrides = (opts: {
  project: string;
  tarballs: Map<string, string>;
  /** Copy each tarball into `<project>/vendor/` and point at it with a relative path. */
  vendor?: boolean;
}) => {
  const path = join(opts.project, 'package.json');
  const manifest = readJson({ path });
  const place = (tarball: string): string => {
    if (opts.vendor !== true) {
      return `file:${tarball}`;
    }

    mkdirSync(join(opts.project, 'vendor'), { recursive: true });
    cpSync(tarball, join(opts.project, 'vendor', basename(tarball)));

    return `file:./vendor/${basename(tarball)}`;
  };
  const overrides = Object.fromEntries(
    [...opts.tarballs].map(([name, tarball]) => [name, place(tarball)]),
  );

  writeFileSync(path, `${JSON.stringify({ ...manifest, overrides }, null, 2)}\n`);
};

/** The preset file of a packed package: `dist/presets/<kind>/preset.json`. */
const presetPath = (opts: { presetRoot: string; kind: 'app' | 'lib' }): string =>
  join(opts.presetRoot, `dist/presets/${opts.kind}/preset.json`);

const appPresetPath = (opts: { presetRoot: string }): string =>
  presetPath({ presetRoot: opts.presetRoot, kind: 'app' });

const checksOf = (opts: { presetRoot: string; kind?: 'lib' }): string[] => {
  const { checks } = readJson({
    path: presetPath({ presetRoot: opts.presetRoot, kind: opts.kind ?? 'app' }),
  });

  return Array.isArray(checks) ? checks.map(String) : [];
};

/** install, sync, each app's checks, then the project's own contract. */
/**
 * The app resolves its own modules through package.json `imports` (`#src/*`), not an alias: no `@/`
 * import, no alias in the Vite config, no `paths` in the tsconfig, the field written by VULCAN, and the
 * class the Ignis artifacts plugin finds (`AdminConfiguration`) is in the built bundle.
 */
const assertSubpathImports = (opts: { directory: string }) => {
  const manifest = readJson({ path: join(opts.directory, 'package.json') });

  assert({
    condition:
      JSON.stringify(manifest.imports) ===
      JSON.stringify({ '#src/*.json': './src/*.json', '#src/*': './src/*.js' }),
    message: 'package.json imports #src/*.json and #src/*',
  });

  const sources = readdirSync(join(opts.directory, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'));

  assert({
    condition:
      sources.every((source) => !source.includes("from '@/")) &&
      sources.some((source) => source.includes("from '#src/")),
    message: 'every import of the app reads #src/..., none reads @/...',
  });
  assert({
    condition:
      !readFileSync(join(opts.directory, '.configs/builders/vite.config.mts'), 'utf8').includes(
        'alias',
      ) && !readFileSync(join(opts.directory, 'tsconfig.json'), 'utf8').includes('"paths"'),
    message: 'no Vite alias and no tsconfig paths',
  });

  const bundle = readdirSync(join(opts.directory, 'dist/assets'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(opts.directory, 'dist/assets', file), 'utf8'))
    .join('\n');

  assert({
    condition: bundle.includes('AdminConfiguration'),
    message: 'the Ignis artifacts plugin found AdminConfiguration: it is in the built bundle',
  });
};

/** The script names every app has, and the ones no app has (Phat's standard, backend and frontend alike). */
const APP_SCRIPTS = ['server:dev', 'compile', 'typecheck', 'lint', 'lint:fix', 'test', 'clean'];
const FORBIDDEN_SCRIPTS = ['dev', 'start', 'build', 'rebuild', 'preview', 'api', 'server:prod'];

/** What may be at the root of an app: its own files, and what a tool writes there. */
const APP_ROOT = [
  '.configs',
  '.env.example',
  'dist',
  'node_modules',
  'package.json',
  'src',
  'tsconfig.json',
];

const assertRootLayout = (opts: { directory: string }) => {
  const extra = readdirSync(opts.directory).filter((name) => !APP_ROOT.includes(name));

  assert({
    condition: extra.length === 0,
    message: `nothing at the app root but .configs, src, package.json, tsconfig.json and .env.example (found also: ${extra.join(', ') || 'nothing'})`,
  });
  assert({
    condition: ['index.html'].every((file) => existsSync(join(opts.directory, 'src', file))),
    message: 'index.html is in src/',
  });
  assert({
    condition: ['Dockerfile', 'nginx.conf.template'].every((file) =>
      existsSync(join(opts.directory, '.configs/builders', file)),
    ),
    message: 'the Dockerfile and its nginx template are in .configs/builders/',
  });
};

const assertScriptStandard = (opts: { directory: string }) => {
  const scripts = Object.keys(
    (readJson({ path: join(opts.directory, 'package.json') }).scripts ?? {}) as TRecord,
  );

  assert({
    condition: APP_SCRIPTS.every((name) => scripts.includes(name)),
    message: `package.json has the standard scripts: ${APP_SCRIPTS.join(', ')}`,
  });
  assert({
    condition: !scripts.some((name) => FORBIDDEN_SCRIPTS.includes(name)),
    message: `package.json has none of: ${FORBIDDEN_SCRIPTS.join(', ')}`,
  });
};

const freePort = (): number => {
  const server = Bun.serve({ port: 0, fetch: () => new Response('') });
  const { port } = server;

  void server.stop(true);

  return port as number;
};

const HELLO = { message: 'Hello from IGNIS!' };

/**
 * Opens the app in headless Chrome and checks the page really runs: the app's name and the message of
 * `GET /api/hello` render, the stylesheet applies and follows the system's light and dark preference, nothing
 * throws or logs an error on the way, and when `/api/hello` fails the page says the backend is not reachable
 * and shows the command that starts it.
 * A dev server that answers 200 for every file proves none of that (a module that reads `process`
 * at import time answers 200 and leaves the page blank). The API is answered by the browser, not by
 * a server, so the check does not depend on the proxy target. `CHROME_BIN` names a Chrome or
 * Chromium binary; without it the installed Google Chrome is used.
 */
const assertPageRenders = async (opts: { port: number; name: string }) => {
  const executablePath = process.env.CHROME_BIN;
  const browser = await chromium.launch({
    executablePath,
    channel: executablePath === undefined ? 'chrome' : undefined,
  });
  const problems: string[] = [];

  try {
    const page = await browser.newPage();

    page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        problems.push(`console.error: ${message.text()}`);
      }
    });
    await page.route('**/api/hello', (route) => route.fulfill({ json: HELLO }));

    await page.goto(`http://localhost:${opts.port}/`);
    await page.getByRole('heading', { name: opts.name }).waitFor({ timeout: 30_000 });
    await page.getByText(HELLO.message).waitFor({ timeout: 10_000 });

    // Tailwind ran (the page background is a token, not the browser's transparent) and dark differs from light.
    const background = (): Promise<string> =>
      page.evaluate<string>('getComputedStyle(document.body).backgroundColor');

    await page.emulateMedia({ colorScheme: 'light' });
    const light = await background();

    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await background();

    if (light === 'rgba(0, 0, 0, 0)' || light === dark) {
      problems.push(`the stylesheet does not apply: background ${light} in light, ${dark} in dark`);
    }

    // The backend is down: one friendly line and the command, not an error screen. (The failed request
    // is logged by the browser itself, so this page is not held to "no console error".)
    const down = await browser.newPage();

    down.on('pageerror', (error) => problems.push(`uncaught (backend down): ${error.message}`));
    await down.route('**/api/hello', (route) =>
      route.fulfill({ status: 502, body: 'Bad Gateway' }),
    );
    await down.goto(`http://localhost:${opts.port}/`);
    await down.getByText(/not reachable/).waitFor({ timeout: 15_000 });
    await down.getByText('bun run server:dev').waitFor({ timeout: 5_000 });
  } catch (error) {
    problems.push(
      `the page did not render: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await browser.close();
  }

  assert({
    condition: problems.length === 0,
    message: `the page renders in a browser, with no uncaught error and no console error${problems.length === 0 ? '' : ` | ${problems.slice(0, 5).join(' | ').slice(0, 1500)}`}`,
  });
};

/**
 * Starts the app's `dev` script on a free port, loads the page and its entry module, and checks
 * the server's output: the first run of a new project prints no warning.
 */
const assertDevServer = async (opts: { cwd: string; envFile?: boolean }) => {
  step += 1;
  const port = freePort();
  const environment: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(port),
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };
  // With `envFile`, the port and the backend come from a .env copied from .env.example, not from the
  // process environment: the dev server must read the file, and forward /api to API_URL.
  const stub =
    opts.envFile === true ? Bun.serve({ port: 0, fetch: () => Response.json(HELLO) }) : undefined;
  const envPath = join(opts.cwd, '.env');

  if (stub !== undefined) {
    delete environment.PORT;
    writeFileSync(
      envPath,
      readFileSync(join(opts.cwd, '.env.example'), 'utf8')
        .replace(/^PORT=.*$/m, `PORT=${port}`)
        .replace(/^API_URL=.*$/m, `API_URL=http://127.0.0.1:${stub.port}`),
    );
  }

  const proc = Bun.spawn(['bun', 'run', 'server:dev'], {
    cwd: opts.cwd,
    env: environment,
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

  const plain = () => output.replace(ANSI, '');
  const collected = [collect(proc.stdout), collect(proc.stderr)];

  const deadline = Date.now() + 60_000;

  // Vite listens on `localhost`, which a CI runner may resolve to ::1 only; ask every address.
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  const answer = async (path: string): Promise<Response | undefined> => {
    for (const host of hosts) {
      try {
        return await fetch(`http://${host}:${port}${path}`);
      } catch {
        // not listening on this address (yet)
      }
    }

    return undefined;
  };

  try {
    // The page, and modules under the Vite root (src/): Vite resolves them to .ts and .tsx. Vite answers an
    // unknown path with the page (200), so a module must come back as JavaScript.
    for (const path of ['/', '/main.tsx', '/application.ts', '/pages/home.tsx', '/config.js']) {
      let response = await answer(path);

      while (response === undefined && Date.now() < deadline) {
        await Bun.sleep(250);
        response = await answer(path);
      }

      assert({
        condition:
          response?.ok === true &&
          (path === '/' || (response.headers.get('content-type') ?? '').includes('javascript')),
        message: `the dev server answers ${path} (${response?.status ?? `no answer; server output: ${output.split('\n').slice(-15).join(' | ')}`})`,
      });
    }

    if (stub !== undefined) {
      const forwarded = await answer('/api/hello');

      assert({
        condition: forwarded?.ok === true && (await forwarded.text()).includes(HELLO.message),
        message: 'the dev server read PORT and API_URL from .env and forwards /api to API_URL',
      });
    }

    await assertPageRenders({ port, name: basename(opts.cwd) });

    // Dependency pre-bundling and reloads print on the first request, so wait for them.
    await Bun.sleep(2_000);
  } finally {
    proc.kill();
    await proc.exited;
    stub?.stop(true);
    rmSync(envPath, { force: true });
    // The streams end with the process; read them to the end before judging the output.
    await Promise.all(collected);
  }

  writeFileSync(join(tempFolder, `step-${String(step).padStart(2, '0')}.log`), output);
  assert({
    condition: plain().includes(`:${port}`),
    message: `the dev server listens on :${port}${plain().includes(`:${port}`) ? '' : ` | server output (${output.length} bytes): ${[...plain().split('\n').slice(0, 8), '...', ...plain().split('\n').slice(-6)].join(' | ').slice(0, 1800)}`}`,
  });
  assertNoWarnings({ output, label: 'bun run server:dev' });
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

      if (app.firstRun === true && check === 'compile') {
        assertNoWarnings({ output, label: 'bun run compile' });
        assert({
          condition: existsSync(join(opts.project, app.folder, 'dist/index.html')),
          message: 'bun run compile wrote dist/index.html',
        });
        assertSubpathImports({ directory: join(opts.project, app.folder) });
      }
    }

    if (app.firstRun === true) {
      // The sh lint script checks and fixes: a badly formatted file fails `lint`, `lint:fix` repairs it,
      // and `lint` passes again.
      const unformatted = join(opts.project, app.folder, 'src/unformatted.ts');

      writeFileSync(unformatted, 'export const unformatted = {a:1,\n b:2};\n');

      try {
        const appDirectory = join(opts.project, app.folder);

        run({ cwd: appDirectory, command: ['bun', 'run', 'lint'], expectFailure: true });
        run({ cwd: appDirectory, command: ['bun', 'run', 'lint:fix'] });
        run({ cwd: appDirectory, command: ['bun', 'run', 'lint'] });
      } finally {
        rmSync(unformatted, { force: true });
      }

      // The typecheck must catch a type error: a planted one fails it, and it is removed again.
      const planted = join(opts.project, app.folder, 'src/planted.ts');

      writeFileSync(planted, "export const planted: number = 'not a number';\n");

      try {
        run({
          cwd: join(opts.project, app.folder),
          command: ['bun', 'run', 'typecheck'],
          expectFailure: true,
        });
      } finally {
        rmSync(planted, { force: true });
      }

      assertScriptStandard({ directory: join(opts.project, app.folder) });
      assertRootLayout({ directory: join(opts.project, app.folder) });
      await assertDevServer({ cwd: join(opts.project, app.folder) });

      // `clean` removes what `compile` wrote.
      run({ cwd: join(opts.project, app.folder), command: ['bun', 'run', 'clean'] });
      assert({
        condition: !existsSync(join(opts.project, app.folder, 'dist')),
        message: 'bun run clean removed dist',
      });
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

  // `lib` needs a VULCAN with `add --lib`: it is not in the default run until that is the published one.
  // Bun throws when the executable is not there at all.
  const hasDocker = ((): boolean => {
    try {
      return (
        Bun.spawnSync(['docker', 'version', '--format', '{{.Server.Version}}'], {
          stdout: 'ignore',
          stderr: 'ignore',
        }).exitCode === 0
      );
    } catch {
      return false;
    }
  })();
  const scenarios = SCENARIOS.filter((name) => {
    if (requested !== undefined) {
      return requested === name;
    }

    return name === 'docker' ? hasDocker : name !== 'lib' || process.env.VULCAN_LIB === '1';
  });
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
    const appFolder = join(project, 'apps/admin');
    const envExample = readFileSync(join(appFolder, '.env.example'), 'utf8');
    const viteConfig = readFileSync(join(appFolder, '.configs/builders/vite.config.mts'), 'utf8');
    const appSource = readdirSync(join(appFolder, 'src'), { recursive: true, withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts'),
      )
      .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
      .join('\n');
    const envKeys = [...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]!);

    assert({
      condition:
        /^PORT=5173$/m.test(envExample) &&
        envKeys.includes('API_URL') &&
        envKeys.includes('VITE_API_URL'),
      message: '.env.example holds PORT=5173, API_URL and VITE_API_URL',
    });
    assert({
      condition: envKeys.every(
        (key) => viteConfig.includes(`env.${key}`) || appSource.includes(`'${key}'`),
      ),
      message: `every key of .env.example is read by the app (${envKeys.join(', ')})`,
    });
    assert({
      condition: ['lints', 'formatters'].every((folder) => {
        const lines = readFileSync(join(appFolder, '.configs', folder, '.ignore'), 'utf8')
          .split('\n')
          .filter((line) => line.trim() !== '');

        return lines.length > 0 && lines.every((line) => line.startsWith('#'));
      }),
      message: '.configs/lints/.ignore and .configs/formatters/.ignore hold only comment lines',
    });

    // The same checks and the dev server with a .env copied from .env.example (removed again afterwards,
    // as the docker build refuses an app folder that holds one).
    copyFileSync(join(appFolder, '.env.example'), join(appFolder, '.env'));

    try {
      for (const check of ardorChecks) {
        run({ cwd: appFolder, command: ['bun', 'run', check] });
      }
    } finally {
      rmSync(join(appFolder, '.env'), { force: true });
    }

    await assertDevServer({ cwd: appFolder, envFile: true });
    assert({ condition: !existsSync(join(appFolder, '.env')), message: 'the smoke left no .env' });
    assert({
      condition: unsubstituted({ folder: join(project, 'apps/admin') }).length === 0,
      message: 'no file of the app still holds a {{ token',
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

    setCatalog({ project, name: '@venizia/ignis-kernel', version: '0.1.0' });

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
    const range = peerRange({ presetRoot, name: '@venizia/ignis-kernel' });

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

  if (scenarios.includes('lib')) {
    console.log('\nscenario lib: vulcan add --preset ardor --lib merchant');
    const work = join(tempFolder, 'lib');

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

    // Neither flag and no terminal: refused, and nothing is written.
    const before = readdirSync(project).sort().join(',');
    const bare = vulcan({
      cwd: project,
      env: NO_INSTALL,
      expectFailure: true,
      args: ['add', '--preset', `file:${presetRoot}`],
    });

    assert({
      condition: bare.code === 1 && readdirSync(project).sort().join(',') === before,
      message:
        'add with neither --app nor --lib and no terminal is refused (exit 1) and writes nothing',
    });

    // `--lib` on a preset that carries no lib: refused, and nothing is written.
    const withoutLib = join(tempFolder, 'preset-without-lib');

    cpSync(presetRoot, withoutLib, { recursive: true });
    const manifestPath = join(withoutLib, 'package.json');
    const manifest = readJson({ path: manifestPath });
    const declared = isRecord(manifest.vulcan) ? manifest.vulcan : {};
    const { lib: _lib, ...presetsField } = isRecord(declared.presets) ? declared.presets : {};

    writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, vulcan: { ...declared, presets: presetsField } }, null, 2)}\n`,
    );
    const refused = vulcan({
      cwd: project,
      env: NO_INSTALL,
      expectFailure: true,
      args: ['add', '--preset', `file:${withoutLib}`, '--lib', 'merchant', '--dir', 'libs'],
    });

    assert({
      condition: refused.code === 1 && !existsSync(join(project, 'libs')),
      message: 'add --lib on a preset without a lib is refused (exit 1) and writes nothing',
    });

    vulcan({
      cwd: project,
      env: NO_INSTALL,
      args: [
        'add',
        '--preset',
        `file:${presetRoot}`,
        '--lib',
        'merchant',
        '--dir',
        'libs',
        '--scope',
        '@acme',
      ],
    });
    const lib = join(project, 'libs/merchant');
    const manifestOfLib = readJson({ path: join(lib, 'package.json') });
    const scripts = isRecord(manifestOfLib.scripts)
      ? Object.keys(manifestOfLib.scripts).sort()
      : [];
    const peerNames = isRecord(manifestOfLib.peerDependencies)
      ? Object.keys(manifestOfLib.peerDependencies)
      : [];
    const importsOfLib = isRecord(manifestOfLib.imports) ? Object.keys(manifestOfLib.imports) : [];
    const exportsOfLib = isRecord(manifestOfLib.exports) ? manifestOfLib.exports : {};

    assert({
      condition: manifestOfLib.name === '@acme/merchant',
      message: 'the package is named @acme/merchant',
    });
    assert({
      condition: exportsOfLib['.'] === './src/index.ts',
      message: 'exports "." is ./src/index.ts',
    });
    assert({
      condition: importsOfLib.includes('#src/*'),
      message: 'imports has #src/*',
    });
    assert({
      condition: [
        '@venizia/ardor',
        'react',
        'react-dom',
        'react-router-dom',
        'reflect-metadata',
      ].every((name) => peerNames.includes(name)),
      message:
        '@venizia/ardor, react, react-dom, react-router-dom and reflect-metadata are peer dependencies',
    });
    assert({
      condition: scripts.join(',') === ['clean', 'lint', 'lint:fix', 'test', 'typecheck'].join(','),
      message: `the scripts are exactly typecheck, lint, lint:fix, test and clean (found ${scripts.join(', ')})`,
    });
    assert({
      condition: ['.configs/builders', 'index.html', '.env.example'].every(
        (file) => !existsSync(join(lib, file)),
      ),
      message: 'the library has no builders folder (no vite config), no html and no dev port',
    });
    assert({
      condition: ['lints', 'formatters'].every((folder) =>
        existsSync(join(lib, '.configs', folder, '.ignore')),
      ),
      message: "the library shares the app's lint and formatter ignore files",
    });
    assert({
      condition: unsubstituted({ folder: lib }).length === 0,
      message: 'no file of the library still holds a {{ token',
    });

    const libChecks = checksOf({ presetRoot, kind: 'lib' });

    addOverrides({ project, tarballs: ownTarballs });
    await install({
      project,
      apps: [
        { folder: 'apps/admin', checks: ardorChecks },
        { folder: 'libs/merchant', checks: libChecks },
      ],
    });
  }

  if (scenarios.includes('docker')) {
    console.log('\nscenario docker: build and run the app image next to a stub backend');
    const work = join(tempFolder, 'docker');

    mkdirSync(work, { recursive: true });

    if (!hasDocker) {
      throw new Error('[preset-smoke] scenario docker needs docker, which is not installed here');
    }

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
        'web',
      ],
    });
    const project = join(work, 'demo');

    addOverrides({ project, tarballs: ownTarballs, vendor: true });
    // A preset read from a file leaves the catalog pointing at the extracted package: make it the vendored one.
    setCatalog({
      project,
      name: '@venizia/ardor',
      version: `file:./vendor/${basename(ardorTarball)}`,
    });
    run({ cwd: project, command: ['bun', 'install'] });
    assert({
      condition: !readFileSync(join(project, 'bun.lock'), 'utf8').includes(`file:${tempFolder}`),
      message: 'the lockfile points at vendor/, not at a path outside the project',
    });
    assert({
      condition: existsSync(join(project, '.dockerignore')),
      message: 'the project has a .dockerignore',
    });

    const dockerfile = 'apps/web/.configs/builders/Dockerfile';
    const suffix = String(process.pid);
    const image = `ardor-smoke-web-${suffix}`;
    const network = `ardor-smoke-${suffix}`;
    const containers = [
      `ardor-smoke-api-${suffix}`,
      `ardor-smoke-web-${suffix}`,
      `ardor-smoke-orphan-${suffix}`,
      `ardor-smoke-config-${suffix}`,
    ];
    const commit = '0123456789abcdef0123456789abcdef01234567';
    const docker = (args: string[], failure = false) =>
      run({ cwd: project, command: ['docker', ...args], expectFailure: failure });

    try {
      // An environment file in the app must never reach the image: the Dockerfile stops a build whose
      // context holds one, and the .dockerignore VULCAN writes keeps it out of the context.
      writeFileSync(join(project, 'apps/web/.env'), 'SECRET=leak-me\n');
      const ignorePath = join(project, '.dockerignore');
      const generatedIgnore = readFileSync(ignorePath, 'utf8');

      writeFileSync(
        ignorePath,
        generatedIgnore
          .split('\n')
          .filter((line) => !line.includes('.env'))
          .join('\n'),
      );
      const leaking = docker(
        ['build', '-f', dockerfile, '-t', image, '--build-arg', `APP_BUILD_COMMIT=${commit}`, '.'],
        true,
      );

      assert({
        condition: leaking.output.includes('Secrets in the build context'),
        message:
          'a build whose context holds a .env stops, naming it (a .dockerignore without the env lines)',
      });
      writeFileSync(ignorePath, generatedIgnore);
      assert({
        condition:
          generatedIgnore.includes('**/.env') && generatedIgnore.includes('!**/.env.example'),
        message: 'the .dockerignore of the project keeps .env files out and .env.example in',
      });

      const unstamped = docker(['build', '-f', dockerfile, '-t', image, '.'], true);

      assert({
        condition: unstamped.output.includes('APP_BUILD_COMMIT'),
        message: 'a build without APP_BUILD_COMMIT stops and says to pass it',
      });
      for (const value of ['HEAD', 'abc123', 'ABCDEF1234', '0123456789abcdeg']) {
        const rejected = docker(
          ['build', '-f', dockerfile, '-t', image, '--build-arg', `APP_BUILD_COMMIT=${value}`, '.'],
          true,
        );

        assert({
          condition: rejected.output.includes(`after a first commit; got: ${value}`),
          message: `a build whose commit is "${value}" (not a sha of 7 or more hex digits) stops`,
        });
      }
      docker([
        'build',
        '-f',
        dockerfile,
        '-t',
        image,
        '--build-arg',
        `APP_BUILD_COMMIT=${commit}`,
        '--build-arg',
        'APP_BUILD_BRANCH=smoke',
        '.',
      ]);
      const label = docker([
        'image',
        'inspect',
        image,
        '--format',
        '{{index .Config.Labels "org.opencontainers.image.revision"}}',
      ]);

      assert({
        condition: label.output.trim() === commit,
        message: 'the image carries the commit as org.opencontainers.image.revision',
      });

      // The builder layers hold no trace of the planted secret.
      docker([
        'build',
        '-f',
        dockerfile,
        '--target',
        'builder',
        '-t',
        `${image}-builder`,
        '--build-arg',
        `APP_BUILD_COMMIT=${commit}`,
        '.',
      ]);
      const searched = docker([
        'run',
        '--rm',
        `${image}-builder`,
        'sh',
        '-c',
        'grep -r leak-me . || true',
      ]);

      assert({
        condition: !searched.output.includes('leak-me'),
        message: 'the builder stage holds no copy of the planted .env',
      });

      docker(['network', 'create', network]);
      docker([
        'run',
        '-d',
        '--name',
        containers[0]!,
        '--network',
        network,
        '--network-alias',
        'api',
        'docker.io/oven/bun:1.4.3-alpine',
        'bun',
        '-e',
        `Bun.serve({ port: 3000, fetch: (request) => new URL(request.url).pathname === '/api/hello' ? Response.json({ message: 'Hello from IGNIS!' }) : new Response('not found', { status: 404 }) })`,
      ]);
      const port = freePort();

      docker([
        'run',
        '-d',
        '--name',
        containers[1]!,
        '--network',
        network,
        '-p',
        `${port}:8080`,
        '-e',
        'API_UPSTREAM=http://api:3000',
        image,
      ]);
      const get = async (path: string): Promise<Response> => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          try {
            return await fetch(`http://localhost:${port}${path}`);
          } catch {
            await Bun.sleep(500);
          }
        }

        throw new Error(`[preset-smoke] the container did not answer ${path}`);
      };

      const index = await get('/');

      assert({
        condition: index.ok && (index.headers.get('content-type') ?? '').includes('text/html'),
        message: 'nginx serves the built index.html at /',
      });
      // The runtime config: with no VITE_ variable, config.js is an empty frozen object and is never cached.
      const bare = await get('/config.js');
      const evaluateConfig = (source: string): { config: unknown; frozen: boolean } => {
        const sandbox: { window: Record<string, unknown> } = { window: {} };

        runInNewContext(source, sandbox);

        return {
          config: sandbox.window.__APP_CONFIG__,
          frozen: Object.isFrozen(sandbox.window.__APP_CONFIG__),
        };
      };
      const bareConfig = evaluateConfig(await bare.text());

      assert({
        condition:
          bare.ok &&
          (bare.headers.get('cache-control') ?? '').includes('no-store') &&
          JSON.stringify(bareConfig.config) === '{}' &&
          bareConfig.frozen,
        message: 'config.js is an empty frozen object without VITE_ variables, and never cached',
      });
      const html = await index.text();

      // A classic script without async or defer runs while the page is parsed, before any module (which is
      // deferred), wherever the build put the module's tag.
      assert({
        condition: html.includes('<script src="/config.js"></script>'),
        message:
          'index.html loads config.js as a plain classic script, which runs before the deferred module',
      });
      const asset = /\/assets\/[^"]+\.js/.exec(html)?.[0] ?? '';
      const hello = await get('/api/hello');

      assert({
        condition: hello.ok && (await hello.text()).includes('Hello from IGNIS!'),
        message: '/api/hello reaches the backend through nginx',
      });
      const route = await get('/anything/not/a/file');

      assert({
        condition: route.ok && (await route.text()) === html,
        message: 'a route that is not a file answers with index.html',
      });
      const script = await get(asset);

      assert({
        condition: script.ok && (script.headers.get('cache-control') ?? '').includes('immutable'),
        message: 'a hashed asset is cached for good',
      });
      assert({
        condition: (await get('/assets/missing.js')).status === 404,
        message: 'a missing asset is a 404, not the page',
      });
      // The upstream does not resolve: the container still starts, the page answers, only /api is a 502.
      const orphanPort = freePort();

      docker([
        'run',
        '-d',
        '--name',
        containers[2]!,
        '--network',
        network,
        '-p',
        `${orphanPort}:8080`,
        '-e',
        'API_UPSTREAM=http://no-such-host.invalid:3000',
        image,
      ]);
      const orphan = async (path: string): Promise<Response> => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          try {
            return await fetch(`http://localhost:${orphanPort}${path}`);
          } catch {
            await Bun.sleep(500);
          }
        }

        throw new Error(`[preset-smoke] the container without an upstream did not answer ${path}`);
      };

      assert({
        condition: (await orphan('/')).status === 200,
        message: 'with an upstream that does not resolve, nginx starts and serves the page',
      });
      assert({
        condition: (await orphan('/api/hello')).status === 502,
        message: 'with an upstream that does not resolve, only /api answers 502',
      });

      // The VITE_ variables of the container reach the browser, escaped; nothing else does.
      const configuredPort = freePort();
      const hostile = '"; window.pwned = true; "\\ </script> \n end';

      docker([
        'run',
        '-d',
        '--name',
        containers[3]!,
        '--network',
        network,
        '-p',
        `${configuredPort}:8080`,
        '-e',
        'API_UPSTREAM=http://api:3000',
        '-e',
        'VITE_API_URL=https://api.example.com',
        '-e',
        `VITE_HOSTILE=${hostile}`,
        '-e',
        'SECRET_TOKEN=do-not-publish',
        '-e',
        'DATABASE_URL=postgres://user:do-not-publish@db/app',
        image,
      ]);
      let configured: Response | undefined;

      for (let attempt = 0; attempt < 40 && configured === undefined; attempt += 1) {
        try {
          configured = await fetch(`http://localhost:${configuredPort}/config.js`);
        } catch {
          await Bun.sleep(500);
        }
      }

      const configuredText = (await configured?.text()) ?? '';
      const published = evaluateConfig(configuredText);

      assert({
        condition:
          JSON.stringify(published.config) ===
            JSON.stringify({ VITE_API_URL: 'https://api.example.com', VITE_HOSTILE: hostile }) &&
          published.frozen,
        message:
          'config.js carries the VITE_ variables of the container, every value exactly as set',
      });
      assert({
        condition:
          !configuredText.includes('do-not-publish') && !configuredText.includes('SECRET_TOKEN'),
        message: 'config.js carries no variable outside the VITE_ prefix',
      });
      assert({
        condition: (configured?.headers.get('cache-control') ?? '').includes('no-store'),
        message: 'the written config.js is never cached either',
      });
      const refused = docker(['run', '--rm', '-e', 'VITE_DB_PASSWORD=do-not-publish', image], true);

      assert({
        condition:
          refused.output.includes('VITE_DB_PASSWORD') && !refused.output.includes('do-not-publish'),
        message:
          'a VITE_ variable named like a secret stops the container, naming it and not its value',
      });

      const user = docker(['exec', containers[1]!, 'id', '-u']);

      assert({ condition: user.output.trim() !== '0', message: 'nginx does not run as root' });
    } finally {
      Bun.spawnSync(['docker', 'rm', '-f', ...containers], { stdout: 'ignore', stderr: 'ignore' });
      Bun.spawnSync(['docker', 'network', 'rm', network], { stdout: 'ignore', stderr: 'ignore' });
      Bun.spawnSync(['docker', 'image', 'rm', '-f', image, `${image}-builder`], {
        stdout: 'ignore',
        stderr: 'ignore',
      });
    }
  }

  if (scenarios.includes('pair')) {
    {
      console.log(
        '\nscenario pair: IGNIS backends, then vulcan add --preset ardor --api <backend>',
      );
      const ignisTarballs =
        ignisDirectory === undefined
          ? new Map<string, string>()
          : packAll({ directory: ignisDirectory, destination: join(tempFolder, 'ignis-tgz') });
      const ignisTarball =
        ignisDirectory === undefined
          ? await downloadLatest({
              name: '@venizia/ignis',
              destination: join(tempFolder, 'ignis-tgz'),
            })
          : ignisTarballs.get('@venizia/ignis');

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
      // The preset's oxlint config imports a dev-configs subpath that 0.3.2 introduced, so it asks
      // for dev-configs ^0.3.2 and refuses a catalog that pins an older one. An IGNIS preset that
      // still pins an older dev-configs hits that refusal: the catalog moves first, as the message says.
      const devConfigs = '@venizia/dev-configs';
      const devConfigsRange = peerRange({ presetRoot, name: devConfigs });
      const pinned = String(
        (
          (readJson({ path: join(project, 'package.json') }).workspaces as TRecord | undefined)
            ?.catalog as TRecord | undefined
        )?.[devConfigs] ?? '',
      );

      if (!Bun.semver.satisfies(pinned.replace(/^[\^~]/, ''), devConfigsRange)) {
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
            'admin',
            '--no-api',
          ],
        });

        assert({
          condition:
            output.includes(devConfigs) &&
            output.includes(pinned) &&
            output.includes(devConfigsRange),
          message: `add refuses a catalog pinning ${devConfigs} ${pinned}, naming the preset's ${devConfigsRange}`,
        });
        setCatalog({ project, name: devConfigs, version: devConfigsRange.replace(/^\^/, '') });
      }

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
      // The interactive path: a terminal asks the three names in order and the answers come from the
      // keyboard. `script` gives the command a pseudo-terminal, so VULCAN sees a TTY, and the answers
      // are piped in: the kind (a preset with a lib asks app or lib first), the frontend folder (empty takes the one chosen before), the app, the backend.
      // TERM=dumb keeps VULCAN 0.3.9's cursor menus off, so the answers stay plain lines.
      const prompted = run({
        cwd: project,
        env: { ...NO_INSTALL, TERM: 'dumb' },
        command: [
          'script',
          '-qec',
          [...vulcanCommand(), 'add', '--preset', `file:${presetRoot}`].join(' '),
          '/dev/null',
        ],
        input: 'app\n\nportal\ncore-api\n',
      });
      const order = [
        'Frontend folder',
        'Name of this frontend app',
        'Backend app to proxy /api to',
      ].map((question) => prompted.output.indexOf(question));

      assert({
        condition: order.every((index, position) => index > (order[position - 1] ?? -1)),
        message: 'add asks the frontend folder, the app and the backend, in that order',
      });
      assert({
        condition: readFileSync(
          join(project, 'apps/portal/.configs/builders/vite.config.mts'),
          'utf8',
        ).includes("'http://localhost:3000'"),
        message: 'the app added by answering the prompts proxies /api to http://localhost:3000',
      });
      assert({
        condition: readFileSync(join(project, 'apps/portal/.env.example'), 'utf8').includes(
          'PORT=5174',
        ),
        message: 'the second frontend took port 5174',
      });

      addOverrides({ project, tarballs: new Map([...ignisTarballs, ...ownTarballs]) });
      await install({
        project,
        apps: [
          { folder: 'services/core-api', checks: ignisChecks },
          { folder: 'services/billing-api', checks: ignisChecks },
          { folder: 'apps/admin', checks: ardorChecks, firstRun: true },
          { folder: 'apps/portal', checks: ardorChecks },
        ],
      });
      const port = readFileSync(join(project, 'services/billing-api/.env.example'), 'utf8').match(
        /PORT=(\d+)/,
      )?.[1];

      assert({ condition: port === '3001', message: 'the second backend took port 3001' });
      assert({
        condition: readFileSync(
          join(project, 'apps/admin/.configs/builders/vite.config.mts'),
          'utf8',
        ).includes(`'http://localhost:${port}'`),
        message: `apps/admin/.configs/builders/vite.config.mts proxies /api to http://localhost:${port}`,
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
