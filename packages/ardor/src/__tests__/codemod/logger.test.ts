import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { Migration } from '@/codemod/migrate';

const run = (text: string, fileName = 'sample.ts') =>
  Migration.run({ ts, fileName, text, hooks: false });
const lines = (...parts: string[]) => `${parts.join('\n')}\n`;

describe('the move off the kernel logger: imports that only change package', () => {
  test('BaseHelper, LogLevels, ILogger and TLogLevel keep their names and move to ignis core', () => {
    const result = run(
      lines(
        "import { BaseHelper, type ILogger, LogLevels, type TLogLevel, BaseService } from '@venizia/ardor';",
        '',
        'export class Mine extends BaseHelper {}',
        'export const level: TLogLevel = LogLevels.INFO;',
        'export const keep: ILogger | undefined = undefined;',
        'export const service = BaseService;',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { BaseHelper, type ILogger, LogLevels, type TLogLevel } from '@venizia/ignis-helpers/core';",
        "import { BaseService } from '@venizia/ardor';",
        '',
        'export class Mine extends BaseHelper {}',
        'export const level: TLogLevel = LogLevels.INFO;',
        'export const keep: ILogger | undefined = undefined;',
        'export const service = BaseService;',
      ),
    );
    expect(result.findings).toEqual([]);
  });

  test('adds to an ignis core import the file already has, and drops an import left empty', () => {
    const result = run(
      lines(
        "import { BaseHelper } from '@venizia/ardor-kernel';",
        "import { type ILogger } from '@venizia/ignis-helpers/core';",
        '',
        'export class Mine extends BaseHelper {}',
        'export const x: ILogger | null = null;',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { type ILogger, BaseHelper } from '@venizia/ignis-helpers/core';",
        '',
        'export class Mine extends BaseHelper {}',
        'export const x: ILogger | null = null;',
      ),
    );
  });
});

describe('the move off the kernel logger: Logger', () => {
  test('Logger.getInstance({ scope }) becomes LoggerFactory.getLogger of that scope', () => {
    const result = run(
      lines(
        "import { Logger } from '@venizia/ardor';",
        '',
        "const logger = Logger.getInstance({ scope: 'Orders' });",
        'export const other = Logger.getInstance({ scope: Mine.name });',
        'export const short = (scope: string) => Logger.getInstance({ scope });',
        'class Mine {}',
        'export { logger, Mine };',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { LoggerFactory } from '@venizia/ignis-helpers/core';",
        '',
        "const logger = LoggerFactory.getLogger(['Orders']);",
        'export const other = LoggerFactory.getLogger([Mine.name]);',
        'export const short = (scope: string) => LoggerFactory.getLogger([scope]);',
        'class Mine {}',
        'export { logger, Mine };',
      ),
    );
    expect(result.findings).toEqual([]);
  });

  test('drops enableDebug and says so in a note, not as work left', () => {
    const result = run(
      lines(
        "import { Logger } from '@venizia/ardor-kernel';",
        '',
        "export const a = Logger.getInstance({ scope: 'A', enableDebug: true });",
      ),
    );

    expect(result.text).toContain("LoggerFactory.getLogger(['A'])");
    expect(result.text).not.toContain('enableDebug');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.kind).toBe('note');
    expect(result.findings[0]?.reason).toContain('LoggerFactory.use({ level: LogLevels.DEBUG })');
    expect(result.findings[0]?.line).toBe(3);
  });

  test('new Logger({ scope }) is rewritten the same way', () => {
    const result = run(
      lines(
        "import { Logger } from '@venizia/ardor';",
        '',
        "export const a = new Logger({ scope: 'A' });",
      ),
    );

    expect(result.text).toContain("export const a = LoggerFactory.getLogger(['A']);");
  });

  test('a Logger annotation becomes ILogger, and the import follows', () => {
    const result = run(
      lines(
        "import { Logger } from '@venizia/ardor';",
        '',
        'export interface IHolder {',
        '  logger: Logger;',
        '}',
        'export const f = (logger: Logger | null) => logger;',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { type ILogger } from '@venizia/ignis-helpers/core';",
        '',
        'export interface IHolder {',
        '  logger: ILogger;',
        '}',
        'export const f = (logger: ILogger | null) => logger;',
      ),
    );
  });

  test('lists what it cannot rewrite, keeps Logger imported, and still rewrites the rest', () => {
    const result = run(
      lines(
        "import { Logger } from '@venizia/ardor';",
        '',
        "export const ok = Logger.getInstance({ scope: 'A' });",
        'export class Sub extends Logger {}',
        'export const dynamic = (options: { scope: string }) => Logger.getInstance(options);',
        'export const spread = (o: object) => Logger.getInstance({ ...o });',
        'export const is = (x: unknown) => x instanceof Logger;',
      ),
    );

    expect(result.text).toContain("export const ok = LoggerFactory.getLogger(['A']);");
    expect(result.text).toContain("import { Logger } from '@venizia/ardor';");
    expect(result.findings.map((finding) => finding.line)).toEqual([4, 5, 6, 7]);
    expect(result.findings.every((finding) => finding.kind === undefined)).toBe(true);
  });

  test('leaves a Logger from another package alone', () => {
    const text = lines(
      "import { Logger } from 'winston';",
      '',
      "export const a = Logger.getInstance({ scope: 'A' });",
    );

    expect(run(text).text).toBe(text);
  });

  test('is idempotent', () => {
    const once = run(
      lines(
        "import { Logger } from '@venizia/ardor';",
        "export const a = Logger.getInstance({ scope: 'A' });",
      ),
    );

    expect(run(once.text).text).toBe(once.text);
  });
});

describe('the move off the kernel logger: the enableDebug prop', () => {
  test('is listed on ArdorApplication and nothing is changed', () => {
    const text = lines(
      "import { ArdorApplication } from '@venizia/ardor';",
      '',
      'export const Shell = () => <ArdorApplication enableDebug container={c} />;',
      'declare const c: never;',
    );
    const result = run(text, 'shell.tsx');

    expect(result.text).toBe(text);
    expect(result.findings.map((finding) => [finding.name, finding.line])).toEqual([
      ['enableDebug', 3],
    ]);
    expect(result.findings[0]?.reason).toContain('logger');
  });

  test('is not listed on another component', () => {
    const result = run(
      lines(
        "import { ArdorApplication } from '@venizia/ardor';",
        "import { Other } from './other';",
        '',
        'export const Shell = () => <Other enableDebug />;',
        'export { ArdorApplication };',
      ),
      'shell.tsx',
    );

    expect(result.findings).toEqual([]);
  });
});

// A downstream project's BaseHelper subclasses extend a copy in its own kit, not ARDOR's: the codemod follows the import
// source, so a BaseHelper that does not come from an ARDOR package is never touched.
describe("a BaseHelper, LoggerFactory or ILogger the file owns is not ARDOR's", () => {
  test('a BaseHelper from another module is left alone, whatever else the file imports from ARDOR', () => {
    const text = lines(
      "import { BaseHelper } from '@/kits/core';",
      "import { BaseService } from '@venizia/ardor';",
      '',
      'export class A extends BaseHelper {}',
      'export class B extends BaseService {}',
    );
    const result = run(text);

    expect(result.text).toBe(text);
    expect(result.findings).toEqual([]);
  });

  test('a local BaseHelper does not clash: Logger becomes LoggerFactory and the BaseHelper stays', () => {
    const result = run(
      lines(
        "import { BaseHelper } from '@/kits/core';",
        "import { Logger } from '@venizia/ardor-kernel';",
        '',
        "const logger = Logger.getInstance({ scope: 'A' });",
        'export class A extends BaseHelper {}',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { BaseHelper } from '@/kits/core';",
        "import { LoggerFactory } from '@venizia/ignis-helpers/core';",
        '',
        "const logger = LoggerFactory.getLogger(['A']);",
        'export class A extends BaseHelper {}',
      ),
    );
  });

  test("IGNIS's LoggerFactory is imported under an alias when the file already has its own", () => {
    const result = run(
      lines(
        "import { LoggerFactory } from '@/kits/core';",
        "import { Logger } from '@venizia/ardor-kernel';",
        '',
        "const logger = Logger.getInstance({ scope: 'A' });",
        'export const mine = LoggerFactory;',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { LoggerFactory } from '@/kits/core';",
        "import { LoggerFactory as IgnisLoggerFactory } from '@venizia/ignis-helpers/core';",
        '',
        "const logger = IgnisLoggerFactory.getLogger(['A']);",
        'export const mine = LoggerFactory;',
      ),
    );
  });

  test('the alias is used as well when the file declares LoggerFactory or ILogger itself', () => {
    const result = run(
      lines(
        "import { Logger } from '@venizia/ardor-kernel';",
        '',
        'class LoggerFactory {}',
        'interface ILogger {}',
        "const logger = Logger.getInstance({ scope: 'A' });",
        'export const typed: Logger | null = null;',
        'export { LoggerFactory, type ILogger };',
      ),
    );

    expect(result.text).toBe(
      lines(
        "import { LoggerFactory as IgnisLoggerFactory, type ILogger as IgnisILogger } from '@venizia/ignis-helpers/core';",
        '',
        'class LoggerFactory {}',
        'interface ILogger {}',
        "const logger = IgnisLoggerFactory.getLogger(['A']);",
        'export const typed: IgnisILogger | null = null;',
        'export { LoggerFactory, type ILogger };',
      ),
    );
  });
});
