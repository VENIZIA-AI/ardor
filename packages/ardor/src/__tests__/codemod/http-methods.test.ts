import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { HttpMethodsTransform } from '@/codemod/http-methods';

const run = (lines: string[]) =>
  HttpMethodsTransform.run({
    ts,
    fileName: 'sample.ts',
    text: [...lines, ''].join('\n'),
    hooks: false,
  });
const text = (lines: string[]) => [...lines, ''].join('\n');
const found = (lines: string[]) => run(lines).findings.map((finding) => finding.line);
const IMPORT = "import { RequestMethods } from '@venizia/ardor';";
const COMMON = "'@venizia/ignis-helpers/common';";

describe('HttpMethodsTransform: what it rewrites', () => {
  test('rewrites a method property and moves the import', () => {
    const result = run([IMPORT, 'api.send({ method: RequestMethods.PATCH });']);

    expect(result.text).toBe(
      text([`import { HTTP } from ${COMMON}`, 'api.send({ method: HTTP.Methods.PATCH });']),
    );
    expect(result.renamed).toBe(1);
    expect(result.findings).toEqual([]);
  });

  test('keeps the other names of the ARDOR import and adds to an import of the module', () => {
    const result = run([
      `import { HTTP as Http } from ${COMMON}`,
      "import { App, RequestMethods, type TRequestMethod } from '@venizia/ardor-kernel';",
      'export const a: { method: TRequestMethod } = { method: RequestMethods.GET };',
      'export const b = App;',
    ]);

    expect(result.text).toBe(
      text([
        `import { HTTP as Http, type THttpMethod } from ${COMMON}`,
        "import { App } from '@venizia/ardor-kernel';",
        'export const a: { method: THttpMethod } = { method: Http.Methods.GET };',
        'export const b = App;',
      ]),
    );
    expect(result.findings).toEqual([]);
  });

  test.each([
    'provider.send({ params: { method: RequestMethods.PATCH } });',
    'service.doRequest({ method: RequestMethods.PATCH });',
    'this.request({ method: RequestMethods.PATCH });',
  ])('rewrites the patch of %p', (line) => {
    expect(run([IMPORT, line]).findings).toEqual([]);
  });

  test('follows an aliased import', () => {
    const result = run([
      "import { RequestMethods as Methods } from '@venizia/ardor';",
      'send({ method: Methods.POST });',
    ]);

    expect(result.text).toContain('send({ method: HTTP.Methods.POST });');
  });

  test('is done after one run', () => {
    const once = run([IMPORT, 'send({ method: RequestMethods.GET });']);

    expect(
      HttpMethodsTransform.run({ ts, fileName: 'sample.ts', text: once.text, hooks: false }),
    ).toEqual({ text: once.text, renamed: 0, findings: [] });
  });
});

describe('HttpMethodsTransform: what it lists and leaves', () => {
  test.each([
    ['a comparison', 'export const a = (m: string) => m === RequestMethods.GET;'],
    ['a case clause', 'switch (m) { case RequestMethods.GET: break; }'],
    ['a list', 'export const a = [RequestMethods.GET].includes(m);'],
    ['a computed key', 'export const a = { [RequestMethods.GET]: 1 };'],
    ['isValid', 'export const a = RequestMethods.isValid(m);'],
    ['values', 'export const a = RequestMethods.values();'],
    ['a call of fetch', 'fetch(url, { method: RequestMethods.PATCH });'],
    ['a new Request', 'new Request(url, { method: RequestMethods.GET });'],
    ['a patch held for later', 'const init = { method: RequestMethods.PATCH };'],
    ['a patch to another call', 'client.go({ method: RequestMethods.PATCH });'],
    ['the class itself', 'export type A = typeof RequestMethods;'],
  ])('lists %s and keeps the import', (_, line) => {
    const result = run([IMPORT, line]);

    expect(result.text).toBe(text([IMPORT, line]));
    expect(result.renamed).toBe(0);
    expect(result.findings.map((finding) => finding.line)).toEqual([2]);
  });

  test('rewrites what it can and keeps the import for the rest', () => {
    const result = run([
      IMPORT,
      'send({ method: RequestMethods.GET });',
      'export const a = RequestMethods.values();',
    ]);

    expect(result.text).toBe(
      text([
        `import { HTTP } from ${COMMON}`,
        IMPORT,
        'send({ method: HTTP.Methods.GET });',
        'export const a = RequestMethods.values();',
      ]),
    );
    expect(result.findings.map((finding) => finding.line)).toEqual([3]);
  });

  test.each([
    ["import { HTTP } from '@venizia/ignis-helpers';", 'HTTP'],
    ['const HTTP = 1;', 'HTTP'],
    ['const call = (RequestMethods: string) => RequestMethods;', 'RequestMethods'],
  ])('leaves a file where %p takes the name', (line) => {
    const lines = [IMPORT, line, 'send({ method: RequestMethods.GET });'];
    const result = run(lines);

    expect(result.text).toBe(text(lines));
    expect(result.findings.length).toBeGreaterThan(0);
  });

  test('lists a re-export', () => {
    expect(found(["export { RequestMethods } from '@venizia/ardor';"])).toEqual([1]);
  });

  test('leaves the same names of another package', () => {
    const lines = [
      "import { RequestMethods } from 'other';",
      "import { App } from '@venizia/ardor';",
      'send({ method: RequestMethods.GET });',
    ];

    expect(run(lines)).toEqual({ text: text(lines), renamed: 0, findings: [] });
  });
});
