import { describe, expect, spyOn, test } from 'bun:test';
import { BaseHelper, ConsoleLogger, type ILogger, LoggerSlot } from '@venizia/ignis-helpers/core';

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

// `this.logger` is what an application's services call (BANA has dozens of them), so it must stay on
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

/** The recipe the Breaking changelog entry and the debugging page give: the console logger with `debug` a no-op. */
const withoutDebug = (logger: ILogger): ILogger => ({
  debug: () => undefined,
  info: (message, ...args) => logger.info(message, ...args),
  warn: (message, ...args) => logger.warn(message, ...args),
  error: (message, ...args) => logger.error(message, ...args),
  emerg: (message, ...args) => logger.emerg(message, ...args),
  log: (level, message, ...args) => logger.log(level, message, ...args),
  for: (name) => withoutDebug(logger.for(name)),
});

// `enableDebug` is gone, so production silences debug with one resolver installed at startup, before the
// first log line. `new BaseHelper({ scope }).logger` follows the slot, so the services, the hooks and the
// ArdorApplication default (all built that way) go quiet together.
describe('an application silences debug lines through LoggerSlot', () => {
  test('a resolver installed first drops debug for a service, a provider and a plain helper, and keeps the rest', () => {
    const debug = spyOn(console, 'debug').mockImplementation(() => undefined);
    const info = spyOn(console, 'log').mockImplementation(() => undefined);
    const installed = LoggerSlot.resolve;

    try {
      LoggerSlot.use({
        resolver: ({ scopes }) => withoutDebug(ConsoleLogger.get({ scope: scopes.join('-') })),
      });

      const service = new OrderService();
      const provider = new PriceProvider();
      const plain = new BaseHelper({ scope: 'plain' }).logger;

      for (const logger of [service.logger, provider.logger, plain]) {
        logger.debug('[test] hidden');
        logger.info('[test] shown');
      }

      expect(debug).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledTimes(3);
    } finally {
      LoggerSlot.resolve = installed;
      debug.mockRestore();
      info.mockRestore();
    }
  });
});
