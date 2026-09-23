#!/usr/bin/env bun
/**
 * Installs packed tarballs into empty projects (hoisted and isolated) and loads every published
 * sub-path with Bun, Node ESM and a browser build. Named packages are packed alone, their siblings
 * taken from the registry.
 *
 * Usage: bun scripts/clean-install/cli.ts [package ...] [--keep]
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { PURITY_MANIFEST } from '../purity/manifest';
import {
  assertEveryPackageClaimed,
  deriveInstallRows,
  findLockMismatches,
  INSTALL_CLAIMS,
  listPackageDirectories,
  readPackageManifest,
  REPOSITORY_ROOT,
} from './manifest';
import type { IInstallRow, IPackageManifest } from './manifest';

const LINKERS = ['hoisted', 'isolated'];

// Entries run decorators at import, so each check loads the polyfill first, as an application does.
const LOAD = (specifier: string): string =>
  `await import('reflect-metadata'); await import('${specifier}');`;

const run = async (opts: {
  command: string[];
  cwd: string;
}): Promise<{ ok: boolean; output: string }> => {
  const child = Bun.spawn(opts.command, { cwd: opts.cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { ok: status === 0, output: `${stderr}\n${stdout}` };
};

const firstErrorLine = (opts: { output: string }): string => {
  const lines = opts.output.split('\n').map(line => line.trim());
  const found = lines.find(line =>
    /Cannot find|Could not resolve|not found|Error|error:/.test(line),
  );
  return (found ?? lines.find(line => line.length > 0) ?? '').slice(0, 200);
};

const newestMtime = (directory: string): number => {
  if (!existsSync(directory)) {
    return 0;
  }
  let newest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && !entry.parentPath.includes('__tests__')) {
      newest = Math.max(newest, statSync(join(entry.parentPath, entry.name)).mtimeMs);
    }
  }
  return newest;
};

/** A tarball packs `dist` as it is, so a `dist` older than its `src` would gate stale code. */
const assertFreshDist = (opts: { directories: string[] }): void => {
  for (const directory of opts.directories) {
    const packageDirectory = join(REPOSITORY_ROOT, 'packages', directory);
    const source = newestMtime(join(packageDirectory, 'src'));
    const built = newestMtime(join(packageDirectory, 'dist'));
    if (built === 0 || source > built) {
      throw new Error(
        `[clean-install] packages/${directory}/dist is missing or older than src - build it first`,
      );
    }
  }
};

/** Node and Bun resolve up the parent chain, so a stray `node_modules` there would satisfy a missing peer. */
const assertNoAncestorModules = (opts: { root: string }): void => {
  const leaks: string[] = [];
  for (let directory = dirname(opts.root); ; directory = dirname(directory)) {
    if (existsSync(join(directory, 'node_modules'))) {
      leaks.push(join(directory, 'node_modules'));
    }
    if (dirname(directory) === directory) {
      break;
    }
  }
  for (const legacy of ['.node_modules', '.node_libraries']) {
    if (existsSync(join(homedir(), legacy))) {
      leaks.push(join(homedir(), legacy));
    }
  }
  if (process.env.NODE_PATH) {
    leaks.push(`NODE_PATH=${process.env.NODE_PATH}`);
  }
  if (leaks.length > 0) {
    throw new Error(
      `[clean-install] a missing peer could resolve from outside the sandbox: ${leaks.join(', ')}`,
    );
  }
};

const pack = async (opts: {
  directories: string[];
  into: string;
}): Promise<Map<string, string>> => {
  const tarballs = new Map<string, string>();
  for (const directory of opts.directories) {
    const destination = join(opts.into, 'tarballs', directory);
    const packed = await run({
      command: ['bun', 'pm', 'pack', '--ignore-scripts', '--quiet', '--destination', destination],
      cwd: join(REPOSITORY_ROOT, 'packages', directory),
    });
    if (!packed.ok) {
      throw new Error(
        `[clean-install] bun pm pack failed in ${directory}: ${firstErrorLine(packed)}`,
      );
    }
    const produced = readdirSync(destination).filter(file => file.endsWith('.tgz'));
    if (produced.length !== 1) {
      throw new Error(
        `[clean-install] expected one tarball for ${directory}, found ${produced.length}`,
      );
    }
    tarballs.set(readPackageManifest({ package: directory }).name, join(destination, produced[0]));
  }
  return tarballs;
};

const requiredPeers = (opts: { manifest: IPackageManifest }): Record<string, string> => {
  const optional = opts.manifest.peerDependenciesMeta ?? {};
  return Object.fromEntries(
    Object.entries(opts.manifest.peerDependencies ?? {}).filter(
      ([name]) => !optional[name]?.optional,
    ),
  );
};

const checkRow = async (opts: {
  row: IInstallRow;
  sandbox: string;
}): Promise<Array<{ name: string; ok: boolean; detail: string }>> => {
  const { row, sandbox } = opts;
  const attempt = async (name: string, command: string[]) => {
    const result = await run({ command, cwd: sandbox });
    return { name, ok: result.ok, detail: result.ok ? '' : firstErrorLine(result) };
  };

  const checks = [
    attempt('bun', ['bun', '-e', LOAD(row.specifier)]),
    attempt('node-esm', ['node', '--input-type=module', '-e', LOAD(row.specifier)]),
  ];

  const claim = PURITY_MANIFEST.find(entry => entry.entry === row.entry);
  if (claim) {
    const entryFile = join(sandbox, `entry-${row.subpath.replace(/[^a-z0-9]/gi, '_')}.ts`);
    writeFileSync(
      entryFile,
      `import * as loaded from '${row.specifier}';\nconsole.log(Object.keys(loaded).length);\n`,
    );
    checks.push(
      attempt('browser', [
        'bun',
        'build',
        relative(sandbox, entryFile),
        '--target=browser',
        '--outdir',
        join(sandbox, 'browser-out'),
        ...(claim.external ?? []).flatMap(name => ['--external', name]),
      ]),
    );
  }

  return Promise.all(checks);
};

const main = async (): Promise<number> => {
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  const tokens = args.filter(arg => !arg.startsWith('--'));

  if (!(await run({ command: ['node', '--version'], cwd: REPOSITORY_ROOT })).ok) {
    throw new Error('[clean-install] `node` is not on PATH - the Node checks cannot run');
  }

  assertEveryPackageClaimed({ claims: INSTALL_CLAIMS, directories: listPackageDirectories() });
  const claims =
    tokens.length > 0
      ? INSTALL_CLAIMS.filter(claim => tokens.includes(claim.package))
      : INSTALL_CLAIMS;
  if (claims.length === 0) {
    throw new Error(`[clean-install] no claim matches ${tokens.join(', ')}`);
  }

  const directories = claims.map(claim => claim.package);
  assertFreshDist({ directories });

  const rows = deriveInstallRows({ claims });
  const root = mkdtempSync(join(tmpdir(), 'ardor-clean-install-'));
  assertNoAncestorModules({ root });

  const failures: string[] = [];
  let checkCount = 0;

  try {
    const tarballs = await pack({ directories, into: root });
    const overrides = Object.fromEntries(
      [...tarballs].map(([name, file]) => [name, `file:${file}`]),
    );

    const groups = new Map<string, IInstallRow[]>();
    for (const row of rows) {
      for (const linker of LINKERS) {
        const key = `${row.package}|${linker}|${row.extras.join(',')}`;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
    }

    for (const [key, groupRows] of groups) {
      const [directory, linker, extrasText] = key.split('|');
      const manifest = readPackageManifest({ package: directory });
      const extras = extrasText ? extrasText.split(',') : [];
      const peerRanges = manifest.peerDependencies ?? {};

      const sandbox = mkdtempSync(join(root, `${directory}-${linker}-`));
      const dependencies = {
        [manifest.name]: `file:${tarballs.get(manifest.name)}`,
        ...requiredPeers({ manifest }),
        ...Object.fromEntries(extras.map(name => [name, peerRanges[name]])),
        'reflect-metadata': peerRanges['reflect-metadata'] ?? '^0.2.2',
      };
      writeFileSync(
        join(sandbox, 'package.json'),
        JSON.stringify(
          { name: 'clean-install-sandbox', private: true, type: 'module', dependencies, overrides },
          null,
          2,
        ),
      );

      const installed = await run({
        command: ['bun', 'install', `--linker=${linker}`],
        cwd: sandbox,
      });
      if (!installed.ok) {
        failures.push(
          `${manifest.name} (${linker}, +${extras.join(' ') || 'none'}) install: ${firstErrorLine(installed)}`,
        );
        continue;
      }

      checkCount += 1;
      for (const mismatch of findLockMismatches({
        lock: readFileSync(join(sandbox, 'bun.lock'), 'utf8'),
        tarballs,
        sandboxed: manifest.name,
      })) {
        failures.push(`${manifest.name} [${linker}] lock: ${mismatch}`);
      }

      for (const row of groupRows) {
        const results = await checkRow({ row, sandbox });
        checkCount += results.length;
        const failed = results.filter(result => !result.ok);
        const marks = results
          .map(result => `${result.name} ${result.ok ? 'ok' : 'FAIL'}`)
          .join('  ');
        console.log(
          `  ${failed.length ? '✗' : '✓'} ${row.specifier.padEnd(34)} ${linker.padEnd(8)} ${marks}`,
        );
        for (const result of failed) {
          failures.push(`${row.specifier} [${linker}] ${result.name}: ${result.detail}`);
        }
      }
    }
  } finally {
    if (keep) {
      console.log(`\n[clean-install] sandboxes kept at ${root}`);
    } else {
      rmSync(root, { recursive: true, force: true });
    }
  }

  if (failures.length > 0) {
    console.error(`\n[clean-install] ${failures.length} of ${checkCount} checks failed:`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    return 1;
  }

  console.log(`\n[clean-install] ${checkCount} checks passed across ${rows.length} sub-paths.`);
  return 0;
};

process.exit(await main());
