import type * as TS from 'typescript';

import { NamespaceModules } from './renames';
import type { TTypeScript } from './transform';

export interface ISourceEdit {
  start: number;
  end: number;
  text: string;
}

/** One name a file imports from an ARDOR package. */
export interface IArdorImport {
  declaration: TS.ImportDeclaration;
  specifier: TS.ImportSpecifier;
  module: string;
  imported: string;
  local: string;
  typeOnly: boolean;
}

/** Parsing, positions and edits the codemods that read one file share. */
export class CodemodSource {
  static parse(opts: { ts: TTypeScript; fileName: string; text: string }): TS.SourceFile {
    const { ts, fileName, text } = opts;

    return ts.createSourceFile(
      fileName,
      text,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  }

  /** The 1-based line a node starts on. */
  static lineOf(opts: { sourceFile: TS.SourceFile; node: TS.Node }): number {
    const { sourceFile, node } = opts;

    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  }

  /** The indentation of the line a node starts on. */
  static indentOf(opts: { sourceFile: TS.SourceFile; node: TS.Node }): string {
    const { sourceFile, node } = opts;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);

    return /^[ \t]*/.exec(sourceFile.text.slice(lineStart))?.[0] ?? '';
  }

  static apply(opts: { text: string; edits: ISourceEdit[] }): string {
    // Equal starts: the longer edit first, so an insertion lands before what it precedes.
    const ordered = [...opts.edits].sort((a, b) => b.start - a.start || b.end - a.end);
    let result = opts.text;

    for (const edit of ordered) {
      result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    }

    return result;
  }

  /** The expression inside parentheses, `as`, `satisfies` and `!`. */
  static unwrap(opts: { ts: TTypeScript; node: TS.Expression }): TS.Expression {
    const { ts } = opts;
    let node = opts.node;

    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      node = node.expression;
    }

    return node;
  }

  /** The names a file imports from ARDOR packages, in file order. */
  static ardorImports(opts: { ts: TTypeScript; sourceFile: TS.SourceFile }): IArdorImport[] {
    const { ts, sourceFile } = opts;
    const entries: IArdorImport[] = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }

      const module = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      const named = clause?.namedBindings;

      if (!NamespaceModules.isValid(module) || !named || !ts.isNamedImports(named)) {
        continue;
      }

      for (const specifier of named.elements) {
        entries.push({
          declaration: statement,
          specifier,
          module,
          imported: (specifier.propertyName ?? specifier.name).text,
          local: specifier.name.text,
          typeOnly: Boolean(clause?.isTypeOnly) || specifier.isTypeOnly,
        });
      }
    }

    return entries;
  }

  /** The local names a file imports `exportName` under from an ARDOR package, `exportName` itself included. */
  static localNames(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    exportName: string;
  }): Set<string> {
    const { exportName } = opts;
    const names = new Set([exportName]);

    for (const { imported, local } of CodemodSource.ardorImports(opts)) {
      if (imported === exportName) {
        names.add(local);
      }
    }

    return names;
  }

  /** The value of the property called `name` in an object literal, if it has one. */
  static propertyOf(opts: {
    ts: TTypeScript;
    literal: TS.ObjectLiteralExpression;
    name: string;
  }): TS.Expression | undefined {
    const { ts, literal, name } = opts;

    for (const property of literal.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        CodemodSource.nameOf({ ts, node: property.name }) === name
      ) {
        return property.initializer;
      }
    }

    return undefined;
  }

  /** The text of an identifier or string property name; `undefined` for a computed one. */
  static nameOf(opts: { ts: TTypeScript; node: TS.PropertyName }): string | undefined {
    const { ts, node } = opts;

    return ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)
      ? node.text
      : undefined;
  }
}
