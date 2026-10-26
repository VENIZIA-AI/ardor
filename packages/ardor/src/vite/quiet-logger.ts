import { ConsoleLogger, LoggerFactory } from '@venizia/ignis-helpers';
import { type ILogger, LogLevels, type TLogLevel } from '@venizia/ignis-helpers/core';

/** IGNIS's resolver logs why git was unavailable at debug level; a Vite build has no use for those lines. */
class QuietDebugLogger implements ILogger {
  constructor(private readonly inner: ILogger) {}

  debug(): void {}

  info(message: string, ...args: unknown[]): void {
    this.inner.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.inner.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.inner.error(message, ...args);
  }

  emerg(message: string, ...args: unknown[]): void {
    this.inner.emerg(message, ...args);
  }

  log(level: TLogLevel, message: string, ...args: unknown[]): void {
    if (level !== LogLevels.DEBUG) {
      this.inner.log(level, message, ...args);
    }
  }

  for(methodName: string): ILogger {
    return new QuietDebugLogger(this.inner.for(methodName));
  }
}

/** The default IGNIS logger needs winston, which a frontend app does not install. */
export const useQuietConsoleLogger = (): void => {
  LoggerFactory.use({
    provider: { get: (scope) => new QuietDebugLogger(ConsoleLogger.get({ scope })) },
  });
};
