import { describe, expect, test } from 'bun:test';
import * as ts from 'typescript';

import { NoAuthTransform } from '@/codemod/no-auth';

const run = (text: string) =>
  NoAuthTransform.run({ ts, fileName: 'sample.ts', text, hooks: false });

const IMPORT = "import { configuration } from '@venizia/ardor';\n\n";
const reasons = (text: string): string[] => run(text).findings.map((finding) => finding.reason);

describe('NoAuthTransform: what it rewrites', () => {
  test.each([
    ["{ url, noAuthPaths: ['/a'] }", "{ url, noAuth: { paths: ['/a'] } }"],
    ['{ url, noAuthPathRegex: /./ }', '{ url, noAuth: { regex: /./ } }'],
    ['{ url, noAuthPaths }', '{ url, noAuth: { paths: noAuthPaths } }'],
    ["{ 'noAuthPaths': a, url }", '{ noAuth: { paths: a }, url }'],
    [
      "{ url, noAuthPaths: ['/a'], noAuthPathRegex: /./ }",
      "{ url, noAuth: { paths: ['/a'], regex: /./ } }",
    ],
    ['{ noAuthPathRegex: r, url, noAuthPaths: p }', '{ noAuth: { regex: r, paths: p }, url }'],
    [
      '{\n  url,\n  noAuthPaths: p,\n  noAuthPathRegex: r,\n}',
      '{\n  url,\n  noAuth: { paths: p, regex: r },\n}',
    ],
    ['{\n  noAuthPaths: p,\n  noAuthPathRegex: r\n}', '{\n  noAuth: { paths: p, regex: r }\n}'],
  ])('rewrites %p', (from, to) => {
    const result = run(`${IMPORT}export const options = () => (${from});\n`);

    expect(result.text).toBe(`${IMPORT}export const options = () => (${to});\n`);
    expect(result.renamed).toBe(1);
  });

  test('rewrites the options of a super call and is done after one run', () => {
    const before = `${IMPORT}class A { constructor() { super({ name: 'a', noAuthPaths: ['/a'] }); } }\n`;
    const once = run(before);

    expect(once.text).toContain("super({ name: 'a', noAuth: { paths: ['/a'] } });");
    expect(run(once.text)).toEqual({ text: once.text, renamed: 0, findings: [] });
  });

  test('notes a literal held in a variable, since a spread of two would drop half', () => {
    const result = run(`${IMPORT}const options = { noAuthPaths: p };\n`);

    expect(result.renamed).toBe(1);
    expect(result.findings.map((finding) => finding.level)).toEqual(['note']);
  });
});

describe('NoAuthTransform: what it leaves and lists', () => {
  test.each([
    ['a spread beside the key', 'f({ ...base, noAuthPaths: p });', 'spread'],
    ['noAuth already there', 'f({ noAuth: {}, noAuthPaths: p });', 'already has noAuth'],
    ['a getter', 'f({ get noAuthPaths() { return p; } });', 'by hand'],
    ['a read', 'f(options.noAuthPaths);', 'options.noAuth?.paths'],
    ['an element read', "f(options['noAuthPathRegex']);", 'options.noAuth?.regex'],
    ['a destructuring', 'const { noAuthPaths } = options;', 'by hand'],
    ['a destructuring assignment', '({ noAuthPaths } = options);', 'by hand'],
    ['a type member', 'interface I { noAuthPaths?: string[] }', 'type'],
  ])('%s', (_name, code, reason) => {
    const text = `${IMPORT}${code}\n`;
    const result = run(text);

    expect(result.text).toBe(text);
    expect(reasons(text).join('\n')).toContain(reason);
  });

  test('a file that imports nothing from ARDOR is listed, not rewritten', () => {
    const text = 'export const options = { noAuthPaths: p };\n';

    expect(run(text).text).toBe(text);
    expect(reasons(text).join('\n')).toContain('imports nothing from ARDOR');
  });

  test('the protected members of a subclass are not listed', () => {
    const text = `${IMPORT}class A { f() { return [this.noAuthPaths, this.noAuthPathRegexes]; } }\n`;

    expect(run(text)).toEqual({ text, renamed: 0, findings: [] });
  });
});

describe('NoAuthTransform: a rewrite never drops half or breaks the code', () => {
  test.each([
    ['a literal under a spread', 'f({ url, ...{ noAuthPaths: p } });', 'spread'],
    ['a conditional spread', 'f({ ...(dev && { noAuthPathRegex: r }) });', 'spread'],
    ['a literal of a spread call', 'f({ ...base, ...make({ noAuthPaths: p }) });', 'spread'],
    ['Object.assign', 'Object.assign(options, { noAuthPaths: p });', 'spread'],
    [
      'the two halves in two literals',
      'const a = () => ({ noAuthPaths: p });\nconst b = () => ({ noAuthPathRegex: r });',
      'another object of this file',
    ],
    ['a computed name', "f({ ['noAuthPaths']: p, noAuthPathRegex: r });", 'by hand'],
    ['a comment inside a moved property', 'f({ noAuthPaths: /* why */ p });', 'comment'],
    [
      'a comment before the comma',
      'f({ noAuthPaths: p, noAuthPathRegex: r /* b */, url });',
      'comment',
    ],
    [
      'an old name inside a value',
      'f({ noAuthPaths: g({ noAuthPaths: p }), noAuthPathRegex: r });',
      'by hand',
    ],
    ['a for-of pattern', 'for ({ noAuthPaths } of list) {}', 'destructuring'],
    ['a nested pattern', '({ a: { noAuthPaths } } = x);', 'destructuring'],
    ['an array pattern', '[{ noAuthPathRegex }] = y;', 'destructuring'],
    ['a pattern with a default', 'for ({ noAuthPaths = d } of list) {}', 'destructuring'],
    [
      'a value typed INoAuthOptions',
      'const x: INoAuthOptions = { noAuthPaths: p };',
      'INoAuthOptions',
    ],
    [
      'satisfies INoAuthOptions',
      'f({ noAuthPaths: p } satisfies INoAuthOptions);',
      'INoAuthOptions',
    ],
  ])('lists %s and leaves the outer text', (_name, code, reason) => {
    const text = `${IMPORT}${code}\n`;
    const result = run(text);
    const outer = code.includes('g({') ? result.text.includes('g({ noAuth:') : result.text === text;

    expect(outer).toBe(true);
    expect(reasons(text).join('\n')).toContain(reason);
  });

  test.each([
    ['a type picked by name', "type T = Pick<O, 'noAuthPaths'>;"],
    ['an in test', "f('noAuthPaths' in options);"],
    ['a template element read', 'f(options[`noAuthPaths`]);'],
    ['a field of a class that implements the options', 'class A implements O { noAuthPaths = p; }'],
    ['the old regex name on this', 'class A { f() { return this.noAuthPathRegex; } }'],
  ])('lists %s', (_name, code) => {
    expect(run(`${IMPORT}${code}\n`).findings.length).toBeGreaterThan(0);
  });

  test.each([
    'const o = { noAuthPaths: p } satisfies O;',
    'const o = { noAuthPaths: p } as const;',
    'export default { noAuthPaths: p };',
    'const a = () => ({ noAuthPaths: p });',
  ])('notes %p, which a later merge could halve', (code) => {
    const result = run(`${IMPORT}${code}\n`);

    expect(result.renamed).toBe(1);
    expect(result.findings.map((finding) => finding.level)).toEqual(['note']);
  });

  test.each([
    'class A { f() { return { noAuthPaths: p }; } }',
    'x.bind({ key: k }).toValue({ noAuthPaths: p });',
    'class A extends B { constructor() { super({ noAuthPaths: p }); } }',
    'new DefaultNetworkRequestService({ noAuthPaths: p });',
  ])('says nothing for %p, which is handed straight over', (code) => {
    expect(run(`${IMPORT}${code}\n`).findings).toEqual([]);
  });
});
