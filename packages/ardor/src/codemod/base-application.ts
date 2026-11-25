import type * as TS from 'typescript';

import type { ICodemodResult } from './command';
import { CodemodSource, type ISourceEdit } from './source';
import type { IFinding, TTypeScript } from './transform';

type TSpecifier = TS.ImportSpecifier | TS.ExportSpecifier;

/** A statement that names members of a module: an import or a re-export. */
interface INamedStatement {
  node: TS.ImportDeclaration | TS.ExportDeclaration;
  bindings: TS.NamedImports | TS.NamedExports;
  isTypeOnly: boolean;
  keyword: 'import' | 'export';
}

/** Moves `BaseArdorApplication` from the kernel package to the admin package, in imports and re-exports. */
export class BaseApplicationTransform {
  static readonly NAME = 'BaseArdorApplication';
  static readonly KERNEL = '@venizia/ardor-kernel';
  static readonly ADMIN = '@venizia/ardor-admin';

  static run(opts: {
    ts: TTypeScript;
    fileName: string;
    text: string;
    hooks: boolean;
  }): ICodemodResult {
    const { ts, fileName, text } = opts;

    if (!text.includes(BaseApplicationTransform.KERNEL)) {
      return { text, renamed: 0, findings: [] };
    }

    const sourceFile = CodemodSource.parse({ ts, fileName, text });
    const edits: ISourceEdit[] = [];
    const findings: IFinding[] = [];
    const namespaces = new Set<string>();
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    let renamed = 0;

    for (const statement of sourceFile.statements) {
      if (
        !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
        statement.moduleSpecifier === undefined ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== BaseApplicationTransform.KERNEL
      ) {
        continue;
      }

      const line = CodemodSource.lineOf({ sourceFile, node: statement });
      const named = BaseApplicationTransform.named({ ts, statement });

      if (ts.isExportDeclaration(statement) && statement.exportClause === undefined) {
        findings.push({
          line,
          name: 'export *',
          reason: `it no longer re-exports ${BaseApplicationTransform.NAME}: export it from ${BaseApplicationTransform.ADMIN} if you need it`,
          level: 'note',
        });
      }

      if (ts.isImportDeclaration(statement)) {
        const bindings = statement.importClause?.namedBindings;

        if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
          namespaces.add(bindings.name.text);
        }
      }

      if (named === undefined) {
        continue;
      }

      const moved = named.bindings.elements.filter(BaseApplicationTransform.isMoved);

      if (moved.length === 0) {
        continue;
      }

      if (ts.isImportDeclaration(statement) && statement.importClause?.name !== undefined) {
        findings.push({
          line,
          name: BaseApplicationTransform.NAME,
          reason: `the import also has a default import: import ${BaseApplicationTransform.NAME} from ${BaseApplicationTransform.ADMIN} by hand`,
        });
        continue;
      }

      renamed += moved.length;
      edits.push(...BaseApplicationTransform.move({ ts, sourceFile, named, moved, eol }));
    }

    findings.push(...BaseApplicationTransform.namespaceUses({ ts, sourceFile, namespaces }));

    return {
      text: CodemodSource.apply({ text, edits }),
      renamed,
      findings: findings.sort((a, b) => a.line - b.line),
    };
  }

  private static isMoved(specifier: TSpecifier): boolean {
    return (specifier.propertyName ?? specifier.name).text === BaseApplicationTransform.NAME;
  }

  private static named(opts: {
    ts: TTypeScript;
    statement: TS.ImportDeclaration | TS.ExportDeclaration;
  }): INamedStatement | undefined {
    const { ts, statement } = opts;

    if (ts.isImportDeclaration(statement)) {
      const bindings = statement.importClause?.namedBindings;

      return bindings !== undefined && ts.isNamedImports(bindings)
        ? {
            node: statement,
            bindings,
            isTypeOnly: statement.importClause?.isTypeOnly === true,
            keyword: 'import',
          }
        : undefined;
    }

    return statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)
      ? {
          node: statement,
          bindings: statement.exportClause,
          isTypeOnly: statement.isTypeOnly,
          keyword: 'export',
        }
      : undefined;
  }

  /** The import of the admin package a moved member can join: named, same `type` modifier, not empty. */
  private static joinTarget(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    isTypeOnly: boolean;
  }): TS.NamedImports | undefined {
    const { ts, sourceFile, isTypeOnly } = opts;

    for (const statement of sourceFile.statements) {
      const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;

      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === BaseApplicationTransform.ADMIN &&
        clause !== undefined &&
        clause.name === undefined &&
        clause.isTypeOnly === isTypeOnly &&
        clause.namedBindings !== undefined &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length > 0
      ) {
        return clause.namedBindings;
      }
    }

    return undefined;
  }

  private static move(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    named: INamedStatement;
    moved: TSpecifier[];
    eol: string;
  }): ISourceEdit[] {
    const { ts, sourceFile, named, moved, eol } = opts;
    const { node, bindings, isTypeOnly, keyword } = named;
    const text = sourceFile.text;
    const kept = bindings.elements.filter((element) => !BaseApplicationTransform.isMoved(element));
    const movedTexts = moved.map((element) => element.getText(sourceFile));
    const target =
      keyword === 'import'
        ? BaseApplicationTransform.joinTarget({ ts, sourceFile, isTypeOnly })
        : undefined;
    const specifier = node.moduleSpecifier;

    if (specifier === undefined) {
      return [];
    }

    const edits: ISourceEdit[] = [];

    if (target === undefined && kept.length === 0) {
      edits.push({
        start: specifier.getStart(sourceFile) + 1,
        end: specifier.getEnd() - 1,
        text: BaseApplicationTransform.ADMIN,
      });

      return edits;
    }

    if (target !== undefined) {
      const last = target.elements[target.elements.length - 1];

      if (last === undefined) {
        return [];
      }

      const separator = BaseApplicationTransform.isMultiLine({ sourceFile, bindings: target })
        ? `,${eol}${BaseApplicationTransform.indentOf({ sourceFile, node: last })}`
        : ', ';

      edits.push({
        start: last.getEnd(),
        end: last.getEnd(),
        text: `${separator}${movedTexts.join(separator)}`,
      });
    }

    if (kept.length === 0) {
      const end = node.getEnd();
      const next = text.startsWith(eol, end) ? end + eol.length : end;

      edits.push({ start: node.getStart(sourceFile), end: next, text: '' });

      return edits;
    }

    edits.push({
      start: bindings.getStart(sourceFile),
      end: bindings.getEnd(),
      text: BaseApplicationTransform.braces({ sourceFile, bindings, kept }),
    });

    if (target === undefined) {
      const quote = text.charAt(specifier.getStart(sourceFile));
      const semicolon = text.charAt(node.getEnd() - 1) === ';' ? ';' : '';
      const modifier = isTypeOnly ? 'type ' : '';

      edits.push({
        start: node.getEnd(),
        end: node.getEnd(),
        text: `${eol}${keyword} ${modifier}{ ${movedTexts.join(', ')} } from ${quote}${BaseApplicationTransform.ADMIN}${quote}${semicolon}`,
      });
    }

    return edits;
  }

  private static isMultiLine(opts: {
    sourceFile: TS.SourceFile;
    bindings: TS.NamedImports | TS.NamedExports;
  }): boolean {
    const { sourceFile, bindings } = opts;

    return bindings.getText(sourceFile).includes('\n');
  }

  private static indentOf(opts: { sourceFile: TS.SourceFile; node: TS.Node }): string {
    const { sourceFile, node } = opts;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);

    return /^[ \t]*/.exec(sourceFile.text.slice(lineStart))?.[0] ?? '';
  }

  /** The `{ ... }` of an import or export with the moved members taken out, in the layout it had. */
  private static braces(opts: {
    sourceFile: TS.SourceFile;
    bindings: TS.NamedImports | TS.NamedExports;
    kept: TSpecifier[];
  }): string {
    const { sourceFile, bindings, kept } = opts;
    const texts = kept.map((element) => element.getText(sourceFile));
    const [first] = bindings.elements;

    if (first === undefined || !BaseApplicationTransform.isMultiLine({ sourceFile, bindings })) {
      return `{ ${texts.join(', ')} }`;
    }

    const indent = BaseApplicationTransform.indentOf({ sourceFile, node: first });
    const closing = BaseApplicationTransform.indentOf({ sourceFile, node: bindings });
    const trailing = bindings.elements.hasTrailingComma ? ',' : '';
    const eol = sourceFile.text.includes('\r\n') ? '\r\n' : '\n';

    return `{${eol}${indent}${texts.join(`,${eol}${indent}`)}${trailing}${eol}${closing}}`;
  }

  /** Where a namespace import of the kernel reads the class: `Kernel.BaseArdorApplication`. */
  private static namespaceUses(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    namespaces: Set<string>;
  }): IFinding[] {
    const { ts, sourceFile, namespaces } = opts;
    const findings: IFinding[] = [];

    if (namespaces.size === 0) {
      return findings;
    }

    const visit = (node: TS.Node): void => {
      const match =
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        namespaces.has(node.expression.text) &&
        node.name.text === BaseApplicationTransform.NAME
          ? node.expression.text
          : ts.isQualifiedName(node) &&
              ts.isIdentifier(node.left) &&
              namespaces.has(node.left.text) &&
              node.right.text === BaseApplicationTransform.NAME
            ? node.left.text
            : undefined;

      if (match !== undefined) {
        findings.push({
          line: CodemodSource.lineOf({ sourceFile, node }),
          name: `${match}.${BaseApplicationTransform.NAME}`,
          reason: `a namespace import of the kernel: import ${BaseApplicationTransform.NAME} from ${BaseApplicationTransform.ADMIN} by hand`,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return findings;
  }
}
