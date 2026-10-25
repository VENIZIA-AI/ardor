import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { makeScratch } from '../../scratch';

const BUILDERS = resolve(import.meta.dir, '../../../presets/app/files/.configs/builders');
const SCRIPT = join(BUILDERS, 'docker-entrypoint.d/45-api-proxy.sh');
const SNIPPET = join(BUILDERS, 'nginx-snippets/api-proxy.conf');
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

type TRun = { code: number; stdout: string; stderr: string; target: string };

/** Runs the script with exactly this environment (no inherited variables but PATH). */
const run = (opts: { env: Record<string, string>; staleTarget?: boolean }): TRun => {
  const root = makeScratch({ prefix: 'api-proxy-' });
  const target = join(root, 'api-proxy.locations');

  roots.push(root);

  if (opts.staleTarget) {
    writeFileSync(target, 'location /api/ { return 418; }\n');
  }

  const result = Bun.spawnSync(['sh', SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      API_PROXY_SOURCE: SNIPPET,
      API_PROXY_TARGET: target,
      ...opts.env,
    },
  });

  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    target,
  };
};

// The script renders with envsubst, which the nginx image has; a machine without it cannot run these.
describe.skipIf(Bun.which('envsubst') === null)('45-api-proxy.sh', () => {
  test('writes the proxy with the upstream and the resolvers filled in', () => {
    const { code, target, stdout } = run({
      env: { API_UPSTREAM: 'http://api:3000', NGINX_LOCAL_RESOLVERS: '127.0.0.11' },
    });
    const text = readFileSync(target, 'utf8');

    expect(code).toBe(0);
    expect(stdout).toContain('[api-proxy]');
    expect(text).toContain('location /api/ {');
    expect(text).toContain('resolver 127.0.0.11 valid=10s ipv6=off;');
    expect(text).toContain('set $api_upstream http://api:3000;');
  });

  test("leaves nginx's own variables for nginx", () => {
    const { target } = run({
      env: { API_UPSTREAM: 'http://api:3000', NGINX_LOCAL_RESOLVERS: '127.0.0.11' },
    });
    const text = readFileSync(target, 'utf8');

    expect(text).toContain('proxy_pass $api_upstream;');
    expect(text).toContain('proxy_set_header Host $host;');
    expect(text).toContain('$proxy_add_x_forwarded_for');
    expect(text).not.toContain('${');
  });

  test('accepts a name, an address, a port and an IPv6 address', () => {
    for (const upstream of [
      'http://api.internal:3000',
      'https://gateway.example.com',
      'http://10.0.0.5:8080',
      'http://[::1]:3000',
      'http://no-such-host.invalid:3000',
    ]) {
      const { code, target } = run({
        env: { API_UPSTREAM: upstream, NGINX_LOCAL_RESOLVERS: '127.0.0.11' },
      });

      expect(code).toBe(0);
      expect(readFileSync(target, 'utf8')).toContain(`set $api_upstream ${upstream};`);
    }
  });

  test('writes nothing when API_UPSTREAM is empty', () => {
    const { code, target, stdout } = run({
      env: { API_UPSTREAM: '', NGINX_LOCAL_RESOLVERS: '127.0.0.11' },
    });

    expect(code).toBe(0);
    expect(existsSync(target)).toBe(false);
    expect(stdout).toContain('no /api proxy');
  });

  test('writes nothing when API_UPSTREAM is not set at all', () => {
    const { code, target } = run({ env: { NGINX_LOCAL_RESOLVERS: '127.0.0.11' } });

    expect(code).toBe(0);
    expect(existsSync(target)).toBe(false);
  });

  test('removes the file an earlier start left when the variable is now empty', () => {
    const { code, target } = run({ env: { API_UPSTREAM: '' }, staleTarget: true });

    expect(code).toBe(0);
    expect(existsSync(target)).toBe(false);
  });

  test('stops on a value that is not an address, naming the variable and never the value', () => {
    for (const hostile of [
      'http://api:3000; return 418',
      'http://api 3000',
      'http://api"}',
      'http://api\nlocation /x {',
      'http://$(id)',
      'http://api:3000{',
      "http://api'",
      'http://api:3000#',
    ]) {
      const { code, target, stderr, stdout } = run({
        env: { API_UPSTREAM: hostile, NGINX_LOCAL_RESOLVERS: '127.0.0.11' },
      });

      expect(code).toBe(1);
      expect(existsSync(target)).toBe(false);
      expect(stderr).toContain('API_UPSTREAM');
      expect(`${stdout}${stderr}`).not.toContain('418');
      expect(`${stdout}${stderr}`).not.toContain('id)');
    }
  });
});
