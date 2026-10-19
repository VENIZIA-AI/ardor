import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { BaseService } from '@/base/services/base';
import { BaseHelper } from '@/helpers/base-helper';
import { Logger, LogLevels } from '@/helpers/logger';

const consoleDebugSpy = spyOn(console, 'debug').mockImplementation(() => {});
const consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
const consoleSpies = [consoleDebugSpy, consoleInfoSpy, consoleWarnSpy, consoleErrorSpy];

afterEach(() => {
  for (const spy of consoleSpies) {
    spy.mockClear();
  }
});

afterAll(() => {
  for (const spy of consoleSpies) {
    spy.mockRestore();
  }
});

describe('LogLevels const class', () => {
  test('SCHEME_SET and isValid accept only the four declared levels', () => {
    const declared = [LogLevels.DEBUG, LogLevels.INFO, LogLevels.WARN, LogLevels.ERROR];

    expect(LogLevels.SCHEME_SET.size).toBe(declared.length);
    for (const level of declared) {
      expect(LogLevels.isValid(level)).toBe(true);
    }

    expect(LogLevels.isValid('trace')).toBe(false);
    expect(LogLevels.isValid('DEBUG')).toBe(false);
    expect(LogLevels.isValid('')).toBe(false);
  });
});

describe('generateLog', () => {
  test('prefixes a string message with an ISO timestamp, log level, and scope while preserving extra args', () => {
    const logger = Logger.getInstance({ scope: 'auth-service' });
    const result = logger.generateLog({
      level: LogLevels.INFO,
      message: 'user authenticated',
      args: [42, { tenant: 'ardor-app' }],
    });

    expect(result.message).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - \[info\]\t\[auth-service\]user authenticated$/,
    );
    expect(result.args).toEqual([42, { tenant: 'ardor-app' }]);
  });

  test('moves a non-string message into the args array while keeping timestamp, level, and scope in message', () => {
    const logger = Logger.getInstance({ scope: 'network-service' });
    const payload = { status: 500, detail: 'Internal error' };
    const result = logger.generateLog({
      level: LogLevels.ERROR,
      message: payload,
      args: ['correlation-id-999'],
    });

    expect(result.message).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - \[error\]\t\[network-service\]$/,
    );
    expect(result.args).toEqual([payload, 'correlation-id-999']);
  });
});

describe('log level gating via Logger.getInstance({ scope, enableDebug })', () => {
  test('prints nothing when debug is called with debug logging disabled', () => {
    const logger = Logger.getInstance({ scope: 'render-pipeline', enableDebug: false });
    logger.debug('frame dropped', { frame: 12 });

    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  test('prints to console.debug when debug is called with debug logging enabled', () => {
    const logger = Logger.getInstance({ scope: 'render-pipeline', enableDebug: true });
    logger.debug('frame rendered', 16.6);

    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    expect(consoleDebugSpy.mock.calls[0]?.[0]).toMatch(
      /\[debug\]\t\[render-pipeline\]frame rendered$/,
    );
    expect(consoleDebugSpy.mock.calls[0]?.[1]).toBe(16.6);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  test('prints to console.info when info is called regardless of debug state', () => {
    const logger = Logger.getInstance({ scope: 'session-store', enableDebug: false });
    logger.info('session established', 'user-001');

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy.mock.calls[0]?.[0]).toMatch(
      /\[info\]\t\[session-store\]session established$/,
    );
    expect(consoleInfoSpy.mock.calls[0]?.[1]).toBe('user-001');
  });

  test('prints to console.warn when warn is called regardless of debug state', () => {
    const logger = Logger.getInstance({ scope: 'cache-manager', enableDebug: false });
    logger.warn('cache miss limit reached', 100);

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toMatch(
      /\[warn\]\t\[cache-manager\]cache miss limit reached$/,
    );
    expect(consoleWarnSpy.mock.calls[0]?.[1]).toBe(100);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  test('prints to console.error when error is called regardless of debug state', () => {
    const logger = Logger.getInstance({ scope: 'database-client', enableDebug: false });
    logger.error('connection timeout', 'primary-replica');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(
      /\[error\]\t\[database-client\]connection timeout$/,
    );
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toBe('primary-replica');
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });
});

describe('getInstance', () => {
  test('returns one instance per scope, so every line names the class that wrote it', () => {
    const primary = Logger.getInstance({ scope: 'primary-scope', enableDebug: false });
    const secondary = Logger.getInstance({ scope: 'secondary-scope', enableDebug: true });

    expect(primary).not.toBe(secondary);
    expect(primary['scope']).toBe('primary-scope');
    expect(secondary['scope']).toBe('secondary-scope');
    expect(Logger.getInstance({ scope: 'primary-scope' })).toBe(primary);
  });

  test('enableDebug on getInstance is the single process-wide switch for every scope', () => {
    const primary = Logger.getInstance({ scope: 'primary-scope' });
    Logger.getInstance({ scope: 'secondary-scope', enableDebug: true });

    expect(primary['isDebugEnabled']).toBe(true);

    Logger.getInstance({ scope: 'primary-scope', enableDebug: false });
    expect(Logger.getInstance({ scope: 'secondary-scope' })['isDebugEnabled']).toBe(false);
    expect('toggleDebug' in primary).toBe(false);
  });
});

describe('BaseService and BaseHelper hierarchy', () => {
  test('BaseService extends BaseHelper and shares the scoped Logger instance', () => {
    const service = new BaseService({ scope: 'OrderService' });

    expect(service).toBeInstanceOf(BaseHelper);
    expect(service['logger']).toBe(Logger.getInstance({ scope: 'OrderService' }));
  });
});
