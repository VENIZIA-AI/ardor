import type * as TS from 'typescript';

import {
  FunctionRenames,
  HookRenames,
  type IMemberTarget,
  NamespaceModules,
  RemovedNames,
  TypeRenames,
} from './renames';

export type TTypeScript = typeof TS;

/** Something the codemod found and did not change, with the place to look. */
export interface IFinding {
  line: number;
  name: string;
  reason: string;
  /** `note`: something changed on purpose that the owner should know; it does not count as left. */
  kind?: 'note';
}

export interface INamespaceResult {
  text: string;
  /** Identifiers rewritten to `Owner.member`. */
  renamed: number;
  findings: IFinding[];
}

interface IRename {
  specifier: TS.ImportSpecifier;
  declaration: TS.ImportDeclaration;
  local: string;
  /** A function or hook that becomes `Owner.member`. */
  target?: IMemberTarget;
  /** A type that becomes this plain type. */
  typeText?: string;
  references: Array<{ start: number; end: number; text: string }>;
}

interface ITextEdit {
  start: number;
  end: number;
  text: string;
}

/** What a file binds: names it declares itself, and names it imports (with the module and `type`). */
interface IBindings {
  declared: Set<string>;
  imported: Map<string, { module: string; typeOnly: boolean }>;
}

/**
 * Rewrites the removed bare names of `@venizia/ardor` to their class members, in source text:
 * `isDefined(x)` becomes `ValueUtility.isDefined(x)` and the import follows. With `hooks`, a hook
 * imported from `@venizia/ardor` itself becomes `Ardor.useX` (never one imported from the react or
 * admin package, which cannot import `Ardor`).
 *
 * It reads syntax only (no type information), so it is conservative: a name the file also declares
 * itself, an owner name already taken, an `export { name }` and a type-only import are listed in
 * `findings` and left alone.
 */
export class NamespaceTransform {
  static run(opts: {
    ts: TTypeScript;
    fileName: string;
    text: string;
    hooks: boolean;
  }): INamespaceResult {
    const { ts, fileName, text, hooks } = opts;

    if (!text.includes('@venizia/ardor')) {
      return { text, renamed: 0, findings: [] };
    }

    const sourceFile = ts.createSourceFile(
      fileName,
      text,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const findings: IFinding[] = [];
    const renames = NamespaceTransform.collectRenames({ ts, sourceFile, hooks, findings });

    NamespaceTransform.findRemovedMembers({ ts, sourceFile, findings });

    if (renames.length === 0) {
      return { text, renamed: 0, findings };
    }

    const bindings = NamespaceTransform.collectBindings({ ts, sourceFile });
    const accepted = NamespaceTransform.accept({ renames, bindings, sourceFile, findings });
    const byLocal = new Map(accepted.map((rename) => [rename.local, rename]));

    NamespaceTransform.collectReferences({ ts, sourceFile, byLocal, findings });

    const used = accepted.filter((rename) => rename.references.length > 0);
    const edits: ITextEdit[] = used.flatMap((rename) =>
      rename.references.map((reference) => ({
        start: reference.start,
        end: reference.end,
        text: reference.text,
      })),
    );

    edits.push(...NamespaceTransform.importEdits({ ts, sourceFile, used, bindings }));

    return {
      text: NamespaceTransform.apply({ text, edits }),
      renamed: used.reduce((sum, rename) => sum + rename.references.length, 0),
      findings,
    };
  }

  /** Every named import from an ARDOR package that has a class-member replacement. */
  private static collectRenames(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    hooks: boolean;
    findings: IFinding[];
  }): IRename[] {
    const { ts, sourceFile, hooks, findings } = opts;
    const renames: IRename[] = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }

      const module = statement.moduleSpecifier.text;
      const clause = statement.importClause;

      if (!NamespaceModules.isValid(module) || !clause) {
        continue;
      }

      if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
        continue;
      }

      for (const specifier of clause.namedBindings.elements) {
        const imported = (specifier.propertyName ?? specifier.name).text;
        const removed = RemovedNames.findExport({ name: imported });

        if (removed) {
          findings.push({
            line: sourceFile.getLineAndCharacterOfPosition(specifier.getStart(sourceFile)).line + 1,
            name: specifier.name.text,
            reason: `removed: ${removed}`,
          });
          continue;
        }

        const typeText = TypeRenames.find({ name: imported });

        if (typeText) {
          renames.push({
            specifier,
            declaration: statement,
            local: specifier.name.text,
            typeText,
            references: [],
          });
          continue;
        }

        // A function or a hook is a value: an import that is type-only cannot carry it.
        if (clause.isTypeOnly || specifier.isTypeOnly) {
          continue;
        }

        let target = FunctionRenames.find({ name: imported });

        if (!target && hooks && module === NamespaceModules.UMBRELLA) {
          target = HookRenames.find({ name: imported });
        }

        if (target) {
          renames.push({
            specifier,
            declaration: statement,
            local: specifier.name.text,
            target,
            references: [],
          });
        }
      }
    }

    return renames;
  }

  private static collectBindings(opts: { ts: TTypeScript; sourceFile: TS.SourceFile }): IBindings {
    const { ts, sourceFile } = opts;
    const declared = new Set<string>();
    const imported = new Map<string, { module: string; typeOnly: boolean }>();

    const declareName = (name: TS.BindingName): void => {
      if (ts.isIdentifier(name)) {
        declared.add(name.text);

        return;
      }

      for (const element of name.elements) {
        if (ts.isBindingElement(element)) {
          declareName(element.name);
        }
      }
    };

    const visit = (node: TS.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const module = node.moduleSpecifier.text;
        const typeOnly = clause?.isTypeOnly ?? false;

        if (clause?.name) {
          imported.set(clause.name.text, { module, typeOnly });
        }

        const bindings = clause?.namedBindings;

        if (bindings && ts.isNamespaceImport(bindings)) {
          imported.set(bindings.name.text, { module, typeOnly });
        } else if (bindings) {
          for (const element of bindings.elements) {
            imported.set(element.name.text, { module, typeOnly: typeOnly || element.isTypeOnly });
          }
        }

        return;
      }

      if (
        (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
        node.name
      ) {
        declareName(node.name);
      } else if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isClassExpression(node)) &&
        node.name
      ) {
        declared.add(node.name.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return { declared, imported };
  }

  /** The renames that are safe: nothing in the file competes for the old name or for the class name. */
  private static accept(opts: {
    renames: IRename[];
    bindings: IBindings;
    sourceFile: TS.SourceFile;
    findings: IFinding[];
  }): IRename[] {
    const { renames, bindings, sourceFile, findings } = opts;

    return renames.filter((rename) => {
      const line =
        sourceFile.getLineAndCharacterOfPosition(rename.specifier.getStart(sourceFile)).line + 1;
      const owner = rename.target?.owner;

      if (bindings.declared.has(rename.local)) {
        findings.push({
          line,
          name: rename.local,
          reason: `the file also declares "${rename.local}" itself, so a use of the import cannot be told apart without types`,
        });

        return false;
      }

      if (!owner || !rename.target) {
        return true;
      }

      const existing = bindings.imported.get(owner);

      if (
        bindings.declared.has(owner) ||
        (existing && !NamespaceModules.isValid(existing.module))
      ) {
        findings.push({
          line,
          name: rename.local,
          reason: `"${owner}" is already taken in this file; import it under another name and use ${owner}.${rename.target.member}`,
        });

        return false;
      }

      if (existing?.typeOnly) {
        findings.push({
          line,
          name: rename.local,
          reason: `"${owner}" is imported as a type only; import it as a value to use ${owner}.${rename.target.member}`,
        });

        return false;
      }

      return true;
    });
  }

  /** Walks the file once and records each use of an accepted import. */
  private static collectReferences(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    byLocal: Map<string, IRename>;
    findings: IFinding[];
  }): void {
    const { ts, sourceFile, byLocal, findings } = opts;

    const visit = (node: TS.Node): void => {
      if (ts.isImportDeclaration(node)) {
        return;
      }

      const rename = ts.isIdentifier(node) ? byLocal.get(node.text) : undefined;

      if (rename && ts.isIdentifier(node)) {
        NamespaceTransform.classify({ ts, sourceFile, node, rename, findings });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private static classify(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    node: TS.Identifier;
    rename: IRename;
    findings: IFinding[];
  }): void {
    const { ts, sourceFile, node, rename, findings } = opts;
    const { parent } = node;
    const replacement = rename.target
      ? `${rename.target.owner}.${rename.target.member}`
      : (rename.typeText ?? rename.local);
    const start = node.getStart(sourceFile);
    const end = node.getEnd();

    // A name, not a use: a property, a member, a key, a label.
    const isName =
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (ts.isQualifiedName(parent) && parent.right === node) ||
      (ts.isBindingElement(parent) && parent.propertyName === node) ||
      ((ts.isPropertyAssignment(parent) ||
        ts.isPropertyDeclaration(parent) ||
        ts.isPropertySignature(parent) ||
        ts.isMethodDeclaration(parent) ||
        ts.isMethodSignature(parent) ||
        ts.isGetAccessorDeclaration(parent) ||
        ts.isSetAccessorDeclaration(parent) ||
        ts.isEnumMember(parent) ||
        ts.isJsxAttribute(parent)) &&
        parent.name === node);

    if (isName) {
      return;
    }

    if (ts.isExportSpecifier(parent)) {
      // `export { x as isDefined }` names a new export; `export { isDefined }` re-exports the import.
      if (parent.propertyName && parent.name === node) {
        return;
      }

      findings.push({
        line: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
        name: rename.local,
        reason: `re-exported by name; export ${replacement} under a name of your own`,
      });

      return;
    }

    if (rename.typeText !== undefined) {
      // A type is a name in a type position only: `NullableType[]` needs parentheses once replaced.
      if (ts.isTypeReferenceNode(parent) && parent.typeName === node) {
        const grand = parent.parent;
        const wrap =
          rename.typeText.includes('|') &&
          (ts.isArrayTypeNode(grand) ||
            ts.isIntersectionTypeNode(grand) ||
            ts.isTypeOperatorNode(grand) ||
            ts.isIndexedAccessTypeNode(grand));

        rename.references.push({ start, end, text: wrap ? `(${replacement})` : replacement });
      }

      return;
    }

    if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
      rename.references.push({ start, end, text: `${rename.local}: ${replacement}` });

      return;
    }

    rename.references.push({ start, end, text: replacement });
  }

  /** `App.DEFAULT_LOCALE` and the two removed `HeaderConstants`: listed, there is nothing to write instead. */
  private static findRemovedMembers(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    findings: IFinding[];
  }): void {
    const { ts, sourceFile, findings } = opts;
    const owners = new Map<string, string>();

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }

      const named = statement.importClause?.namedBindings;

      if (
        !NamespaceModules.isValid(statement.moduleSpecifier.text) ||
        !named ||
        !ts.isNamedImports(named)
      ) {
        continue;
      }

      for (const specifier of named.elements) {
        owners.set(specifier.name.text, (specifier.propertyName ?? specifier.name).text);
      }
    }

    if (owners.size === 0) {
      return;
    }

    const visit = (node: TS.Node): void => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const owner = owners.get(node.expression.text);
        const reason = owner
          ? RemovedNames.findMember({ owner, member: node.name.text })
          : undefined;

        if (reason) {
          findings.push({
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            name: `${node.expression.text}.${node.name.text}`,
            reason: `removed: ${reason}`,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /** The import lines, with the old names out and the class names in (once per class). */
  private static importEdits(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    used: IRename[];
    bindings: IBindings;
  }): ITextEdit[] {
    const { ts, sourceFile, used, bindings } = opts;
    const edits: ITextEdit[] = [];
    const added = new Set<string>();
    const declarations = new Set(used.map((rename) => rename.declaration));

    for (const declaration of declarations) {
      const clause = declaration.importClause;
      const named = clause?.namedBindings;

      if (!clause || !named || !ts.isNamedImports(named)) {
        continue;
      }

      const renamed = new Set(
        used
          .filter((rename) => rename.declaration === declaration)
          .map((rename) => rename.specifier),
      );
      const kept = named.elements
        .filter((element) => !renamed.has(element))
        .map((element) => element.getText(sourceFile));
      const owners = [
        ...new Set(
          used
            .filter((rename) => rename.declaration === declaration)
            .map((rename) => rename.target?.owner)
            .filter((owner): owner is string => owner !== undefined),
        ),
      ].filter((owner) => !bindings.imported.has(owner) && !added.has(owner));

      for (const owner of owners) {
        added.add(owner);
      }

      const names = [...kept, ...owners];

      if (names.length === 0) {
        edits.push(NamespaceTransform.removeImport({ sourceFile, declaration, clause, named, ts }));
        continue;
      }

      edits.push({
        start: named.getStart(sourceFile),
        end: named.getEnd(),
        text: NamespaceTransform.formatNames({ sourceFile, declaration, named, names }),
      });
    }

    return edits;
  }

  /** `{ a, b }` on one line when the import was on one line, one name per line when it was not. */
  private static formatNames(opts: {
    sourceFile: TS.SourceFile;
    declaration: TS.ImportDeclaration;
    named: TS.NamedImports;
    names: string[];
  }): string {
    const { sourceFile, declaration, named, names } = opts;
    const original = named.getText(sourceFile);

    if (!original.includes('\n')) {
      return `{ ${names.join(', ')} }`;
    }

    const lineStart = (position: number): string => {
      const before = sourceFile.text.slice(0, position);

      return before.slice(before.lastIndexOf('\n') + 1);
    };

    const closing = /^\s*/.exec(lineStart(declaration.getStart(sourceFile)))?.[0] ?? '';
    const first = named.elements[0];
    const indent = first
      ? (/^\s*/.exec(lineStart(first.getStart(sourceFile)))?.[0] ?? '  ')
      : `${closing}  `;

    return `{\n${names.map((name) => `${indent}${name},`).join('\n')}\n${closing}}`;
  }

  private static removeImport(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    declaration: TS.ImportDeclaration;
    clause: TS.ImportClause;
    named: TS.NamedImports;
  }): ITextEdit {
    const { sourceFile, declaration, clause, named } = opts;

    // `import Default, { a } from 'x'`: drop the braces and the comma, keep the default.
    if (clause.name) {
      return { start: clause.name.getEnd(), end: named.getEnd(), text: '' };
    }

    const start = declaration.getStart(sourceFile);
    let end = declaration.getEnd();

    if (sourceFile.text[end] === '\n') {
      end += 1;
    }

    // The blank line that separated this import from the code goes with it, not a second one.
    const alone = start === 0 || sourceFile.text.slice(start - 2, start) === '\n\n';

    if (alone && sourceFile.text[end] === '\n') {
      end += 1;
    }

    return { start, end, text: '' };
  }

  private static apply(opts: { text: string; edits: ITextEdit[] }): string {
    const ordered = [...opts.edits].sort((a, b) => b.start - a.start);
    let result = opts.text;

    for (const edit of ordered) {
      result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    }

    return result;
  }
}
