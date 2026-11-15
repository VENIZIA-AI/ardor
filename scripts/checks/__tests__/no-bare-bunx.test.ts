import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..', '..');
const SKIPPED_FILES = new Set(['scripts/checks/__tests__/no-bare-bunx.test.ts', 'bun.lock']);
const SKIPPED_PREFIXES = ['docs/wiki/site/.vitepress/dist/', '.agents/local/'];
const TEXT_FILE =
  /\.(md|mts|cts|ts|tsx|js|mjs|cjs|sh|yaml|yml|json|jsonc|toml|mk|env|example|conf|template)$|(?:^|\/)(?:Makefile|Dockerfile|\.[\w.-]+)$|\.(?:githooks)\//;

/** The runners that fetch a package by name when it is not installed. */
const RUNNER = /(?:^|[^\w.-])(bun\s+x|bunx|npx|pnpm\s+dlx)(?=\s)/g;

/** Flags that take the next token as their value. */
const FLAGS_WITH_VALUE = new Set([
  '-p',
  '--package',
  '--cwd',
  '--env-file',
  '--registry',
  '--config',
  '-c',
  '--tsconfig-override',
]);

/** Scoped to us, or fetched on purpose: not installed in the app, and running it is how a component is added. */
const ALLOWED_NAME = /^(?:@venizia(?:\\?\/|$)|shadcn(?:@[\w.-]+)?$)/;

const stripWord = (opts: { word: string }): string => {
  return opts.word.replace(/^["'`(]+|["'`),.;:]+$/g, '').replace(/\\$/, '');
};

/**
 * `bun x <name>`, `bunx <name>`, `npx <name>` and `pnpm dlx <name>` run what `node_modules/.bin`
 * holds, and fetch the package of that name from npm when it holds nothing: an unscoped name can be
 * somebody else's code. A `@venizia/...` name is ours; anything else needs `--no-install` (which only
 * stops the fetch: it still runs a copy an earlier fetch left in the bunx cache, so the documented
 * way to run a project's own bin is `bun run <name>` inside the package that depends on it).
 * A line that ends in `\` continues on the next.
 */
const offendersIn = (opts: { text: string }): string[] => {
  const joined = opts.text.replace(/\\\r?\n\s*/g, ' ');

  return [...joined.matchAll(RUNNER)].flatMap((match) => {
    const runner = match[1] ?? '';
    const rest = joined.slice((match.index ?? 0) + match[0].length).split(/\r?\n/, 1)[0] ?? '';
    const words = rest.split(/\s+/).filter((word) => word !== '');
    const flags: string[] = [];
    let name = '';

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index] ?? '';

      if (word.startsWith('-')) {
        flags.push(word);
        index += FLAGS_WITH_VALUE.has(word) ? 1 : 0;
        continue;
      }

      name = stripWord({ word });
      break;
    }

    if (name === '' || ALLOWED_NAME.test(name) || flags.includes('--no-install')) {
      return [];
    }

    return [`${runner} ${flags.join(' ')} ${name}`.replace(/\s+/g, ' ')];
  });
};

/** The parts of a Markdown file that are code: fences and inline code. Prose is not a command. */
const codeOf = (opts: { text: string }): string => {
  const fences = [...opts.text.matchAll(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\1/gm)].map(
    (match) => match[2] ?? '',
  );
  const prose = opts.text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1/gm, '');
  const inline = [...prose.matchAll(/(`+)([^`\n]+?)\1/g)].map((match) => match[2] ?? '');

  return [...fences, ...inline].join('\n');
};

const trackedFiles = (): string[] => {
  const output = Bun.spawnSync(['git', 'ls-files'], { cwd: ROOT }).stdout.toString();

  return output
    .split('\n')
    .filter((file) => file !== '' && TEXT_FILE.test(file))
    .filter((file) => !SKIPPED_FILES.has(file))
    .filter((file) => !SKIPPED_PREFIXES.some((prefix) => file.startsWith(prefix)));
};

describe('documented bunx commands', () => {
  test('the check sees a bare name, flags before it, flag values, quotes and continuations', () => {
    const bad = [
      'run bunx ardor codemod',
      'run bun x devz codemod',
      'run bunx -y ardor',
      'run bun  x --bun ardor',
      'run bunx "ardor"',
      'run bunx `ardor`',
      'run bunx @evil/ardor',
      'run bunx shadcn-ui',
      'run bunx --cwd ./apps/web ardor',
      'run bunx --env-file .env ardor',
      'run bunx -p ./local ardor',
      'run bunx --no-install-foo ardor',
      'run bunx --no-install=false ardor',
      'run npx ardor',
      'run pnpm dlx ardor',
      'run bun x \\\n   ardor codemod',
    ];

    for (const text of bad) {
      expect({ text, found: offendersIn({ text }).length }).toEqual({ text, found: 1 });
    }
  });

  test('the check lets --no-install, our own scope and shadcn through', () => {
    const good = [
      'run bun x --no-install ardor codemod',
      'run bunx --bun --no-install ardor',
      'run npx --no-install ardor',
      'bun x @venizia/vulcan@0.4.10-16 init',
      'bunx shadcn init',
      'bunx shadcn@latest add button',
      'bun x --cwd ./apps/web --no-install ardor',
    ];

    for (const text of good) {
      expect({ text, found: offendersIn({ text }) }).toEqual({ text, found: [] });
    }
  });

  test('prose in Markdown is not a command, code is', () => {
    expect(offendersIn({ text: codeOf({ text: 'Use bunx to run the tool.\n' }) })).toEqual([]);
    expect(offendersIn({ text: codeOf({ text: 'Run `bunx ardor` here.\n' }) })).toHaveLength(1);
    expect(
      offendersIn({ text: codeOf({ text: '```bash\nbunx ardor codemod\n```\n' }) }),
    ).toHaveLength(1);
  });

  test('every tracked text file runs an unscoped name with --no-install', () => {
    const offenders = trackedFiles().flatMap((file) => {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const scanned = file.endsWith('.md') ? codeOf({ text }) : text;

      return offendersIn({ text: scanned }).map((command) => `${file}: ${command}`);
    });

    expect(offenders).toEqual([]);
  });
});
