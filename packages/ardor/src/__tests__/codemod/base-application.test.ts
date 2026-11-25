import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { BaseApplicationTransform } from '@/codemod/base-application';
import { readUpgradeBlock } from './migration-block';

const run = (text: string) =>
  BaseApplicationTransform.run({ ts, fileName: 'sample.ts', text, hooks: false });

const KERNEL = '@venizia/ardor-kernel';
const ADMIN = '@venizia/ardor-admin';

describe('BaseApplicationTransform: imports', () => {
  test('moves an import that names only BaseArdorApplication, keeping the quotes', () => {
    expect(run(`import { BaseArdorApplication } from '${KERNEL}';\n`)).toEqual({
      text: `import { BaseArdorApplication } from '${ADMIN}';\n`,
      renamed: 1,
      findings: [],
    });
    expect(run(`import { BaseArdorApplication } from "${KERNEL}"\n`).text).toBe(
      `import { BaseArdorApplication } from "${ADMIN}"\n`,
    );
  });

  test('splits an import that names other members, and keeps them in the kernel import', () => {
    const result = run(
      `import { AbstractArdorApplication, BaseArdorApplication, CoreBindings } from '${KERNEL}';\n`,
    );

    expect(result.text).toBe(
      [
        `import { AbstractArdorApplication, CoreBindings } from '${KERNEL}';`,
        `import { BaseArdorApplication } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
    expect(result.renamed).toBe(1);
  });

  test('splits a multi-line import without changing the layout of what stays', () => {
    const result = run(
      [
        'import {',
        '  AbstractArdorApplication,',
        '  BaseArdorApplication,',
        '  CoreBindings,',
        `} from '${KERNEL}';`,
        '',
      ].join('\n'),
    );

    expect(result.text).toBe(
      [
        'import {',
        '  AbstractArdorApplication,',
        '  CoreBindings,',
        `} from '${KERNEL}';`,
        `import { BaseArdorApplication } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
  });

  test('keeps an alias and a type modifier on the specifier', () => {
    expect(
      run(`import { type BaseArdorApplication as TApp, CoreBindings } from '${KERNEL}';\n`).text,
    ).toBe(
      [
        `import { CoreBindings } from '${KERNEL}';`,
        `import { type BaseArdorApplication as TApp } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
    expect(run(`import { BaseArdorApplication as App } from '${KERNEL}';\n`).text).toBe(
      `import { BaseArdorApplication as App } from '${ADMIN}';\n`,
    );
  });

  test('keeps import type on the moved import and on what stays', () => {
    expect(run(`import type { BaseArdorApplication } from '${KERNEL}';\n`).text).toBe(
      `import type { BaseArdorApplication } from '${ADMIN}';\n`,
    );
    expect(
      run(`import type { BaseArdorApplication, IApplicationInfo } from '${KERNEL}';\n`).text,
    ).toBe(
      [
        `import type { IApplicationInfo } from '${KERNEL}';`,
        `import type { BaseArdorApplication } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
  });

  test('joins an import of the admin package the file already has, when the type modifier is the same', () => {
    expect(
      run(
        [
          `import { BaseArdorApplication, CoreBindings } from '${KERNEL}';`,
          `import { DefaultRestDataProvider } from '${ADMIN}';`,
          '',
        ].join('\n'),
      ).text,
    ).toBe(
      [
        `import { CoreBindings } from '${KERNEL}';`,
        `import { DefaultRestDataProvider, BaseArdorApplication } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
    expect(
      run(
        [
          `import { BaseArdorApplication } from '${KERNEL}';`,
          `import { DefaultRestDataProvider } from '${ADMIN}';`,
          '',
        ].join('\n'),
      ).text,
    ).toBe(`import { DefaultRestDataProvider, BaseArdorApplication } from '${ADMIN}';\n`);
    expect(
      run(
        [
          `import type { BaseArdorApplication } from '${KERNEL}';`,
          `import { DefaultRestDataProvider } from '${ADMIN}';`,
          '',
        ].join('\n'),
      ).text,
    ).toBe(
      [
        `import type { BaseArdorApplication } from '${ADMIN}';`,
        `import { DefaultRestDataProvider } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
  });

  test('leaves an import from the umbrella package, the admin package and another name', () => {
    const before = [
      "import { BaseArdorApplication } from '@venizia/ardor';",
      `import { BaseArdorApplication as Other } from '${ADMIN}';`,
      `import { AbstractArdorApplication } from '${KERNEL}';`,
      "import { BaseArdorApplication } from './local';",
      '',
    ].join('\n');

    expect(run(before)).toEqual({ text: before, renamed: 0, findings: [] });
  });

  test('a second run changes nothing', () => {
    const first = run(`import { BaseArdorApplication, CoreBindings } from '${KERNEL}';\n`);

    expect(run(first.text)).toEqual({ text: first.text, renamed: 0, findings: [] });
  });
});

describe('BaseApplicationTransform: re-exports', () => {
  test('moves a re-export, and splits one that names other members', () => {
    expect(run(`export { BaseArdorApplication } from '${KERNEL}';\n`).text).toBe(
      `export { BaseArdorApplication } from '${ADMIN}';\n`,
    );
    expect(
      run(`export { CoreBindings, BaseArdorApplication as App } from '${KERNEL}';\n`).text,
    ).toBe(
      [
        `export { CoreBindings } from '${KERNEL}';`,
        `export { BaseArdorApplication as App } from '${ADMIN}';`,
        '',
      ].join('\n'),
    );
    expect(run(`export type { BaseArdorApplication } from '${KERNEL}';\n`).text).toBe(
      `export type { BaseArdorApplication } from '${ADMIN}';\n`,
    );
  });

  test('leaves an export without a module and a re-export from the umbrella package', () => {
    const before = [
      "export { BaseArdorApplication } from '@venizia/ardor';",
      'export { BaseArdorApplication };',
      '',
    ].join('\n');

    expect(run(before).text).toBe(before);
  });
});

describe('BaseApplicationTransform: what it lists', () => {
  test('lists a namespace import that reads BaseArdorApplication, and notes export *', () => {
    const before = [
      `import * as Kernel from '${KERNEL}';`,
      `export * from '${KERNEL}';`,
      'export class App extends Kernel.BaseArdorApplication {}',
      '',
    ].join('\n');
    const result = run(before);

    expect(result.text).toBe(before);
    expect(result.renamed).toBe(0);
    expect(result.findings.map((finding) => [finding.line, finding.level])).toEqual([
      [2, 'note'],
      [3, undefined],
    ]);
  });

  test('does not list a namespace import that never reads it', () => {
    const before = `import * as Kernel from '${KERNEL}';\nexport const a = Kernel.CoreBindings;\n`;

    expect(run(before).findings).toEqual([]);
  });

  test('lists a default import next to the member, and leaves the file', () => {
    const before = `import Kernel, { BaseArdorApplication } from '${KERNEL}';\n`;
    const result = run(before);

    expect(result.text).toBe(before);
    expect(result.findings).toHaveLength(1);
  });
});

describe('the base-application-moved block of the 0.4.8 migration', () => {
  test('the codemod turns the before snippet into the after snippet', () => {
    const { before, after, codemod } = readUpgradeBlock({ id: 'base-application-moved' });

    expect(codemod).toBe('base-application-import');
    expect(run(`${before}\n`).text).toBe(`${after}\n`);
  });
});
