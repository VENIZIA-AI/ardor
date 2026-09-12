import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import { Logger } from '@/helpers/logger';

const consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});

afterEach(() => {
  consoleInfoSpy.mockClear();
});

afterAll(() => {
  consoleInfoSpy.mockRestore();
});

describe('generateLog', () => {
  test('prefixes a string message with an ISO timestamp, log level, and scope while preserving extra args', () => {
    const logger = new Logger({ scope: 'auth-service' });
    const result = logger.generateLog({
      level: 'info',
      message: 'user authenticated',
      args: [42, { tenant: 'ardor-app' }],
    });

    expect(result.message).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - \[info\]\t\[auth-service\]user authenticated$/,
    );
    expect(result.args).toEqual([42, { tenant: 'ardor-app' }]);
  });

  test('moves a non-string message into the args array while keeping timestamp, level, and scope in message', () => {
    const logger = new Logger({ scope: 'network-service' });
    const payload = { status: 500, detail: 'Internal error' };
    const result = logger.generateLog({
      level: 'error',
      message: payload,
      args: ['correlation-id-999'],
    });

    expect(result.message).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - \[error\]\t\[network-service\]$/,
    );
    expect(result.args).toEqual([payload, 'correlation-id-999']);
  });
});

describe('log level gating', () => {
  test('prints nothing when debug is called with debug logging disabled', () => {
    const logger = new Logger({ scope: 'render-pipeline', enableDebug: false });
    logger.debug('frame dropped', { frame: 12 });

    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  test('prints to console.info when debug is called with debug logging enabled', () => {
    const logger = new Logger({ scope: 'render-pipeline', enableDebug: true });
    logger.debug('frame rendered', 16.6);

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy.mock.calls[0]?.[0]).toMatch(
      /\[debug\]\t\[render-pipeline\]frame rendered$/,
    );
    expect(consoleInfoSpy.mock.calls[0]?.[1]).toBe(16.6);
  });

  test('prints to console.info when info is called regardless of debug state', () => {
    const logger = new Logger({ scope: 'session-store', enableDebug: false });
    logger.info('session established', 'user-001');

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy.mock.calls[0]?.[0]).toMatch(
      /\[info\]\t\[session-store\]session established$/,
    );
    expect(consoleInfoSpy.mock.calls[0]?.[1]).toBe('user-001');
  });

  test('prints to console.info when warn is called regardless of debug state', () => {
    const logger = new Logger({ scope: 'cache-manager', enableDebug: false });
    logger.warn('cache miss limit reached', 100);

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy.mock.calls[0]?.[0]).toMatch(
      /\[warn\]\t\[cache-manager\]cache miss limit reached$/,
    );
    expect(consoleInfoSpy.mock.calls[0]?.[1]).toBe(100);
  });

  test('prints to console.info when error is called regardless of debug state', () => {
    const logger = new Logger({ scope: 'database-client', enableDebug: false });
    logger.error('connection timeout', 'primary-replica');

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy.mock.calls[0]?.[0]).toMatch(
      /\[error\]\t\[database-client\]connection timeout$/,
    );
    expect(consoleInfoSpy.mock.calls[0]?.[1]).toBe('primary-replica');
  });
});

describe('toggleDebug', () => {
  test('disables debug logging when state is false even if previously enabled', () => {
    const logger = new Logger({ scope: 'worker', enableDebug: true });
    logger.toggleDebug({ state: false });
    logger.debug('suppressed message');

    expect(logger['isDebugEnabled']).toBe(false);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  test('enables debug logging when state is true', () => {
    const logger = new Logger({ scope: 'worker', enableDebug: false });
    logger.toggleDebug({ state: true });
    logger.debug('visible message');

    expect(logger['isDebugEnabled']).toBe(true);
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
  });

  test('flips the current debug state when called with no arguments', () => {
    const logger = new Logger({ scope: 'worker', enableDebug: false });

    logger.toggleDebug();
    expect(logger['isDebugEnabled']).toBe(true);
    logger.debug('first flip emits');
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);

    logger.toggleDebug();
    expect(logger['isDebugEnabled']).toBe(false);
    logger.debug('second flip suppresses');
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
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

  test('enableDebug is one switch for every scope', () => {
    const primary = Logger.getInstance({ scope: 'primary-scope' });
    Logger.getInstance({ scope: 'secondary-scope', enableDebug: true });

    expect(primary['isDebugEnabled']).toBe(true);

    primary.toggleDebug({ state: false });
    expect(Logger.getInstance({ scope: 'secondary-scope' })['isDebugEnabled']).toBe(false);
  });
});
