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
    const result = run([IMPORT, 'export const a: ISendParams = { method: RequestMethods.PATCH };']);

    expect(result.text).toBe(
      text([
        `import { HTTP } from ${COMMON}`,
        'export const a: ISendParams = { method: HTTP.Methods.PATCH };',
      ]),
    );
    expect(result.renamed).toBe(1);
    expect(result.findings).toEqual([]);
  });

  test('keeps the other names of the ARDOR import and adds to an import of the module', () => {
    const result = run([
      `import { HTTP as Http } from ${COMMON}`,
      "import { App, RequestMethods, type TRequestMethod } from '@venizia/ardor-kernel';",
      'export const a: ISendParams = { method: RequestMethods.GET };',
      'export type A = TRequestMethod;',
      'export const b = App;',
    ]);

    expect(result.text).toBe(
      text([
        `import { HTTP as Http, type THttpMethod } from ${COMMON}`,
        "import { App } from '@venizia/ardor-kernel';",
        'export const a: ISendParams = { method: Http.Methods.GET };',
        'export type A = THttpMethod;',
        'export const b = App;',
      ]),
    );
    expect(result.findings).toEqual([]);
  });

  const SENDERS = [
    "import { DefaultNetworkRequestService, DefaultRestDataProvider, type IDataProvider } from '@venizia/ardor';",
    'declare const provider: IDataProvider;',
    'declare const service: DefaultNetworkRequestService;',
  ];

  test.each([
    'provider.send({ resource, params: { method: RequestMethods.PATCH } });',
    'provider.getNetworkService().doRequest({ method: RequestMethods.PATCH });',
    'service.doRequest({ method: RequestMethods.PATCH });',
    'class A { constructor(private readonly data: IDataProvider) {} go() { this.data.send({ params: { method: RequestMethods.GET } }); } }',
    'class A extends DefaultRestDataProvider { go() { this.send({ params: { method: RequestMethods.GET } }); } }',
    'class A extends DefaultNetworkRequestService { go() { this.doRequest({ method: RequestMethods.GET }); } }',
    'export const a: ISendParams = { method: RequestMethods.PATCH };',
    'export const a = { method: RequestMethods.PATCH } satisfies ISendParams;',
  ])('rewrites %p', (line) => {
    const result = run([IMPORT, ...SENDERS, line]);

    expect(result.renamed).toBe(1);
    expect(result.findings).toEqual([]);
  });

  test('follows an aliased import', () => {
    const result = run([
      "import { RequestMethods as Methods } from '@venizia/ardor';",
      'export const s: ISendParams = { method: Methods.POST };',
    ]);

    expect(result.text).toContain('export const s: ISendParams = { method: HTTP.Methods.POST };');
  });

  test('is done after one run', () => {
    const once = run([IMPORT, 'export const a: ISendParams = { method: RequestMethods.GET };']);

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
    ['a socket send', 'socket.send(JSON.stringify({ method: RequestMethods.PATCH }));'],
    ['a socket send of params', 'ws.send({ params: { method: RequestMethods.POST } });'],
    ['a doRequest of an unknown receiver', 'client.doRequest({ method: RequestMethods.POST });'],
    [
      'a this.send of another class',
      'class A { go() { this.send({ params: { method: RequestMethods.POST } }); } }',
    ],
    ['a request of another client', 'http.request({ method: RequestMethods.GET });'],
    ['a request a subclass hands on', 'this.request({ resource, method: RequestMethods.PATCH });'],
    ['a fetch inside a send', 'a.send(() => fetch(url, { method: RequestMethods.PATCH }));'],
    ['a value held in a variable', 'const init = { method: RequestMethods.GET };'],
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
      'export const a: ISendParams = { method: RequestMethods.GET };',
      'export const a = RequestMethods.values();',
    ]);

    expect(result.text).toBe(
      text([
        `import { HTTP } from ${COMMON}`,
        IMPORT,
        'export const a: ISendParams = { method: HTTP.Methods.GET };',
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
    const lines = [IMPORT, line, 'export const a: ISendParams = { method: RequestMethods.GET };'];
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
      'export const a: ISendParams = { method: RequestMethods.GET };',
    ];

    expect(run(lines)).toEqual({ text: text(lines), renamed: 0, findings: [] });
  });
});

describe('HttpMethodsTransform: bindings and other spellings', () => {
  const SEND = 'export const s: ISendParams = { method: RequestMethods.GET };';

  test('keeps a default import', () => {
    const result = run(["import X, { RequestMethods } from '@venizia/ardor';", SEND, 'X;']);

    expect(result.text).toContain("import X from '@venizia/ardor';");
  });

  test.each([
    `import type { HTTP } from ${COMMON}`,
    `import { type HTTP, x } from ${COMMON}`,
    "import HTTP from './h';",
    "import * as HTTP from './h';",
    'enum HTTP { A }',
  ])('leaves a file where %p takes HTTP', (line) => {
    const lines = [IMPORT, line, SEND];

    expect(run(lines).text).toBe(text(lines));
    expect(found(lines).length).toBeGreaterThan(0);
  });

  test('uses an import of the module whatever statement holds it', () => {
    const result = run([
      `import { sleep } from ${COMMON}`,
      `import { HTTP } from ${COMMON}`,
      IMPORT,
      SEND,
    ]);

    expect(result.text).toBe(
      text([
        `import { sleep } from ${COMMON}`,
        `import { HTTP } from ${COMMON}`,
        'export const s: ISendParams = { method: HTTP.Methods.GET };',
      ]),
    );
  });

  test('does not import THttpMethod twice', () => {
    const result = run([
      `import type { THttpMethod } from ${COMMON}`,
      "import type { TRequestMethod } from '@venizia/ardor';",
      'export type A = TRequestMethod;',
    ]);

    expect(result.text).toBe(
      text([`import type { THttpMethod } from ${COMMON}`, 'export type A = THttpMethod;']),
    );
  });

  test.each(['export { RequestMethods };', 'export type A = typeof RequestMethods;'])(
    'keeps the import for %p',
    (line) => {
      const result = run([IMPORT, SEND, line]);

      expect(result.text).toContain(IMPORT);
      expect(result.findings.map((finding) => finding.line)).toEqual([3]);
    },
  );

  test.each([
    ["import * as Ardor from '@venizia/ardor';", 'export const a = Ardor.RequestMethods.PATCH;'],
    ["import '@venizia/ardor';", "export type A = import('@venizia/ardor').TRequestMethod;"],
    ["import '@venizia/ardor';", "const { RequestMethods } = await import('@venizia/ardor');"],
  ])('lists %p %p', (first, second) => {
    expect(found([first, second])).toContain(2);
  });
});

describe('HttpMethodsTransform: what makes a receiver unsure', () => {
  const HEAD = [
    IMPORT,
    "import { DefaultNetworkRequestService, type IDataProvider } from '@venizia/ardor';",
  ];

  test('lists every doRequest of a file that overrides doRequest', () => {
    const lines = [
      ...HEAD,
      'class A extends DefaultNetworkRequestService {',
      '  override doRequest(o) { return super.doRequest(o); }',
      '  go() { return this.doRequest({ method: RequestMethods.GET }); }',
      '}',
    ];

    expect(run(lines).text).toBe(text(lines));
    expect(found(lines)).toEqual([5]);
  });

  test('lists a name that two declarations type differently', () => {
    const lines = [
      ...HEAD,
      'const a = (api: IDataProvider) => api;',
      'const b = (api: WebSocket) => api.send({ params: { method: RequestMethods.POST } });',
    ];

    expect(found(lines)).toEqual([4]);
  });

  test('lists a type of the same name from another package', () => {
    const lines = [
      IMPORT,
      "import type { IDataProvider } from 'ra-core';",
      'const a = (api: IDataProvider) => api.send({ params: { method: RequestMethods.POST } });',
    ];

    expect(found(lines)).toEqual([3]);
  });
});
