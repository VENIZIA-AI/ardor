import { describe, expect, spyOn, test } from 'bun:test';
import { BaseHelper, type ILogger } from '@venizia/ignis-helpers/core';

import { BaseProvider, BaseService } from '@/base';

class OrderService extends BaseService {
  constructor() {
    super({ scope: OrderService.name });
  }

  /** Reads the member the subclasses of a service use: `this.logger`, typed `ILogger`. */
  reportFailure(): void {
    const logger: ILogger = this.logger;

    logger.error('[reportFailure] failed');
  }
}

class PriceProvider extends BaseProvider<number> {
  constructor() {
    super({ scope: PriceProvider.name });
  }

  value(): number {
    this.logger.info('[value] computed');

    return 1;
  }
}

// `this.logger` is what an application's services call (an application has dozens of them), so it must stay on
// BaseService and BaseProvider, typed as IGNIS's ILogger.
describe('BaseService and BaseProvider are IGNIS BaseHelpers', () => {
  test('both are instances of the IGNIS BaseHelper, with the scope they were given', () => {
    const service = new OrderService();
    const provider = new PriceProvider();

    expect(service).toBeInstanceOf(BaseHelper);
    expect(provider).toBeInstanceOf(BaseHelper);
    expect(service.scope).toBe('OrderService');
    expect(provider.scope).toBe('PriceProvider');
  });

  test('this.logger writes a line that names the scope', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      new OrderService().reportFailure();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain('[OrderService]');
      expect(String(spy.mock.calls[0]?.[0])).toContain('[reportFailure] failed');
    } finally {
      spy.mockRestore();
    }
  });

  test('a test or an application can install its own logger on one instance', () => {
    const lines: string[] = [];
    const own = new BaseHelper({ scope: 'own' }).logger;
    const provider = new PriceProvider();

    spyOn(own, 'info').mockImplementation((message: string) => {
      lines.push(message);
    });
    provider.logger = own;
    provider.value();

    expect(lines).toEqual(['[value] computed']);
  });
});

/**
 * The logger state lives on `globalThis` and the debug gate reads the environment once, so each case runs in a
 * fresh process with the environment it names and prints one `RESULT:` line.
 */
const runLines = (opts: { debug?: string; body: string }): string[] => {
  const script = `
    const seen = [];
    for (const method of ['debug', 'log', 'info', 'warn', 'error']) {
      console[method] = (...parts) => { seen.push(method + ':' + parts.join(' ')); };
    }
    const { BaseHelper, LoggerFactory, LogLevels } = await import('@venizia/ignis-helpers/core');
    ${opts.body}
    process.stdout.write('RESULT:' + JSON.stringify(seen) + '\\n');
  `;
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.DEBUG;
  delete env.NODE_ENV;

  if (opts.debug !== undefined) {
    env.DEBUG = opts.debug;
  }

  const result = Bun.spawnSync(['bun', '-e', script], {
    cwd: import.meta.dir,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 20_000,
  });
  const line = result.stdout
    .toString()
    .split('\n')
    .find((entry) => entry.startsWith('RESULT:'));

  if (!line) {
    throw new Error(`[base-helper-test] no result | stderr: ${result.stderr.toString()}`);
  }

  return JSON.parse(line.slice('RESULT:'.length));
};

const LOG_ALL = `
  const service = new BaseHelper({ scope: 'Service' }).logger;
  const plain = LoggerFactory.getLogger(['Plain']);
  for (const logger of [service, plain]) {
    logger.debug('hidden?');
    logger.info('shown');
  }
`;
const debugLines = (lines: string[]): string[] => lines.filter((line) => line.startsWith('debug:'));

// `enableDebug` is gone: IGNIS's console logger has its own debug gate, so production needs nothing installed.
// `this.logger`, the hook loggers and the ArdorApplication default all come from the same factory.
describe('debug lines are off by default, and LoggerFactory.use decides otherwise', () => {
  test('with DEBUG unset the logger of a helper and a LoggerFactory logger drop debug and keep info', () => {
    const lines = runLines({ body: LOG_ALL });

    expect(debugLines(lines)).toEqual([]);
    expect(lines.filter((line) => line.includes('shown'))).toHaveLength(2);
  });

  test('DEBUG=1 turns debug on, as it does for every IGNIS provider (a server, not a browser)', () => {
    const lines = runLines({ debug: '1', body: LOG_ALL });

    expect(debugLines(lines)).toHaveLength(2);
  });

  test('LoggerFactory.use({ level: LogLevels.INFO }) silences debug whatever DEBUG says', () => {
    const lines = runLines({
      debug: '1',
      body: `LoggerFactory.use({ level: LogLevels.INFO }); ${LOG_ALL}`,
    });

    expect(debugLines(lines)).toEqual([]);
    expect(lines.filter((line) => line.includes('shown'))).toHaveLength(2);
  });

  test('LoggerFactory.use({ level: LogLevels.DEBUG }) turns debug on with DEBUG unset', () => {
    const lines = runLines({ body: `LoggerFactory.use({ level: LogLevels.DEBUG }); ${LOG_ALL}` });

    expect(debugLines(lines)).toHaveLength(2);
  });
});
