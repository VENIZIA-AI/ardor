/**
 * Proves the atlas MCP server answers over THIS repository's corpora: starts the server in repo
 * mode with `--root` at the ARDOR checkout, drives `initialize`, `tools/list`, a knowledge `search`
 * and a `symbol` lookup over stdio JSON-RPC, and fails on the first answer that is not ARDOR's.
 *
 * The server comes from `@venizia/ignis-atlas`; `ARDOR_ATLAS_CLI` overrides the entry (e.g. the
 * IGNIS checkout's `packages/atlas/src/cli.ts` while the family-checkout support is unreleased).
 *
 * Usage: bun scripts/atlas-smoke.ts
 */
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dir, '..');
const cli = process.env.ARDOR_ATLAS_CLI;
const command = cli
  ? ['bun', cli, 'mcp', '--root', REPO]
  : ['bunx', '@venizia/ignis-atlas', 'mcp', '--root', REPO];

const server = Bun.spawn(command, { cwd: REPO, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
const decoder = new TextDecoder();
const reader = server.stdout.getReader();
let buffer = '';

const readMessage = async (): Promise<Record<string, unknown>> => {
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length > 0) {
        return JSON.parse(line) as Record<string, unknown>;
      }
      continue;
    }
    const { value, done } = await reader.read();
    if (done) {
      throw new Error(`atlas exited: ${await new Response(server.stderr).text()}`);
    }
    buffer += decoder.decode(value);
  }
};

let nextId = 1;
const call = async (opts: { method: string; params?: Record<string, unknown> }) => {
  const id = nextId++;
  server.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', id, method: opts.method, params: opts.params ?? {} })}\n`,
  );
  for (;;) {
    const message = await readMessage();
    if (message.id === id) {
      return message;
    }
  }
};

const failures: string[] = [];
const check = (label: string, condition: boolean, detail?: unknown) => {
  if (!condition) {
    failures.push(
      `${label}${detail === undefined ? '' : ` | ${JSON.stringify(detail).slice(0, 300)}`}`,
    );
    return;
  }
  console.log(`ok   | ${label}`);
};

const initialized = await call({
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'atlas-smoke', version: '0' },
  },
});
const serverInfo = (initialized.result as { serverInfo?: { name?: string } } | undefined)
  ?.serverInfo;
check('server names itself after this repository', serverInfo?.name === 'ardor-atlas', serverInfo);
server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

const tools = await call({ method: 'tools/list' });
const names = ((tools.result as { tools?: { name: string }[] } | undefined)?.tools ?? []).map(
  tool => tool.name,
);
check(
  'exposes search, get, symbol, version, changes',
  ['search', 'get', 'symbol', 'version', 'changes'].every(name => names.includes(name)),
  names,
);

const search = await call({
  method: 'tools/call',
  params: { name: 'search', arguments: { query: 'no-auth paths', corpus: 'knowledge' } },
});
const searchText = JSON.stringify(search.result ?? search.error);
check(
  'knowledge search finds the ARDOR concept',
  searchText.includes('no-auth-paths'),
  searchText.slice(0, 200),
);

const symbol = await call({
  method: 'tools/call',
  params: { name: 'symbol', arguments: { name: 'useInjectable' } },
});
const symbolText = JSON.stringify(symbol.result ?? symbol.error);
check(
  'symbol lookup resolves useInjectable to @venizia/ardor-react',
  symbolText.includes('ardor-react'),
  symbolText.slice(0, 200),
);

const wiki = await call({
  method: 'tools/call',
  params: { name: 'search', arguments: { query: 'content-range total', corpus: 'wiki' } },
});
const wikiText = JSON.stringify(wiki.result ?? wiki.error);
check(
  'wiki search finds the data provider page',
  wikiText.includes('data-provider'),
  wikiText.slice(0, 200),
);

server.kill();

if (failures.length > 0) {
  console.error(`atlas smoke FAILED:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('atlas smoke OK - ardor-atlas serves this checkout');

export {};
