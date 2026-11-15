import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { CoreBindings } from '@venizia/ardor-kernel';

import { AuthOptionsTransform } from '@/codemod/auth-options';
import { readUpgradeBlock } from './migration-block';

const run = (text: string) =>
  AuthOptionsTransform.run({ ts, fileName: 'sample.ts', text, hooks: false });

const IMPORT = "import { configuration, CoreBindings, provide } from '@venizia/ardor';\n\n";

const configuration = (body: string): string =>
  `${IMPORT}@configuration()\nexport class AuthConfiguration {\n${body}\n}\n`;

describe('AuthOptionsTransform: a @provide method', () => {
  test('puts use: true first in a one-line literal', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  authProviderOptions() {',
        "    return { paths: { afterLogin: '/products' } };",
        '  }',
      ].join('\n'),
    );
    const result = run(before);

    expect(result.text).toBe(before.replace('return { paths:', 'return { use: true, paths:'));
    expect(result.renamed).toBe(1);
    expect(result.findings.map((finding) => finding.kind)).toEqual(['note']);
  });

  test('puts use: true on its own line, with the indent of the first property, in a multi-line literal', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  authProviderOptions() {',
        '    return {',
        "      paths: { afterLogin: '/products' },",
        '      sessionKey: "s",',
        '    };',
        '  }',
      ].join('\n'),
    );
    const result = run(before);

    expect(result.text).toBe(
      before.replace('return {\n      paths', 'return {\n      use: true,\n      paths'),
    );
    expect(result.renamed).toBe(1);
  });

  test('turns an empty literal into { use: true }', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  authProviderOptions() {',
        '    return {};',
        '  }',
      ].join('\n'),
    );

    expect(run(before).text).toBe(before.replace('return {};', 'return { use: true };'));
  });

  test('reads @provideOption, the string value of the key and an aliased CoreBindings', () => {
    const before = [
      "import { configuration, CoreBindings as Keys, provideOption } from '@venizia/ardor-kernel';",
      '',
      '@configuration()',
      'export class AuthConfiguration {',
      '  @provideOption({ key: Keys.AUTH_PROVIDER_OPTIONS })',
      '  one() {',
      "    return { paths: { afterLogin: '/a' } };",
      '  }',
      '',
      "  @provideOption({ key: '@app/application/options/auth' })",
      '  two() {',
      "    return { paths: { afterLogin: '/b' } };",
      '  }',
      '}',
      '',
    ].join('\n');
    const result = run(before);

    expect(result.text).toBe(before.replaceAll('return { paths', 'return { use: true, paths'));
    expect(result.renamed).toBe(2);
  });

  test('reads a decorator imported under another name', () => {
    const before = [
      "import { CoreBindings, provide as bindsKey } from '@venizia/ardor';",
      '',
      'export class AuthConfiguration {',
      '  @bindsKey({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
      '  options() {',
      '    return { paths: {} };',
      '  }',
      '}',
      '',
    ].join('\n');

    expect(run(before).text).toBe(before.replace('return { paths', 'return { use: true, paths'));
  });

  test('keeps a literal that already has use, true or false or shorthand', () => {
    for (const literal of [
      '{ use: true, paths: {} }',
      '{ paths: {}, use: false }',
      "{ 'use': true }",
      '{ use }',
    ]) {
      const before = configuration(
        [
          '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
          '  authProviderOptions() {',
          '    const use = true;',
          `    return ${literal};`,
          '  }',
        ].join('\n'),
      );
      const result = run(before);

      expect(result.text).toBe(before);
      expect(result.renamed).toBe(0);
      expect(result.findings).toEqual([]);
    }
  });

  test('puts use: true before a spread, which keeps the last word', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  authProviderOptions() {',
        '    return { ...base, paths: {} };',
        '  }',
      ].join('\n'),
    );

    expect(run(before).text).toBe(before.replace('{ ...base,', '{ use: true, ...base,'));
  });

  test('reads through parentheses, satisfies and as, and async methods', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  async authProviderOptions() {',
        '    return ({ paths: {} } satisfies TAuthProviderOptions);',
        '  }',
      ].join('\n'),
    );

    expect(run(before).text).toBe(before.replace('({ paths', '({ use: true, paths'));
  });

  test('changes every returned literal of one method and ignores a nested function', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  authProviderOptions() {',
        '    const inner = () => ({ other: 1 });',
        '    if (flag) {',
        '      return { a: 1 };',
        '    }',
        '    return { b: 2 };',
        '  }',
      ].join('\n'),
    );
    const result = run(before);

    expect(result.text).toBe(
      before.replace('{ a: 1 }', '{ use: true, a: 1 }').replace('{ b: 2 }', '{ use: true, b: 2 }'),
    );
    expect(result.renamed).toBe(2);
  });

  test('lists what is not a plain object literal and leaves it', () => {
    const cases: Array<{ body: string; line: number }> = [
      { body: '    return OPTIONS;', line: 5 },
      { body: '    return buildOptions();', line: 5 },
      { body: '    return { ...OPTIONS };', line: 5 },
      { body: '    return;', line: 5 },
    ];

    for (const { body, line } of cases) {
      const before = configuration(
        [
          '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
          '  authProviderOptions() {',
          body,
          '  }',
        ].join('\n'),
      );
      const result = run(before);

      expect(result.text).toBe(before);
      expect(result.renamed).toBe(0);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.kind).toBeUndefined();
      expect(result.findings[0]?.name).toBe('CoreBindings.AUTH_PROVIDER_OPTIONS');
      expect(result.findings[0]?.line).toBe(line + 2);
    }
  });

  test('lists a method with no return at all', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  authProviderOptions() {',
        '    log();',
        '  }',
      ].join('\n'),
    );
    const result = run(before);

    expect(result.text).toBe(before);
    expect(result.findings).toHaveLength(1);
  });

  test('does not touch another key, another decorator or an undecorated method', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })',
        '  rest() {',
        "    return { url: 'x' };",
        '  }',
        '',
        '  @other({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
        '  stray() {',
        '    return { a: 1 };',
        '  }',
        '',
        '  plain() {',
        '    return { b: 1 };',
        '  }',
      ].join('\n'),
    );
    const result = run(before);

    expect(result.text).toBe(before);
    expect(result.findings).toEqual([]);
  });
});

describe('AuthOptionsTransform: the type of the options', () => {
  const typed = (opts: { returnType: string; value: string; importName?: string }): string =>
    [
      `import { configuration, CoreBindings, ${opts.importName ?? 'IAuthProviderOptions'}, provide } from '@venizia/ardor';`,
      '',
      '@configuration()',
      'export class AuthConfiguration {',
      '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
      `  authProviderOptions()${opts.returnType} {`,
      `    return ${opts.value};`,
      '  }',
      '}',
      '',
    ].join('\n');

  test('adds use: true and lists a return type of IAuthProviderOptions, which has no use', () => {
    const result = run(typed({ returnType: ': IAuthProviderOptions', value: '{ paths: {} }' }));

    expect(result.text).toBe(
      typed({ returnType: ': IAuthProviderOptions', value: '{ use: true, paths: {} }' }),
    );
    expect(result.findings.filter((finding) => finding.kind === undefined)).toEqual([
      {
        line: 6,
        name: 'IAuthProviderOptions',
        reason: 'it has no use, so the options no longer fit it: type them as TAuthProviderOptions',
      },
    ]);
  });

  test('lists a satisfies or as of IAuthProviderOptions, and an alias of it', () => {
    for (const value of [
      '{ paths: {} } satisfies IAuthProviderOptions',
      '({ paths: {} } as IAuthProviderOptions)',
    ]) {
      const result = run(typed({ returnType: '', value }));

      expect(result.renamed).toBe(1);
      expect(result.findings.filter((finding) => finding.kind === undefined)).toHaveLength(1);
    }

    const aliased = run(
      typed({
        returnType: ': Options',
        value: '{ paths: {} }',
        importName: 'IAuthProviderOptions as Options',
      }),
    );

    expect(aliased.findings.filter((finding) => finding.kind === undefined)).toHaveLength(1);
  });

  test('lists nothing for a return type of TAuthProviderOptions', () => {
    const result = run(
      typed({
        returnType: ': TAuthProviderOptions',
        value: '{ paths: {} }',
        importName: 'TAuthProviderOptions',
      }),
    );

    expect(result.findings.filter((finding) => finding.kind === undefined)).toEqual([]);
    expect(result.renamed).toBe(1);
  });
});

describe('AuthOptionsTransform: a @provideOption method without a return type', () => {
  const option = (opts: { returnType: string; decorator?: string }): string =>
    configuration(
      [
        `  @${opts.decorator ?? 'provideOption'}({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })`,
        `  authProviderOptions()${opts.returnType} {`,
        '    return { use: true, paths: {} };',
        '  }',
      ].join('\n'),
    );

  test('adds use: true and lists the method, because the literal would be typed use: boolean', () => {
    const before = option({ returnType: '' }).replace('use: true, ', '');
    const result = run(before);

    expect(result.text).toBe(option({ returnType: '' }));
    expect(result.findings.filter((finding) => finding.kind === undefined)).toEqual([
      {
        line: 6,
        name: 'provideOption',
        reason:
          'a method without a return type reads use: true as boolean, which the key does not accept: declare the return type TAuthProviderOptions',
      },
    ]);
  });

  test('lists nothing for a declared return type, or for @provide, which the compiler does not check', () => {
    for (const text of [
      option({ returnType: ': TAuthProviderOptions' }).replace('use: true, ', ''),
      option({ returnType: '', decorator: 'provide' }).replace('use: true, ', ''),
    ]) {
      const result = run(text);

      expect(result.renamed).toBe(1);
      expect(result.findings.filter((finding) => finding.kind === undefined)).toEqual([]);
    }
  });
});

describe('AuthOptionsTransform: bind().toValue()', () => {
  const bind = (value: string) =>
    [
      "import { CoreBindings } from '@venizia/ardor';",
      '',
      'export class App {',
      '  bindContext() {',
      `    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(${value});`,
      '  }',
      '}',
      '',
    ].join('\n');

  test('puts use: true first in the literal', () => {
    const result = run(bind("{ paths: { afterLogin: '/x' } }"));

    expect(result.text).toBe(bind("{ use: true, paths: { afterLogin: '/x' } }"));
    expect(result.renamed).toBe(1);
  });

  test('reads the string value of the key', () => {
    const before = "app.bind({ key: '@app/application/options/auth' }).toValue({ paths: {} });\n";

    expect(run(before).text).toBe(
      "app.bind({ key: '@app/application/options/auth' }).toValue({ use: true, paths: {} });\n",
    );
  });

  test('keeps a literal that has use', () => {
    const before = bind('{ use: false }');

    expect(run(before).text).toBe(before);
    expect(run(before).findings).toEqual([]);
  });

  test('lists a value that is not a literal', () => {
    for (const value of ['OPTIONS', 'make()', '{ ...OPTIONS }']) {
      const before = bind(value);
      const result = run(before);

      expect(result.text).toBe(before);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.line).toBe(5);
    }
  });

  test('does not touch toValue of another key or toProvider of this one', () => {
    const before = [
      'app.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({ url: "x" });',
      'app.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toProvider(Options);',
      '',
    ].join('\n');

    expect(run(before)).toEqual({ text: before, renamed: 0, findings: [] });
  });
});

describe('AuthOptionsTransform: the key', () => {
  test('the string value the codemod reads is the value of CoreBindings.AUTH_PROVIDER_OPTIONS', () => {
    const before = `app.bind({ key: '${CoreBindings.AUTH_PROVIDER_OPTIONS}' }).toValue({ paths: {} });\n`;

    expect(run(before).renamed).toBe(1);
  });

  test('a second run changes nothing', () => {
    const first = run(
      configuration(
        [
          '  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })',
          '  authProviderOptions() {',
          '    return { paths: {} };',
          '  }',
        ].join('\n'),
      ),
    );
    const second = run(first.text);

    expect(second).toEqual({ text: first.text, renamed: 0, findings: [] });
  });
});

describe('the auth-provider-toggle block of the 0.4.8 migration', () => {
  test('the codemod turns the before snippet into the after snippet', () => {
    const { before, after, codemod } = readUpgradeBlock({ id: 'auth-provider-toggle' });
    const wrap = (snippet: string): string => `class A {\n${snippet}\n}\n`;

    expect(codemod).toBe('auth-options');
    expect(run(wrap(before)).text).toBe(wrap(after));
  });
});
