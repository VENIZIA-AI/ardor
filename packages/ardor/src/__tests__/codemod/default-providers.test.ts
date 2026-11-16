import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { CoreBindings } from '@venizia/ardor-kernel';

import { DefaultProvidersTransform } from '@/codemod/default-providers';

const run = (text: string) =>
  DefaultProvidersTransform.run({ ts, fileName: 'sample.ts', text, hooks: false });

const IMPORT = [
  'import {',
  '  type BaseArdorApplication as TArdorApplication,',
  '  configuration,',
  '  CoreBindings,',
  '  CountRestDataProvider,',
  '  DefaultAuthProvider,',
  '  inject,',
  '  provide,',
  "} from '@venizia/ardor';",
  '',
  '',
].join('\n');

const configuration = (body: string): string =>
  `${IMPORT}@configuration()\nexport class ShopConfiguration {\n${body}\n}\n`;

// IMPORT takes lines 1 to 10, @configuration() is line 11 and the first member is line 13.
const FIRST_MEMBER_LINE = 13;

describe('DefaultProvidersTransform', () => {
  test('lists a default provider wired by hand, with what to do, and never changes the text', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })',
        '  authProvider() {',
        '    return this.application.instantiate(DefaultAuthProvider).value(this.application);',
        '  }',
      ].join('\n'),
    );
    const result = run(before);

    expect(result.text).toBe(before);
    expect(result.renamed).toBe(0);
    expect(result.findings).toEqual([
      {
        line: FIRST_MEMBER_LINE,
        name: 'authProvider(): instantiate(DefaultAuthProvider).value()',
        reason:
          'delete this method and the APPLICATION_INSTANCE it injects if nothing else uses it: ARDOR binds DefaultAuthProvider itself',
      },
    ]);
  });

  test('lists a subclass bound under a default key, and says to bind it in bindContext()', () => {
    const result = run(
      configuration(
        [
          '  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })',
          '  restDataProvider() {',
          '    return this.application.instantiate(CountRestDataProvider).value(this.application);',
          '  }',
        ].join('\n'),
      ),
    );

    expect(result.findings).toEqual([
      {
        line: FIRST_MEMBER_LINE,
        name: 'restDataProvider(): instantiate(CountRestDataProvider).value()',
        reason:
          'replace this method by one line in bindContext(): .toProvider(CountRestDataProvider).setScope(BindingScopes.SINGLETON) on the key, and delete the APPLICATION_INSTANCE it injects if nothing else uses it',
      },
    ]);
  });

  test('says .toClass(...) for a class that is built bare, not as a provider', () => {
    const result = run(
      configuration(
        [
          '  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })',
          '  restDataProvider() {',
          '    return this.application.instantiate(CountRestDataProvider);',
          '  }',
        ].join('\n'),
      ),
    );

    expect(result.findings).toEqual([
      {
        line: FIRST_MEMBER_LINE,
        name: 'restDataProvider(): instantiate(CountRestDataProvider)',
        reason:
          'replace this method by one line in bindContext(): .toClass(CountRestDataProvider).setScope(BindingScopes.SINGLETON) on the key, and delete the APPLICATION_INSTANCE it injects if nothing else uses it',
      },
    ]);
  });

  test('reads the string value of a default key', () => {
    const result = run(
      configuration(
        [
          "  @provide({ key: '@app/application/i18n/default' })",
          '  i18n() {',
          '    return app.instantiate(Translations).value(app);',
          '  }',
        ].join('\n'),
      ),
    );

    expect(result.findings.map((finding) => finding.name)).toEqual([
      'i18n(): instantiate(Translations).value()',
    ]);
  });

  test('reads each default key by its string value, as CoreBindings spells it', () => {
    const keys = [
      CoreBindings.DEFAULT_REST_DATA_PROVIDER,
      CoreBindings.DEFAULT_AUTH_PROVIDER,
      CoreBindings.DEFAULT_I18N_PROVIDER,
    ];

    for (const key of keys) {
      const result = run(
        configuration(
          [
            `  @provide({ key: '${key}' })`,
            '  provider() {',
            '    return this.application.instantiate(Mine).value(this.application);',
            '  }',
          ].join('\n'),
        ),
      );

      expect(result.findings.map((finding) => finding.name)).toEqual([
        'provider(): instantiate(Mine).value()',
      ]);
    }
  });

  test('lists a default class under another key, and says to bind it there: deleting the method would unbind the key', () => {
    const result = run(
      configuration(
        [
          '  @provide({ key: CoreBindings.PERMISSION_PROVIDER })',
          '  authProvider() {',
          '    return this.application.instantiate(DefaultAuthProvider).value(this.application);',
          '  }',
        ].join('\n'),
      ),
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.reason).toContain('.toProvider(DefaultAuthProvider)');
    expect(result.findings[0]?.reason).not.toContain('delete this method');
  });

  test('lists each method of a class, in order', () => {
    const result = run(
      configuration(
        [
          '  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })',
          '  authProvider() {',
          '    return this.application.instantiate(DefaultAuthProvider).value(this.application);',
          '  }',
          '',
          '  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })',
          '  restDataProvider() {',
          '    return this.application.instantiate(CountRestDataProvider).value(this.application);',
          '  }',
        ].join('\n'),
      ),
    );

    expect(result.findings.map((finding) => finding.line)).toEqual([
      FIRST_MEMBER_LINE,
      FIRST_MEMBER_LINE + 5,
    ]);
  });

  test('does not list options, another key with another class, a plain method or other code', () => {
    const before = configuration(
      [
        '  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })',
        '  options() {',
        "    return { url: 'x' };",
        '  }',
        '',
        '  @provide({ key: CoreBindings.PERMISSION_PROVIDER })',
        '  permissions() {',
        '    return this.application.instantiate(Permissions).value(this.application);',
        '  }',
        '',
        '  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })',
        '  built() {',
        '    return new MyAuthProvider();',
        '  }',
        '',
        '  plain() {',
        '    return this.application.instantiate(DefaultAuthProvider).value(this.application);',
        '  }',
      ].join('\n'),
    );

    expect(run(before)).toEqual({ text: before, renamed: 0, findings: [] });
  });
});
