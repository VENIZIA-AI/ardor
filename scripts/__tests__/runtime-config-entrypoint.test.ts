import { afterAll, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const SCRIPT = resolve(
  import.meta.dir,
  '../../presets/app/files/.configs/builders/docker-entrypoint.d/40-runtime-config.sh',
);
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

const workspace = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-config-'));

  roots.push(root);

  return root;
};

/** A PATH whose `awk` is BusyBox's, the awk of the nginx alpine image, when BusyBox is installed. */
const busyboxPath = (): string | undefined => {
  const busybox = Bun.which('busybox');

  if (busybox === null) {
    return undefined;
  }

  const bin = join(workspace(), 'bin');

  mkdirSync(bin);
  symlinkSync(busybox, join(bin, 'awk'));

  return `${bin}:${process.env.PATH ?? ''}`;
};

type TRun = { code: number; stdout: string; stderr: string; target: string };

/** Runs the entrypoint script with exactly this environment (no inherited variables but PATH). */
const run = (opts: {
  env: Record<string, string>;
  path?: string;
  prepare?: (target: string) => void;
}): TRun => {
  const root = workspace();
  const target = join(root, 'config.js');

  opts.prepare?.(target);
  const result = Bun.spawnSync(['sh', SCRIPT], {
    env: {
      PATH: opts.path ?? process.env.PATH ?? '',
      RUNTIME_CONFIG_TARGET: target,
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

/** What the page sees: config.js evaluated in a bare context with a `window`. */
const evaluate = (target: string): { config: Record<string, unknown>; frozen: boolean } => {
  const sandbox: { window: Record<string, unknown> } = { window: {} };

  runInNewContext(readFileSync(target, 'utf8'), sandbox);
  const config = sandbox.window.__APP_CONFIG__ as Record<string, unknown>;

  return { config, frozen: Object.isFrozen(config) };
};

const awks: Array<{ name: string; path?: string }> = [
  { name: 'the awk of this machine', path: undefined },
  ...(busyboxPath() === undefined ? [] : [{ name: 'BusyBox awk', path: busyboxPath() }]),
];

describe.each(awks)('40-runtime-config.sh with $name', ({ path }) => {
  test('publishes the VITE_ variables and nothing else', () => {
    const { code, target } = run({
      path,
      env: {
        VITE_API_URL: 'https://api.example.com',
        VITE_MAPS_KEY: 'public-key',
        VITE_A_1: 'one',
        DATABASE_URL: 'postgres://user:pw@db/app',
        API_UPSTREAM: 'http://api:3000',
        NODE_ENV: 'production',
        VITE: 'bare',
        VITE_: 'empty suffix',
        vite_lower: 'lowercase',
        XVITE_A: 'not a prefix',
        MY_VITE_A: 'not a prefix either',
      },
    });

    expect(code).toBe(0);
    expect(evaluate(target).config).toEqual({
      VITE_A_1: 'one',
      VITE_API_URL: 'https://api.example.com',
      VITE_MAPS_KEY: 'public-key',
    });
  });

  test('an object that is frozen, with the keys sorted', () => {
    const { target } = run({ path, env: { VITE_B: '2', VITE_A: '1', VITE_C: '3' } });
    const text = readFileSync(target, 'utf8');

    expect(evaluate(target).frozen).toBe(true);
    expect(text.indexOf('VITE_A')).toBeLessThan(text.indexOf('VITE_B'));
    expect(text.indexOf('VITE_B')).toBeLessThan(text.indexOf('VITE_C'));
  });

  test('no VITE_ variable gives an empty object', () => {
    const { code, target } = run({ path, env: { OTHER: 'x' } });

    expect(code).toBe(0);
    expect(evaluate(target).config).toEqual({});
  });

  test('an empty value is published as an empty string', () => {
    const { target } = run({ path, env: { VITE_EMPTY: '' } });

    expect(evaluate(target).config).toEqual({ VITE_EMPTY: '' });
  });

  test('every value comes back exactly as it was set', () => {
    const hostile: Record<string, string> = {
      VITE_QUOTE: 'a"b',
      VITE_QUOTE_BREAKOUT: '"; window.pwned = true; "',
      VITE_BACKSLASH: 'C:\\temp\\new',
      VITE_TRAILING_BACKSLASH: 'end\\',
      VITE_NEWLINE: 'line1\nline2',
      VITE_CARRIAGE_RETURN: 'a\rb',
      VITE_TAB: 'a\tb',
      VITE_CONTROL: 'bell\u0007escape\u001bend',
      VITE_SCRIPT_END: '</script><script>window.pwned = true</script>',
      VITE_HTML_COMMENT: '<!-- x -->',
      VITE_AMPERSAND: 'a&b&amp;',
      VITE_SINGLE_QUOTE: "it's",
      VITE_BACKTICK: 'a`b`${window.pwned = true}',
      VITE_SHELL: '$(touch /tmp/runtime-config-pwned) `id` $HOME',
      VITE_PERCENT: '100% %s %d',
      VITE_UNICODE: 'café 日本語 😀',
      VITE_SEPARATORS: 'a\u2028b\u2029c',
      VITE_LEADING_SPACES: '  padded  ',
      VITE_JSON: '{"a":[1,2,{"b":null}]}',
    };
    const { code, target } = run({ path, env: hostile });
    const { config } = evaluate(target);

    expect(code).toBe(0);
    expect(config).toEqual(hostile);
    expect((globalThis as { pwned?: boolean }).pwned).toBeUndefined();
    expect(existsSync('/tmp/runtime-config-pwned')).toBe(false);
  });

  test.each(['VITE_API_SECRET', 'VITE_DB_PASSWORD', 'VITE_AUTH_TOKEN', 'VITE_X_TOKEN_Y'])(
    '%s stops the container and writes nothing',
    (name) => {
      const { code, stderr, target } = run({
        path,
        env: { VITE_API_URL: 'https://api.example.com', [name]: 'do-not-publish' },
      });

      expect(code).toBe(1);
      expect(stderr).toContain(name);
      expect(stderr).not.toContain('do-not-publish');
      expect(existsSync(target)).toBe(false);
    },
  );

  test('a public key is not a secret: a name with KEY is published', () => {
    const { code, target } = run({ path, env: { VITE_GOOGLE_RECAPTCHA_SITE_KEY: 'site-key' } });

    expect(code).toBe(0);
    expect(evaluate(target).config).toEqual({ VITE_GOOGLE_RECAPTCHA_SITE_KEY: 'site-key' });
  });

  test('a tripwire name outside the VITE_ prefix is not published and not a failure', () => {
    const { code, target } = run({ path, env: { APP_SECRET: 'x', VITE_OK: 'yes' } });

    expect(code).toBe(0);
    expect(evaluate(target).config).toEqual({ VITE_OK: 'yes' });
  });

  test('an earlier config.js is replaced', () => {
    const { target } = run({
      path,
      env: { VITE_NEW: 'new' },
      prepare: (file) => writeFileSync(file, 'window.__APP_CONFIG__ = { VITE_OLD: "old" };\n'),
    });

    expect(evaluate(target).config).toEqual({ VITE_NEW: 'new' });
  });

  test.skipIf(process.getuid?.() === 0)('a read-only config.js (a mount) is kept as it is', () => {
    const original = 'window.__APP_CONFIG__ = { VITE_MOUNTED: "from the operator" };\n';
    const { code, target } = run({
      path,
      env: { VITE_API_URL: 'https://api.example.com' },
      prepare: (file) => {
        writeFileSync(file, original);
        chmodSync(file, 0o444);
      },
    });

    expect(code).toBe(0);
    expect(readFileSync(target, 'utf8')).toBe(original);
  });
});
