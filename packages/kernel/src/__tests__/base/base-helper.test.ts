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
