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

  static readonly SENDERS = new Set(['send', 'doRequest', 'request']);

  static readonly MEMBERS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
}

class HttpMethodReasons {
  static readonly USE =
    'rewrite by hand: HTTP.Methods is lowercase and ARDOR hands an override the uppercase method, so compare method.toLowerCase() with HTTP.Methods.X';

  static readonly FETCH =
    'rewrite by hand: a browser fetch does not uppercase patch, so where this reaches your own fetch write HTTP.Methods.X.toUpperCase()';

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
 * lowercase, so a value is rewritten only as a `method` property outside `fetch` and `new
 * Request`, and `PATCH` only inside a `send`, `doRequest` or `request` call; every other use is
 * listed, because it could change without an error.
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
    /** Every name the file binds, with the module it imports it from (`''`: declared here). */
    const bound = new Map<string, string>();
    let target: TS.NamedImports | undefined;

    const visitBindings = (node: TS.Node): void => {
      if (
        (ts.isVariableDeclaration(node) ||
          ts.isParameter(node) ||
          ts.isBindingElement(node) ||
          ts.isClassDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isInterfaceDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        bound.set(node.name.text, '');
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

            if (name === HttpMethodNames.CLASS || name === HttpMethodNames.TYPE) {
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

      if (module === HttpMethodNames.MODULE && !statement.importClause?.isTypeOnly) {
        target ??= named;
      }

      for (const specifier of named.elements) {
        const imported = (specifier.propertyName ?? specifier.name).text;
        const local = specifier.name.text;
        const isOld = imported === HttpMethodNames.CLASS || imported === HttpMethodNames.TYPE;

        if (isOld && NamespaceModules.isValid(module) && !bound.has(local)) {
          imports.set(local, {
            declaration: statement,
            specifier,
            imported,
            edits: [],
            isKept: false,
          });
        } else {
          if (isOld && NamespaceModules.isValid(module)) {
            list(specifier, local, HttpMethodReasons.TAKEN);
          }

          bound.set(local, module);
        }
      }
    }

    /** The local name of `name` from the new module, `undefined` when something else takes it. */
    const localOf = (name: string): string | undefined => {
      const existing = target?.elements.find(
        (element) => (element.propertyName ?? element.name).text === name,
      );

      if (existing) {
        return existing.name.text;
      }

      return bound.has(name) && bound.get(name) !== HttpMethodNames.MODULE ? undefined : name;
    };

    const needed = new Map<string, string>();

    const rewrite = (node: TS.Identifier, entry: IOldImport): void => {
      const isType = entry.imported === HttpMethodNames.TYPE;
      const name = isType ? HttpMethodNames.NEW_TYPE : HttpMethodNames.NEW_CLASS;
      const local = localOf(name);
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

      needed.set(name, isType ? `type ${name}` : name);
      entry.edits.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        text: isType ? local : `${local}.Methods`,
      });
    };

    const visit = (node: TS.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
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

    const holder = property.parent.parent;
    const isBrowserCall =
      (ts.isCallExpression(holder) && /(^|\.)fetch$/.test(holder.expression.getText())) ||
      (ts.isNewExpression(holder) && holder.expression.getText() === 'Request');
    const isUnsafePatch =
      access.name.text === 'PATCH' && !HttpMethodsTransform.isSentByArdor({ ts, node: property });

    return isBrowserCall || isUnsafePatch ? HttpMethodReasons.FETCH : undefined;
  }

  /** Whether a call of `send`, `doRequest` or `request` holds the node: those uppercase it. */
  private static isSentByArdor(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts } = opts;
    let node: TS.Node = opts.node;

    while (!ts.isSourceFile(node)) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        HttpMethodNames.SENDERS.has(node.expression.name.text)
      ) {
        return true;
      }

      node = node.parent;
    }

    return false;
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
    const present = new Set(
      target?.elements.map((element) => (element.propertyName ?? element.name).text),
    );
    const names = [...needed].filter(([name]) => !present.has(name)).map(([, text]) => text);
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
