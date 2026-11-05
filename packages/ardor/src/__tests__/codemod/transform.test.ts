import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { NamespaceTransform } from '@/codemod/transform';

const run = (text: string, opts: { hooks?: boolean; fileName?: string } = {}) =>
  NamespaceTransform.run({
    ts,
    fileName: opts.fileName ?? 'sample.ts',
    text,
    hooks: opts.hooks ?? false,
  });

describe('NamespaceTransform: functions', () => {
  test('moves a function to its class, in the import and at every use', () => {
    const result = run(
      [
        "import { isDefined, other } from '@venizia/ardor-kernel';",
        '',
        'export const keep = (items: Array<number | undefined>) => items.filter(isDefined);',
        'export const one = isDefined(1);',
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        "import { other, ValueUtility } from '@venizia/ardor-kernel';",
        '',
        'export const keep = (items: Array<number | undefined>) => items.filter(ValueUtility.isDefined);',
        'export const one = ValueUtility.isDefined(1);',
        '',
      ].join('\n'),
    );
    expect(result.renamed).toBe(2);
    expect(result.findings).toEqual([]);
  });

  test('maps each function to its own class member', () => {
    const result = run(
      [
        'import {',
        '  createAppDispatch,',
        '  createAppSelectors,',
        '  getRuntimeConfig,',
        '  hasPendingFeatureMessages,',
        '  isBrowser,',
        '  loadFeatureMessages,',
        '  resolveApplicationProviders,',
        '  toDataUrl,',
        "} from '@venizia/ardor';",
        '',
        'const a = [createAppDispatch, createAppSelectors, getRuntimeConfig, isBrowser, toDataUrl];',
        'const b = [hasPendingFeatureMessages, loadFeatureMessages, resolveApplicationProviders];',
        '',
      ].join('\n'),
    );

    // A multi-line import stays multi-line, one name per line, in the order the old names came.
    expect(result.text).toBe(
      [
        'import {',
        '  DispatchHooks,',
        '  SelectorHooks,',
        '  RuntimeConfig,',
        '  Features,',
        '  BrowserUtility,',
        '  ApplicationProviders,',
        '  FileUtility,',
        "} from '@venizia/ardor';",
        '',
        'const a = [DispatchHooks.create, SelectorHooks.create, RuntimeConfig.get, BrowserUtility.isBrowser, FileUtility.toDataUrl];',
        'const b = [Features.hasPendingMessages, Features.loadMessages, ApplicationProviders.resolve];',
        '',
      ].join('\n'),
    );
  });

  test('keeps an import of the class that is already there, once', () => {
    const result = run(
      [
        "import { Features, hasPendingFeatureMessages, loadFeatureMessages } from '@venizia/ardor-admin';",
        '',
        'export const x = [hasPendingFeatureMessages, loadFeatureMessages, Features];',
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        "import { Features } from '@venizia/ardor-admin';",
        '',
        'export const x = [Features.hasPendingMessages, Features.loadMessages, Features];',
        '',
      ].join('\n'),
    );
  });

  test('follows an aliased import and a shorthand property', () => {
    const result = run(
      [
        "import { getRuntimeConfig as config, isDefined } from '@venizia/ardor-kernel';",
        '',
        'export const a = config({ key: "X" });',
        'export const b = { isDefined };',
        '',
      ].join('\n'),
    );

    expect(result.text).toContain('RuntimeConfig.get({ key: "X" })');
    expect(result.text).toContain('{ isDefined: ValueUtility.isDefined }');
    expect(result.text).toContain(
      "import { RuntimeConfig, ValueUtility } from '@venizia/ardor-kernel';",
    );
  });

  test('does not touch a property, a member or a key with the same name', () => {
    const result = run(
      [
        "import { isDefined } from '@venizia/ardor-kernel';",
        '',
        'export const a = { isDefined: 1 };',
        'export const b = a.isDefined;',
        'export const c = isDefined(b);',
        '',
      ].join('\n'),
    );

    expect(result.text).toContain('{ isDefined: 1 }');
    expect(result.text).toContain('a.isDefined;');
    expect(result.text).toContain('ValueUtility.isDefined(b)');
    expect(result.renamed).toBe(1);
  });

  test('leaves the same name from another package alone', () => {
    const text = "import { isDefined } from 'lodash-like';\nexport const a = isDefined(1);\n";

    expect(run(text).text).toBe(text);
  });

  test('is idempotent', () => {
    const once = run(
      "import { isDefined } from '@venizia/ardor';\nexport const a = isDefined(1);\n",
    );

    expect(run(once.text).text).toBe(once.text);
    expect(run(once.text).renamed).toBe(0);
  });

  test('leaves an unused import as it is', () => {
    const text = "import { isDefined } from '@venizia/ardor';\nexport const a = 1;\n";

    expect(run(text).text).toBe(text);
  });
});

describe('NamespaceTransform: what it leaves for the owner', () => {
  test('a name the file also declares', () => {
    const text = [
      "import { isDefined } from '@venizia/ardor-kernel';",
      '',
      'export const run = (isDefined: boolean) => isDefined;',
      '',
    ].join('\n');
    const result = run(text);

    expect(result.text).toBe(text);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.name).toBe('isDefined');
    expect(result.findings[0]?.line).toBe(1);
  });

  test('a class name already taken by something else', () => {
    const text = [
      "import { isDefined } from '@venizia/ardor-kernel';",
      "import { ValueUtility } from './mine';",
      '',
      'export const a = [isDefined, ValueUtility];',
      '',
    ].join('\n');
    const result = run(text);

    expect(result.text).toBe(text);
    expect(result.findings[0]?.reason).toContain('already taken');
  });

  test('a class imported as a type only', () => {
    const text = [
      "import { isDefined } from '@venizia/ardor-kernel';",
      "import type { ValueUtility } from '@venizia/ardor-kernel';",
      '',
      'export const a = isDefined(1);',
      '',
    ].join('\n');

    expect(run(text).text).toBe(text);
    expect(run(text).findings[0]?.reason).toContain('type only');
  });

  test('a re-export by name', () => {
    const result = run(
      [
        "import { isDefined } from '@venizia/ardor-kernel';",
        '',
        'export { isDefined };',
        'export const a = isDefined(1);',
        '',
      ].join('\n'),
    );

    expect(result.findings.map((finding) => finding.reason)).toEqual([
      expect.stringContaining('re-exported by name'),
    ]);
    // The call is still rewritten; only the re-export is left.
    expect(result.text).toContain('ValueUtility.isDefined(1)');
  });
});

describe('NamespaceTransform: hooks', () => {
  const SOURCE = [
    "import { useRepository, type TUseTranslateFn } from '@venizia/ardor';",
    '',
    'export const Orders = () => useRepository({ key: "repositories.Orders" });',
    '',
  ].join('\n');

  test('does nothing to a hook without --hooks', () => {
    expect(run(SOURCE).text).toBe(SOURCE);
  });

  test('moves a hook imported from the umbrella to Ardor.useX', () => {
    const result = run(SOURCE, { hooks: true });

    expect(result.text).toBe(
      [
        "import { type TUseTranslateFn, Ardor } from '@venizia/ardor';",
        '',
        'export const Orders = () => Ardor.useRepository({ key: "repositories.Orders" });',
        '',
      ].join('\n'),
    );
  });

  test('never moves a hook imported from the react or admin package', () => {
    const react =
      "import { useRepository } from '@venizia/ardor-react';\nexport const a = useRepository;\n";
    const admin =
      "import { useTranslate } from '@venizia/ardor-admin';\nexport const a = useTranslate;\n";

    expect(run(react, { hooks: true }).text).toBe(react);
    expect(run(admin, { hooks: true }).text).toBe(admin);
  });

  test('moves only the umbrella import of a file that also uses a package alone', () => {
    const result = run(
      [
        "import { useService } from '@venizia/ardor-react';",
        "import { useRepository } from '@venizia/ardor';",
        '',
        'export const a = [useService, useRepository];',
        '',
      ].join('\n'),
      { hooks: true },
    );

    expect(result.text).toContain('[useService, Ardor.useRepository]');
    expect(result.text).toContain("import { useService } from '@venizia/ardor-react';");
  });

  test('works in a .tsx file with a JSX attribute of the same name', () => {
    const result = run(
      [
        "import { useDebounce } from '@venizia/ardor';",
        '',
        'export const Box = () => {',
        '  const { debouncedValue } = useDebounce({ value: 1, delay: 5 });',
        '',
        '  return <input useDebounce={debouncedValue} />;',
        '};',
        '',
      ].join('\n'),
      { hooks: true, fileName: 'sample.tsx' },
    );

    expect(result.text).toContain('Ardor.useDebounce({ value: 1, delay: 5 })');
    expect(result.text).toContain('<input useDebounce={debouncedValue} />');
  });
});

describe('NamespaceTransform: types that became plain types', () => {
  test('rewrites the type and drops a type-only import', () => {
    const result = run(
      [
        "import type { NumberIdType, StringIdType } from '@venizia/ardor-kernel';",
        '',
        'export interface IRow {',
        '  id: NumberIdType;',
        '  name: StringIdType;',
        '}',
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      ['export interface IRow {', '  id: number;', '  name: string;', '}', ''].join('\n'),
    );
    expect(result.renamed).toBe(2);
  });

  test('keeps the exact old definition of NullableType and wraps it where a union needs parentheses', () => {
    const result = run(
      [
        "import { type NullableType, other } from '@venizia/ardor';",
        '',
        'export type A = string | NullableType;',
        'export type B = NullableType[];',
        'export type C = Array<NullableType>;',
        'export const keep = other;',
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        "import { other } from '@venizia/ardor';",
        '',
        'export type A = string | undefined | null | void;',
        'export type B = (undefined | null | void)[];',
        'export type C = Array<undefined | null | void>;',
        'export const keep = other;',
        '',
      ].join('\n'),
    );
  });

  test('leaves a type of the same name from another package alone', () => {
    const text = "import type { NumberIdType } from './mine';\nexport type A = NumberIdType;\n";

    expect(run(text).text).toBe(text);
  });
});

describe('NamespaceTransform: ISendResponse', () => {
  test('renames the import and every use to INetworkResponse, generics and indexes included', () => {
    const result = run(
      [
        "import { type ISendResponse, type ISendParams } from '@venizia/ardor';",
        '',
        'export type A = ISendResponse<number>;',
        "export type B = ISendResponse['data'];",
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        "import { type ISendParams, type INetworkResponse } from '@venizia/ardor';",
        '',
        'export type A = INetworkResponse<number>;',
        "export type B = INetworkResponse['data'];",
        '',
      ].join('\n'),
    );
  });

  test('renames a use in extends and implements', () => {
    const result = run(
      [
        "import type { ISendResponse } from '@venizia/ardor';",
        'export interface Mine extends ISendResponse<number> {}',
        'export class Impl implements ISendResponse<string> {}',
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        "import type { INetworkResponse } from '@venizia/ardor';",
        'export interface Mine extends INetworkResponse<number> {}',
        'export class Impl implements INetworkResponse<string> {}',
        '',
      ].join('\n'),
    );
  });

  test('imports INetworkResponse once for two imports of ISendResponse', () => {
    const result = run(
      [
        "import type { ISendResponse } from '@venizia/ardor-kernel';",
        "import { type ISendResponse as Other } from '@venizia/ardor';",
        'export type A = [ISendResponse, Other];',
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        "import type { INetworkResponse } from '@venizia/ardor-kernel';",
        'export type A = [INetworkResponse, INetworkResponse];',
        '',
      ].join('\n'),
    );
  });

  test('lists it when the file already declares INetworkResponse itself', () => {
    const text = [
      "import type { ISendResponse } from '@venizia/ardor';",
      'type INetworkResponse = number;',
      'export type A = ISendResponse;',
      '',
    ].join('\n');
    const result = run(text);

    expect(result.text).toBe(text);
    expect(result.findings.map((finding) => finding.name)).toEqual(['ISendResponse']);
  });
});

describe('NamespaceTransform: removed with no replacement', () => {
  test('lists a destructured offset and filter["offset"] in a file that imports the list filter', () => {
    const result = run(
      [
        "import type { IListFilter } from '@venizia/ardor';",
        'export const a = (f: IListFilter) => { const { offset } = f; return offset; };',
        "export const b = (f: IListFilter) => f['offset'];",
        'export const c = () => { const [offset, setOffset] = useState(0); return [offset, setOffset]; };',
        '',
      ].join('\n'),
    );

    expect(result.findings.map((finding) => [finding.name, finding.line])).toEqual([
      ['.offset', 2],
      ['.offset', 3],
    ]);
  });

  test('lists .offset in a file that imports the list filter, and not elsewhere', () => {
    const filter = [
      "import type { IListFilter } from '@venizia/ardor';",
      'export const a = (f: IListFilter) => f.offset;',
      'export const b: IListFilter = { where: {}, offset: 5 };',
      '',
    ].join('\n');
    const other =
      "import { App } from '@venizia/ardor';\nexport const a = (f: { offset: number }) => f.offset;\n";

    expect(run(filter).findings.map((finding) => [finding.name, finding.line])).toEqual([
      ['.offset', 2],
      ['.offset', 3],
    ]);
    expect(run(other).findings).toEqual([]);
  });

  test('lists a removed export at its import and changes nothing', () => {
    const text = [
      "import { isEditableTarget, type ISyncFC, type TDataCount } from '@venizia/ardor';",
      '',
      'export const a = isEditableTarget;',
      '',
    ].join('\n');
    const result = run(text);

    expect(result.text).toBe(text);
    expect(result.findings.map((finding) => finding.name)).toEqual([
      'isEditableTarget',
      'ISyncFC',
      'TDataCount',
    ]);
    expect(result.findings.every((finding) => finding.reason.startsWith('removed:'))).toBe(true);
  });

  test('lists the removed hooks useSizer and useInjectableContainer at their import', () => {
    const text = [
      "import { useInjectableContainer, useSizer } from '@venizia/ardor';",
      '',
      'export const a = [useInjectableContainer, useSizer];',
      '',
    ].join('\n');
    const result = run(text);

    expect(result.text).toBe(text);
    expect(result.findings.map((finding) => finding.name)).toEqual([
      'useInjectableContainer',
      'useSizer',
    ]);
  });

  test('lists the removed static members with their line', () => {
    const result = run(
      [
        "import { App, HeaderConstants } from '@venizia/ardor-kernel';",
        '',
        'export const locale = App.DEFAULT_LOCALE;',
        'export const header = HeaderConstants.RESPONSE_FORMAT;',
        'export const kept = HeaderConstants.REQUEST_TRACING_ID;',
        '',
      ].join('\n'),
    );

    expect(result.findings.map((finding) => [finding.name, finding.line])).toEqual([
      ['App.DEFAULT_LOCALE', 3],
      ['HeaderConstants.RESPONSE_FORMAT', 4],
    ]);
  });

  test('does not list a member of a class imported from elsewhere', () => {
    const result = run(
      "import { App } from './mine';\nimport { x } from '@venizia/ardor';\nexport const a = [App.DEFAULT_LOCALE, x];\n",
    );

    expect(result.findings).toEqual([]);
  });
});
