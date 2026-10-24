import type { AnyType, TConstValue } from '@/common';

export class LogLevels {
  static readonly DEBUG = 'debug';
  static readonly INFO = 'info';
  static readonly WARN = 'warn';
  static readonly ERROR = 'error';

  static readonly SCHEME_SET = new Set([this.DEBUG, this.INFO, this.WARN, this.ERROR]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

export type TLogLevel = TConstValue<typeof LogLevels>;

export interface ILogger {
  debug(message: string, ...args: AnyType[]): void;
  info(message: string, ...args: AnyType[]): void;
  warn(message: string, ...args: AnyType[]): void;
  error(message: string, ...args: AnyType[]): void;
}

export class Logger implements ILogger {
  private static instances = new Map<string, Logger>();
  private static debugEnabled = false;
  private static readonly sink = console;

  protected scope: string;

  constructor(opts: { scope: string }) {
    this.scope = opts.scope;
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

  generateLog(opts: { level: TLogLevel; message: AnyType; args: AnyType[] }) {
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

  private log(opts: { level: TLogLevel; message: AnyType; args: AnyType[] }) {
    const { level, message, args } = opts;
    if (level === LogLevels.DEBUG && !this.isDebugEnabled) {
      return;
    }

    const generated = this.generateLog({ level, message, args });
    // Each level goes to the console method of the same name, so the browser's level filter and an
    // error-reporting hook on console.error both see it.
    Logger.sink[level](generated.message, ...generated.args);
  }

  debug(message: AnyType, ...args: AnyType[]) {
    this.log({ level: LogLevels.DEBUG, message, args });
  }

  info(message: AnyType, ...args: AnyType[]) {
    this.log({ level: LogLevels.INFO, message, args });
  }

  warn(message: AnyType, ...args: AnyType[]) {
    this.log({ level: LogLevels.WARN, message, args });
  }

  error(message: AnyType, ...args: AnyType[]) {
    this.log({ level: LogLevels.ERROR, message, args });
  }
}
