import type * as TS from 'typescript';

import { NamespaceModules } from './renames';
import type { TTypeScript } from './transform';

export interface ISourceEdit {
  start: number;
  end: number;
  text: string;
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

  static apply(opts: { text: string; edits: ISourceEdit[] }): string {
    const ordered = [...opts.edits].sort((a, b) => b.start - a.start);
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

  /** The local names a file imports `exportName` under from an ARDOR package, `exportName` itself included. */
  static localNames(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    exportName: string;
  }): Set<string> {
    const { ts, sourceFile, exportName } = opts;
    const names = new Set([exportName]);

    for (const statement of sourceFile.statements) {
      const bindings = ts.isImportDeclaration(statement)
        ? statement.importClause?.namedBindings
        : undefined;

      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !NamespaceModules.isValid(statement.moduleSpecifier.text) ||
        bindings === undefined ||
        !ts.isNamedImports(bindings)
      ) {
        continue;
      }

      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === exportName) {
          names.add(element.name.text);
        }
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
