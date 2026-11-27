import type * as TS from 'typescript';

import { NamespaceModules } from './renames';
import type { IFinding, TTypeScript } from './transform';
import type { ICodemodInput, ICodemodResult } from './command';
import { CodemodSource, type ISourceEdit } from './source';

class HttpMethodNames {
  static readonly MODULE = '@venizia/ignis-helpers/common';
  static readonly CLASS = 'RequestMethods';
  static readonly TYPE = 'TRequestMethod';
  static readonly NEW_CLASS = 'HTTP';
  static readonly NEW_TYPE = 'THttpMethod';

  static readonly MEMBERS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
}

class HttpMethodReasons {
  static readonly USE =
    'rewrite by hand: HTTP.Methods is lowercase and ARDOR hands an override the uppercase method, so compare method.toLowerCase() with HTTP.Methods.X';

  static readonly ELSEWHERE =
    'rewrite by hand: ARDOR may not be what sends this value, and a browser fetch does not uppercase patch: where it reaches your own code write HTTP.Methods.X.toUpperCase()';

  static readonly MEMBER =
    'HTTP.Methods is a plain object with no isValid or values(): use Object.values(HTTP.Methods), which is lowercase';

  static readonly TAKEN = 'this file already uses the name of the replacement: rewrite by hand';
  static readonly EXPORT =
    're-export by name: export HTTP or THttpMethod from @venizia/ignis-helpers/common yourself';
}

interface IOldImport {
  declaration: TS.ImportDeclaration;
  specifier: TS.ImportSpecifier;
  imported: string;
  edits: ISourceEdit[];
  isKept: boolean;
}

/**
 * Moves `RequestMethods` and `TRequestMethod` of the ARDOR packages to `HTTP.Methods` and
 * `THttpMethod` of `@venizia/ignis-helpers/common`. The old values are uppercase and the new ones
 * lowercase, so a value is rewritten only as the `method` of a literal ARDOR itself sends
 * (`send({ params })`, `doRequest({ ... })`, an `ISendParams`); every other use is listed,
 * because it could change without an error.
 */
export class HttpMethodsTransform {
  static run(opts: ICodemodInput): ICodemodResult {
    const { ts, fileName, text } = opts;

    if (!text.includes('@venizia/ardor')) {
      return { text, renamed: 0, findings: [] };
    }

    const sourceFile = CodemodSource.parse({ ts, fileName, text });
    const findings: IFinding[] = [];

    const list = (node: TS.Node, name: string, reason: string) => {
      findings.push({ line: CodemodSource.lineOf({ sourceFile, node }), name, reason });
    };

    const imports = new Map<string, IOldImport>();
    /** Every name the file binds, other than the old names it imports from ARDOR. */
    const bound = new Set<string>();
    /** The imports of the new module, by the name they import. */
    const present = new Map<string, { local: string; isTypeOnly: boolean }>();
    let target: TS.NamedImports | undefined;

    const isOldName = (name: string): boolean =>
      name === HttpMethodNames.CLASS || name === HttpMethodNames.TYPE;

    const visitBindings = (node: TS.Node): void => {
      if (
        (ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isBindingElement(node) ||
          ts.isClassDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isEnumDeclaration(node) ||
          ts.isModuleDeclaration(node) ||
          ts.isImportEqualsDeclaration(node) ||
          ts.isNamespaceImport(node) ||
          ts.isImportClause(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isInterfaceDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        bound.add(node.name.text);

        if (ts.isBindingElement(node) && isOldName(node.name.text)) {
          list(node, node.name.text, HttpMethodReasons.USE);
        }
      }

      ts.forEachChild(node, visitBindings);
    };

    visitBindings(sourceFile);

    for (const statement of sourceFile.statements) {
      if (ts.isExportDeclaration(statement)) {
        const from = statement.moduleSpecifier;
        const clause = statement.exportClause;

        if (from && ts.isStringLiteral(from) && NamespaceModules.isValid(from.text)) {
          for (const element of clause && ts.isNamedExports(clause) ? clause.elements : []) {
            const name = (element.propertyName ?? element.name).getText(sourceFile);

            if (isOldName(name)) {
              list(element, name, HttpMethodReasons.EXPORT);
            }
          }
        }

        continue;
      }

      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }

      const module = statement.moduleSpecifier.text;
      const named = statement.importClause?.namedBindings;

      if (!named || !ts.isNamedImports(named)) {
        continue;
      }

      const isTypeOnly = statement.importClause?.isTypeOnly === true;

      if (module === HttpMethodNames.MODULE && !isTypeOnly) {
        target ??= named;
      }

      for (const specifier of named.elements) {
        const imported = (specifier.propertyName ?? specifier.name).text;
        const local = specifier.name.text;
        const isOld = isOldName(imported) && NamespaceModules.isValid(module);

        if (isOld && !bound.has(local)) {
          imports.set(local, {
            declaration: statement,
            specifier,
            imported,
            edits: [],
            isKept: false,
          });
          continue;
        }

        if (isOld) {
          list(specifier, local, HttpMethodReasons.TAKEN);
        }

        if (module === HttpMethodNames.MODULE) {
          present.set(imported, { local, isTypeOnly: isTypeOnly || specifier.isTypeOnly });
        }

        // The module's own import of the replacement name is not "taken".
        if (module !== HttpMethodNames.MODULE || imported !== local) {
          bound.add(local);
        }
      }
    }

    /** The local name of `name` from the new module, `undefined` when it cannot be used. */
    const localOf = (wanted: { name: string; isValue: boolean }): string | undefined => {
      const { name, isValue } = wanted;
      const existing = present.get(name);

      if (existing) {
        return isValue && existing.isTypeOnly ? undefined : existing.local;
      }

      return bound.has(name) ? undefined : name;
    };

    const needed = new Map<string, string>();

    const rewrite = (node: TS.Identifier, entry: IOldImport): void => {
      const isType = entry.imported === HttpMethodNames.TYPE;
      const name = isType ? HttpMethodNames.NEW_TYPE : HttpMethodNames.NEW_CLASS;
      const local = localOf({ name, isValue: !isType });
      const access = node.parent;
      let reason: string | undefined;

      if (isType) {
        reason = ts.isTypeReferenceNode(access) ? undefined : HttpMethodReasons.USE;
      } else if (!ts.isPropertyAccessExpression(access) || access.expression !== node) {
        reason = HttpMethodReasons.USE;
      } else if (!HttpMethodNames.MEMBERS.has(access.name.text)) {
        reason = HttpMethodReasons.MEMBER;
      } else {
        reason = HttpMethodsTransform.reasonOfValue({ ts, access });
      }

      if (reason === undefined && local === undefined) {
        reason = HttpMethodReasons.TAKEN;
      }

      if (reason !== undefined || local === undefined) {
        entry.isKept = true;
        list(node, node.text, reason ?? HttpMethodReasons.TAKEN);

        return;
      }

      if (!present.has(name)) {
        needed.set(name, isType ? `type ${name}` : name);
      }

      entry.edits.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: isType ? local : `${local}.Methods`,
      });
    };

    const visit = (node: TS.Node): void => {
      if (ts.isImportDeclaration(node)) {
        return;
      }

      if (ts.isExportDeclaration(node)) {
        const clause = node.exportClause;
        const isLocal = !node.moduleSpecifier && clause && ts.isNamedExports(clause);

        for (const element of isLocal ? clause.elements : []) {
          const name = (element.propertyName ?? element.name).getText(sourceFile);
          const entry = imports.get(name);

          if (entry) {
            entry.isKept = true;
            list(element, name, HttpMethodReasons.EXPORT);
          }
        }

        return;
      }

      if (ts.isIdentifier(node)) {
        const entry = imports.get(node.text);
        const parent = node.parent;
        const isMemberName =
          (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) &&
          parent.name === node;

        if (entry && !isMemberName) {
          rewrite(node, entry);
        } else if (!entry && isOldName(node.text) && !bound.has(node.text)) {
          // Reached another way: through a namespace import or an `import()` type.
          list(node, node.text, HttpMethodReasons.USE);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    const entries = [...imports.values()];
    const edits = entries.flatMap((entry) => entry.edits);
    const renamed = edits.length;

    if (renamed > 0) {
      edits.push(...HttpMethodsTransform.importEdits({ ts, sourceFile, entries, target, needed }));
    }

    return { text: CodemodSource.apply({ text, edits }), renamed, findings };
  }

  /** Why `RequestMethods.X` is not rewritten where it stands, `undefined` when it is. */
  private static reasonOfValue(opts: {
    ts: TTypeScript;
    access: TS.PropertyAccessExpression;
  }): string | undefined {
    const { ts, access } = opts;
    const property = access.parent;

    if (
      !ts.isPropertyAssignment(property) ||
      property.initializer !== access ||
      CodemodSource.nameOf({ ts, node: property.name }) !== 'method'
    ) {
      return HttpMethodReasons.USE;
    }

    return HttpMethodsTransform.isSentByArdor({ ts, literal: property.parent })
      ? undefined
      : HttpMethodReasons.ELSEWHERE;
  }

  /**
   * Whether ARDOR sends what the literal holds: the argument of `doRequest`, the `params` of a
   * `send` argument, or a literal declared as `ISendParams`.
   */
  private static isSentByArdor(opts: { ts: TTypeScript; literal: TS.Node }): boolean {
    const { ts, literal } = opts;
    const holder = literal.parent;
    const isCallOf = (call: TS.Node, name: string): boolean =>
      ts.isCallExpression(call) &&
      ts.isPropertyAccessExpression(call.expression) &&
      call.expression.name.text === name;

    if (ts.isVariableDeclaration(holder) || ts.isSatisfiesExpression(holder)) {
      return holder.type?.getText() === 'ISendParams';
    }

    if (ts.isPropertyAssignment(holder) && holder.name.getText() === 'params') {
      return isCallOf(holder.parent.parent, 'send');
    }

    return isCallOf(holder, 'doRequest');
  }

  /** Drops the old specifiers nothing uses any more and imports the new names. */
  private static importEdits(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    entries: IOldImport[];
    target?: TS.NamedImports;
    needed: Map<string, string>;
  }): ISourceEdit[] {
    const { ts, sourceFile, entries, target, needed } = opts;
    const names = [...needed.values()];
    const edits: ISourceEdit[] = [];
    let insertion = '';

    if (target && names.length > 0) {
      const all = [...target.elements.map((element) => element.getText(sourceFile)), ...names];

      edits.push({
        start: target.getStart(sourceFile),
        end: target.getEnd(),
        text: `{ ${all.join(', ')} }`,
      });
    } else if (names.length > 0) {
      insertion = `import { ${names.join(', ')} } from '${HttpMethodNames.MODULE}';\n`;
    }

    const declarations = new Set(entries.map((entry) => entry.declaration));

    for (const declaration of declarations) {
      const named = declaration.importClause?.namedBindings;

      if (!named || !ts.isNamedImports(named)) {
        continue;
      }

      const dropped = new Set(
        entries.filter((entry) => !entry.isKept && entry.edits.length > 0).map((e) => e.specifier),
      );
      const kept = named.elements.filter((element) => !dropped.has(element));
      const start = declaration.getStart(sourceFile);

      const defaultName = declaration.importClause?.name;

      if (kept.length === 0 && defaultName) {
        edits.push({ start: defaultName.getEnd(), end: named.getEnd(), text: '' });

        if (insertion) {
          edits.push({ start, end: start, text: insertion });
          insertion = '';
        }

        continue;
      }

      if (kept.length === 0) {
        const end = declaration.getEnd() + (sourceFile.text[declaration.getEnd()] === '\n' ? 1 : 0);

        edits.push({ start, end, text: insertion });
        insertion = '';
        continue;
      }

      if (insertion) {
        edits.push({ start, end: start, text: insertion });
        insertion = '';
      }

      if (kept.length < named.elements.length) {
        edits.push({
          start: named.getStart(sourceFile),
          end: named.getEnd(),
          text: `{ ${kept.map((element) => element.getText(sourceFile)).join(', ')} }`,
        });
      }
    }

    return edits;
  }
}
