import { getError } from '@venizia/ignis-inversion';

const applicationLogger = console;

export type TLogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class Logger implements ILogger {
  private static instances = new Map<string, Logger>();
  private static debugEnabled = false;

  protected scope: string;

  constructor(opts: { scope: string; enableDebug?: boolean }) {
    this.scope = opts.scope;
    if (opts.enableDebug !== undefined) {
      Logger.debugEnabled = opts.enableDebug;
    }
  }

  /**
   * One logger per scope, so every line names the class that wrote it. `enableDebug` is a
   * process-wide switch: passing it from any scope flips debug logging for all of them.
   */
  static getInstance(opts: { scope: string; enableDebug?: boolean }): Logger {
    let instance = Logger.instances.get(opts.scope);
    if (!instance) {
      instance = new Logger({ scope: opts.scope });
      Logger.instances.set(opts.scope, instance);
    }

    if (opts.enableDebug !== undefined) {
      Logger.debugEnabled = opts.enableDebug;
    }
    return instance;
  }

  protected get isDebugEnabled(): boolean {
    return Logger.debugEnabled;
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  toggleDebug(opts?: { state: boolean }) {
    Logger.debugEnabled = opts ? opts.state : !Logger.debugEnabled;
  }

  generateLog(opts: { level: TLogLevel; message: any; args: any[] }) {
    const { level, message, args } = opts;
    const timestamp = this.getTimestamp();

    switch (typeof message) {
      case 'string': {
        return {
          message: `${timestamp} - [${level}]\t[${this.scope}]${message}`,
          args,
        };
      }
      default: {
        return {
          message: `${timestamp} - [${level}]\t[${this.scope}]`,
          args: [message, ...args],
        };
      }
    }
  }

  private log(level: TLogLevel, message: any, ...args: any[]) {
    if (!applicationLogger) {
      throw getError({ message: '[info] Invalid logger instance!' });
    }

    if (level === 'debug' && !this.isDebugEnabled) {
      return;
    }

    const generated = this.generateLog({ level, message, args });
    applicationLogger.info(generated.message, ...generated.args);
  }

  debug(message: any, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  info(message: any, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: any, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: any, ...args: any[]) {
    this.log('error', message, ...args);
  }
}
