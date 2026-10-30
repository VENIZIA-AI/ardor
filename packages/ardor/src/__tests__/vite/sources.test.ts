import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { BuildInfoEnvironmentKeys } from '@venizia/ignis-boot/build-info';

import { findInstalledVersion, readFrameworkVersions, readGit, readJsonFile } from '@/vite/sources';

import { rejectionOf } from '@venizia/dev-configs/testing';
import { makeScratch, REPOSITORY_ROOT, removeScratch, runNode, writeFiles } from './fixture';

describe('reading from disk', () => {
  let root: string;

  beforeAll(() => {
    root = makeScratch({ prefix: 'build-info-disk-' });

    writeFiles({
      root,
      files: {
        'apps/shop/package.json': JSON.stringify({
          name: '@acme/shop',
          version: '9.9.9',
          dependencies: {
            '@venizia/ardor': 'catalog:',
            react: '19.0.0',
            '@venizia/not-installed': '1.0.0',
            '@venizia/../../../outside/target': '1.0.0',
          },
          devDependencies: { '@venizia/ignis-boot': 'catalog:', vite: '8.0.0' },
        }),
        'apps/shop/node_modules/@venizia/ardor/package.json': JSON.stringify({ version: '0.4.3' }),
        // Hoisted to the workspace root, the way a monorepo install lays it out.
        'node_modules/@venizia/ignis-boot/package.json': JSON.stringify({ version: '0.4.3' }),
        // What a name that climbs out of node_modules would reach.
        'apps/shop/outside/target/package.json': JSON.stringify({ version: '6.6.6' }),
        'broken/package.json': '{ "root": "secret-text-of-another-file",',
      },
    });
    mkdirSync(join(root, 'empty'), { recursive: true });
  });

  afterAll(() => {
    removeScratch({ root });
  });

  test('readJsonFile: a missing file is undefined', async () => {
    const result = await readJsonFile({ path: join(root, 'empty', 'package.json') });
    expect(result).toBeUndefined();
  });

  test('readJsonFile: a broken file is an error that names the file and never quotes its content', async () => {
    const path = join(root, 'broken', 'package.json');
    const result = await rejectionOf(readJsonFile({ path }));
    const message = String(result);

    expect(message).toContain(path);
    expect(message).toContain('is not valid JSON');
    expect(message).not.toContain('secret-text-of-another-file');
  });

  test('findInstalledVersion walks up the node_modules folders like Node does', async () => {
    const app = join(root, 'apps', 'shop');

    const result = await findInstalledVersion({ root: app, name: '@venizia/ardor' });
    expect(result).toBe('0.4.3');
    const result2 = await findInstalledVersion({ root: app, name: '@venizia/ignis-boot' });
    expect(result2).toBe('0.4.3');
    const result3 = await findInstalledVersion({ root: app, name: '@venizia/nothing' });
    expect(result3).toBeUndefined();
  });

  test('readFrameworkVersions lists the installed versions, the ones not installed and the invalid names', async () => {
    const result = await readFrameworkVersions({
      root: join(root, 'apps', 'shop'),
      scope: '@venizia/',
    });

    expect(result.versions).toEqual({ '@venizia/ardor': '0.4.3', '@venizia/ignis-boot': '0.4.3' });
    expect(result.missing).toEqual(['@venizia/not-installed']);
    // The name is never joined into a path: its package.json at ../../../outside is not read.
    expect(result.invalid).toEqual(['@venizia/../../../outside/target']);
  });

  test('readFrameworkVersions without a package.json is an error that says where to look', async () => {
    const task = readFrameworkVersions({ root: join(root, 'empty'), scope: '@venizia/' });

    const result = await rejectionOf(task);
    expect(String(result)).toContain('root option');
  });
});

describe('readGit', () => {
  test('answers with the short commit of this repository', async () => {
    const result = await readGit({
      root: REPOSITORY_ROOT,
      args: ['rev-parse', '--short=12', 'HEAD'],
    });

    expect(result.ok && /^[0-9a-f]{12}$/.test(result.value)).toBe(true);
  });

  test('says why git failed, instead of failing silently', async () => {
    const result = await readGit({
      root: REPOSITORY_ROOT,
      args: ['rev-parse', '--verify', 'refs/heads/no-such-branch'],
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain(
      'git rev-parse --verify refs/heads/no-such-branch failed',
    );
  });

  test('says so when git answers with nothing', async () => {
    const result = await readGit({ root: REPOSITORY_ROOT, args: ['rev-parse', '--show-prefix'] });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain('printed nothing');
  });
});

describe('under Node, which is where Vite runs', () => {
  test('the commit comes from git although the IGNIS resolver cannot reach it without Bun', async () => {
    const dist = join(REPOSITORY_ROOT, 'packages', 'ardor', 'dist', 'vite', 'index.js');
    const resolverDist = join(REPOSITORY_ROOT, 'packages', 'ardor', 'dist', 'vite', 'resolver.js');
    const sourcesDist = join(REPOSITORY_ROOT, 'packages', 'ardor', 'dist', 'vite', 'sources.js');
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined && !BuildInfoEnvironmentKeys.COMMIT.includes(entry[0]),
      ),
    );
    const script = [
      `import { UnresolvedPolicies } from ${JSON.stringify(dist)};`,
      `import { resolveBuildInfo } from ${JSON.stringify(resolverDist)};`,
      `import { defaultSources } from ${JSON.stringify(sourcesDist)};`,
      `const { info } = await resolveBuildInfo({ root: ${JSON.stringify(REPOSITORY_ROOT)}, scope: '@venizia/', policy: UnresolvedPolicies.ERROR, sources: defaultSources });`,
      'console.log(info.commit);',
    ].join('\n');

    const run = await runNode({ args: ['--input-type=module', '-e', script], env: environment });

    expect(run.stderr).toBe('');
    expect(run.stdout.trim()).toMatch(/^[0-9a-f]{12}$/);
    expect(run.exitCode).toBe(0);
  });
});
