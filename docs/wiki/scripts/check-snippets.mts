/**
 * Every fenced ```ts / ```tsx block in content/ is compiled against the BUILT packages. A snippet
 * that names an export ARDOR does not have, or calls it with the wrong shape, fails the build - a
 * docs page is a claim about the API, and this is what makes the claim checkable.
 *
 * Fences opt out with an info string of `ts no-check` (a deliberately partial fragment) and the
 * block is still counted, so the report shows how much of the site is verified.
 *
 * Usage: bun scripts/check-snippets.ts   (from docs/wiki; exit 1 on the first failing snippet)
 */
import { Glob } from 'bun';
import ts from 'typescript';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const WIKI = resolve(import.meta.dir, '..');
const REPO = resolve(WIKI, '..', '..');
const CONTENT = join(WIKI, 'content');

const FENCE = /^```(tsx|typescript|ts)([^\n]*)\n([\s\S]*?)^```/gm;

/**
 * Ambient names a snippet may use without declaring - a docs fragment is not a module. Each one is
 * injected only when the snippet mentions it and does not declare it itself.
 */
const AMBIENT: Record<string, string> = {
  store:
    "import type { Store as PreludeStore } from '@reduxjs/toolkit';\ndeclare const store: PreludeStore;",
  Spinner:
    "import type { ReactNode as PreludeSpinnerNode } from 'react';\ndeclare const Spinner: () => PreludeSpinnerNode;",
  ProductList:
    "import type { ReactNode as PreludeListNode } from 'react';\ndeclare const ProductList: () => PreludeListNode;",
  ProductApi: 'declare class ProductApi {\n  find(): Promise<unknown[]>;\n}',
  messages: 'declare const messages: { app: { products: { title: string; empty: string } } };',
  container:
    "import type { Container as PreludeContainer } from '@venizia/ignis-inversion';\ndeclare const container: PreludeContainer;",
};

const preludeFor = (code: string): string => {
  const lines = Object.entries(AMBIENT)
    .filter(([name]) => new RegExp(`\\b${name}\\b`).test(code))
    .filter(
      ([name]) =>
        !new RegExp(`\\b(class|const|let|function|interface|type|enum)\\s+${name}\\b`).test(code),
    )
    .map(([, declaration]) => declaration);
  return `${lines.join('\n')}\nexport {};\n`;
};

type TSnippet = { file: string; line: number; code: string; lang: string; noCheck: boolean };

const collect = async (): Promise<TSnippet[]> => {
  const snippets: TSnippet[] = [];
  for await (const file of new Glob('**/*.md').scan(CONTENT)) {
    if (file.startsWith('changelogs/template')) {
      continue;
    }
    const text = await Bun.file(join(CONTENT, file)).text();
    for (const match of text.matchAll(FENCE)) {
      const line = text.slice(0, match.index).split('\n').length;
      snippets.push({
        file,
        line,
        lang:
          match[1] === 'tsx' ||
          /<[A-Za-z][\w.]*(\s[^<>]*)?>[\s\S]*?<\/[A-Za-z][\w.]*>|<[A-Za-z][\w.]*(\s[^<>]*)?\/>|return \(\s*</.test(
            match[3]!,
          )
            ? 'tsx'
            : 'ts',
        noCheck: /\bno-check\b/.test(match[2] ?? ''),
        code: match[3]!,
      });
    }
  }
  return snippets;
};

const snippets = await collect();

/**
 * `no-check` exists for excerpts a reader cannot run: a fragment with `...`, or a declaration body
 * shown for reading. Runnable code marked `no-check` is a page dodging the gate.
 */
const isExcerpt = (code: string): boolean => {
  const trimmed = code.trim();
  if (/(^|\n)\s*\/\/\s*\.\.\.|\.\.\.\s*(\n|$)|\.\.\.\s*\}/.test(trimmed)) {
    return true;
  }
  // A declaration excerpt, decided by the parser rather than by a regex: every statement is a
  // type, an interface, a class or a variable/function signature with no body and no initializer.
  const source = ts.createSourceFile('excerpt.ts', trimmed, ts.ScriptTarget.ESNext, true);
  return source.statements.every(statement => {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      return true;
    }
    if (ts.isClassDeclaration(statement)) {
      return statement.members.every(member => !('body' in member) || member.body === undefined);
    }
    if (ts.isFunctionDeclaration(statement)) {
      return statement.body === undefined;
    }
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.every(
        declaration => declaration.type !== undefined && declaration.initializer === undefined,
      );
    }
    return false;
  });
};

const abused = snippets.filter(snippet => snippet.noCheck && !isExcerpt(snippet.code));
if (abused.length > 0) {
  console.error(
    `snippet check FAILED - ${abused.length} runnable snippet(s) marked no-check (only excerpts with \`...\` or declaration bodies may opt out):\n  ${abused.map(snippet => `${snippet.file}:${snippet.line}`).join('\n  ')}`,
  );
  process.exit(1);
}
const checked = snippets.filter(snippet => !snippet.noCheck);
const dir = mkdtempSync(join(tmpdir(), 'ardor-docs-snippets-'));
// third-party types resolve from the admin package, which depends on everything the docs show
Bun.spawnSync(['ln', '-s', join(REPO, 'packages/admin/node_modules'), join(dir, 'node_modules')]);

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  types: [],
  // resolve the framework the way a consumer does: through the built packages
  paths: {
    '@venizia/ardor': [join(REPO, 'packages/ardor/dist/index.d.ts')],
    '@venizia/ardor-kernel': [join(REPO, 'packages/kernel/dist/index.d.ts')],
    '@venizia/ardor-react': [join(REPO, 'packages/react/dist/index.d.ts')],
    '@venizia/ardor-admin': [join(REPO, 'packages/admin/dist/index.d.ts')],
    '@venizia/ardor-ui-kit': [join(REPO, 'packages/ui-kit/dist/index.d.ts')],
  },
  typeRoots: [join(REPO, 'packages/admin/node_modules/@types')],
};

// One program per PAGE. A `declare module` augmentation is global to its program, so compiling every
// page together would let one page's augmentation change what another page's snippet accepts.
const byPage = new Map<string, TSnippet[]>();
for (const snippet of checked) {
  byPage.set(snippet.file, [...(byPage.get(snippet.file) ?? []), snippet]);
}

const problems: string[] = [];
let previous: ts.Program | undefined;

for (const [page, pageSnippets] of byPage) {
  const files = pageSnippets.map((snippet, index) => {
    const name = join(dir, `${page.replace(/[\/.]/g, '_')}-${index}.${snippet.lang}`);
    writeFileSync(name, `${preludeFor(snippet.code)}\n${snippet.code}`);
    return { name, snippet };
  });

  const program = ts.createProgram(
    files.map(file => file.name),
    compilerOptions,
    undefined,
    previous,
  );
  previous = program;

  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const file = diagnostic.file;
    if (!file) {
      problems.push(`${page}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
      continue;
    }
    const owner = files.find(entry => entry.name === file.fileName);
    const { line } = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    const preludeLines = owner ? preludeFor(owner.snippet.code).split('\n').length : 0;
    const pageLine = owner ? owner.snippet.line + line + 1 - preludeLines : line + 1;
    problems.push(
      `${page}:${pageLine} error TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
    );
  }
}

rmSync(dir, { recursive: true, force: true });

if (problems.length > 0) {
  console.error(`snippet check FAILED - ${problems.length} error(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(
  `snippets OK - ${checked.length} checked, ${snippets.length - checked.length} marked no-check, across ${byPage.size} pages (one program per page)`,
);

export {};
