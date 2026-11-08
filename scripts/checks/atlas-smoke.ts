/**
 * Proves the atlas MCP server answers over THIS repository's corpora, not IGNIS's.
 *
 * The server is the atlas VULCAN pins (`vulcan x atlas mcp`), the same command `.mcp.json` runs.
 * `ARDOR_ATLAS_CLI` overrides it with a local VULCAN checkout's atlas CLI.
 *
 * Usage: bun scripts/checks/atlas-smoke.ts
 */
import { resolve } from 'node:path';

const REPO = resolve(import.meta.dir, '..', '..');
const cli = process.env.ARDOR_ATLAS_CLI;
const command = cli
  ? ['bun', cli, 'mcp', '--root', REPO]
  : ['bun', 'x', '--no-install', 'vulcan', 'x', 'atlas', 'mcp', '--root', REPO];

const QUERIES = [
  {
    label: 'knowledge search finds the ARDOR concept',
    name: 'search',
    args: { query: 'no-auth paths', corpus: 'knowledge' },
    expect: 'no-auth-paths',
  },
  {
    label: 'symbol lookup resolves useInjectable to @venizia/ardor-react',
    name: 'symbol',
    args: { name: 'useInjectable' },
    expect: 'ardor-react',
  },
  {
    label: 'wiki search finds the data provider page',
    name: 'search',
    args: { query: 'content-range total', corpus: 'wiki', source: 'ardor' },
    expect: 'data-provider',
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const server = Bun.spawn(command, { cwd: REPO, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
const decoder = new TextDecoder();
const reader = server.stdout.getReader();
let buffer = '';

const readMessage = async (): Promise<Record<string, unknown>> => {
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline === -1) {
      const { value, done } = await reader.read();
      if (done) {
        const stderrResponse = new Response(server.stderr);
        const stderr = await stderrResponse.text();
        throw new Error(`atlas exited: ${stderr}`);
      }
      buffer += decoder.decode(value);
      continue;
    }

    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    const message: unknown = line.length > 0 ? JSON.parse(line) : null;
    if (isRecord(message)) {
      return message;
    }
  }
};

let nextId = 1;
const call = async (opts: { method: string; params: Record<string, unknown> }) => {
  const id = nextId++;
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, ...opts })}\n`);
  for (;;) {
    const message = await readMessage();
    if (message.id === id) {
      return message;
    }
  }
};

const failures: string[] = [];
const check = (label: string, condition: boolean, detail: unknown) => {
  if (!condition) {
    failures.push(`${label} | ${JSON.stringify(detail).slice(0, 300)}`);
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
const serverInfo = isRecord(initialized.result) ? initialized.result.serverInfo : undefined;
// The name stays `ardor-atlas` when `atlas.sources` serves IGNIS beside this checkout.
const serverName = isRecord(serverInfo) ? serverInfo.name : undefined;
check('server names itself after this repository', serverName === 'ardor-atlas', serverInfo);
server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

for (const query of QUERIES) {
  const answer = await call({
    method: 'tools/call',
    params: { name: query.name, arguments: query.args },
  });
  const text = JSON.stringify(answer.result ?? answer.error);
  check(query.label, text.includes(query.expect), text.slice(0, 200));
}

server.kill();

if (failures.length > 0) {
  console.error(`atlas smoke FAILED:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`atlas smoke OK - ${serverName} serves this checkout`);

export {};
