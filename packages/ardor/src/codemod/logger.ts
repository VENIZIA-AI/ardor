import type * as TS from 'typescript';

import type { IFinding, TTypeScript } from './transform';
import { LoggerRenames, NamespaceModules } from './renames';

export interface ILoggerResult {
  text: string;
  /** Call sites and annotations rewritten, and imports moved. */
  renamed: number;
  /** What was left, and what was changed on purpose. */
  findings: IFinding[];
}

interface ITextEdit {
  start: number;
  end: number;
  text: string;
}

interface IArdorImport {
  declaration: TS.ImportDeclaration;
  specifier: TS.ImportSpecifier;
  imported: string;
  local: string;
  typeOnly: boolean;
}

/**
 * Moves a project off the kernel logger, which IGNIS's `ILogger` replaces:
 *
 * - `BaseHelper`, `LogLevels`, `ILogger` and `TLogLevel` keep their names, so only the import moves
 *   to `@venizia/ignis-helpers/core`.
 * - `Logger.getInstance({ scope })` and `new Logger({ scope })` become
 *   `LoggerFactory.getLogger([scope])`. IGNIS's console logger has its own debug gate (off unless
 *   `DEBUG` is set, and always off in a browser), so an `enableDebug` option is dropped and noted.
 * - `Logger` as a type becomes `ILogger`.
 * - The `enableDebug` prop of `ArdorApplication` is removed (pass `logger`): listed.
 *
 * Any other use of `Logger` (a subclass, `instanceof`, a spread argument) is listed and `Logger` stays
 * imported, so the file shows exactly where to look.
 */
export class LoggerTransform {
  static run(opts: { ts: TTypeScript; fileName: string; text: string }): ILoggerResult {
    const { ts, fileName, text } = opts;
    const unchanged: ILoggerResult = { text, renamed: 0, findings: [] };

    if (!text.includes('@venizia/ardor')) {
      return unchanged;
    }

    const sourceFile = ts.createSourceFile(
      fileName,
      text,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const imports = LoggerTransform.collectImports({ ts, sourceFile });
    const findings: IFinding[] = [];

    LoggerTransform.findEnableDebugProp({ ts, sourceFile, imports, findings });

    const moved = imports.filter((entry) => LoggerRenames.MOVED.has(entry.imported));
    const logger = imports.find((entry) => entry.imported === 'Logger');

    if (moved.length === 0 && !logger) {
      return { text, renamed: 0, findings };
    }

    const edits: ITextEdit[] = [];
    const additions: string[] = [];
    const removed = new Set<TS.ImportSpecifier>(moved.map((entry) => entry.specifier));
    const taken = LoggerTransform.takenNames({ ts, sourceFile, moved: removed });
    let renamed = moved.length;

    for (const entry of moved) {
      // The new import is a value import: a name that was type-only stays `type`.
      additions.push(
        `${entry.typeOnly ? 'type ' : ''}${entry.specifier.getText(sourceFile).replace(/^type\s+/, '')}`,
      );
    }

    if (logger) {
      const outcome = LoggerTransform.rewriteLogger({
        ts,
        sourceFile,
        logger,
        imports,
        findings,
        edits,
        additions,
        taken,
      });

      renamed += outcome.renamed;

      if (outcome.isFullyMoved) {
        removed.add(logger.specifier);
      }
    }

    const hasAdditions = additions.length > 0;
    const importEdits = LoggerTransform.importEdits({
      ts,
      sourceFile,
      removed,
      additions: [...new Set(additions)],
    });

    if (edits.length === 0 && removed.size === 0 && !hasAdditions) {
      return { text, renamed: 0, findings };
    }

    return {
      text: LoggerTransform.apply({ text, edits: [...edits, ...importEdits] }),
      renamed,
      findings,
    };
  }

  private static collectImports(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
  }): IArdorImport[] {
    const { ts, sourceFile } = opts;
    const entries: IArdorImport[] = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }

      const clause = statement.importClause;
      const named = clause?.namedBindings;

      if (
        !NamespaceModules.isValid(statement.moduleSpecifier.text) ||
        !named ||
        !ts.isNamedImports(named)
      ) {
        continue;
      }

      for (const specifier of named.elements) {
        entries.push({
          declaration: statement,
          specifier,
          imported: (specifier.propertyName ?? specifier.name).text,
          local: specifier.name.text,
          typeOnly: Boolean(clause?.isTypeOnly) || specifier.isTypeOnly,
        });
      }
    }

    return entries;
  }

  /** `<ArdorApplication enableDebug />`: the prop is gone, the logger is passed instead. */
  private static findEnableDebugProp(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    imports: IArdorImport[];
    findings: IFinding[];
  }): void {
    const { ts, sourceFile, imports, findings } = opts;
    const application = imports.find((entry) => entry.imported === 'ArdorApplication');

    if (!application) {
      return;
    }

    const visit = (node: TS.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const isApplication =
          ts.isIdentifier(node.tagName) && node.tagName.text === application.local;

        if (isApplication) {
          for (const attribute of node.attributes.properties) {
            if (
              ts.isJsxAttribute(attribute) &&
              attribute.name.getText(sourceFile) === 'enableDebug'
            ) {
              findings.push({
                line:
                  sourceFile.getLineAndCharacterOfPosition(attribute.getStart(sourceFile)).line + 1,
                name: 'enableDebug',
                reason:
                  'removed: debug lines are off by default now (a browser, or `DEBUG` unset); turn them on with `LoggerFactory.use({ level: LogLevels.DEBUG })` at startup, or pass `logger={...}` to ArdorApplication',
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /** The uses of `Logger`. `isFullyMoved` is true when none is left, so its import can go. */
  private static rewriteLogger(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    logger: IArdorImport;
    imports: IArdorImport[];
    findings: IFinding[];
    edits: ITextEdit[];
    additions: string[];
    taken: Set<string>;
  }): { renamed: number; isFullyMoved: boolean } {
    const { ts, sourceFile, logger, findings, edits, additions, taken } = opts;
    // A file can already own the name (a project keeps its own LoggerFactory or BaseHelper): then IGNIS's is imported under an alias.
    const factory = LoggerTransform.freeName({ taken, name: LoggerRenames.FACTORY });
    const type = LoggerTransform.freeName({ taken, name: LoggerRenames.TYPE });
    const importOf = (name: string, local: string): string =>
      local === name ? name : `${name} as ${local}`;
    let renamed = 0;
    let isFullyMoved = true;
    const handled = new Set<TS.Node>();

    const lineOf = (node: TS.Node): number =>
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    const leave = (node: TS.Node, reason: string): void => {
      isFullyMoved = false;
      findings.push({ line: lineOf(node), name: logger.local, reason });
    };

    const scopeOf = (
      call: TS.CallExpression | TS.NewExpression,
    ): { text: string; debug: boolean } | undefined => {
      const argument = call.arguments?.[0];

      if (!argument || !ts.isObjectLiteralExpression(argument)) {
        return undefined;
      }

      let scope: string | undefined;
      let debug = false;

      for (const property of argument.properties) {
        if (ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'scope') {
          scope = property.initializer.getText(sourceFile);
        } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'scope') {
          scope = 'scope';
        } else if (
          (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
          property.name.getText(sourceFile) === 'enableDebug'
        ) {
          debug = true;
        } else {
          return undefined;
        }
      }

      return scope === undefined ? undefined : { text: scope, debug };
    };

    const rewriteCall = (call: TS.CallExpression | TS.NewExpression, target: TS.Node): void => {
      const parsed = scopeOf(call);

      if (!parsed) {
        leave(
          target,
          'Logger is removed; pass an object with a scope to `LoggerFactory.getLogger([scope])`, or use your own ILogger',
        );

        return;
      }

      edits.push({
        start: call.getStart(sourceFile),
        end: call.getEnd(),
        text: `${factory}.getLogger([${parsed.text}])`,
      });
      additions.push(importOf(LoggerRenames.FACTORY, factory));
      renamed += 1;

      if (parsed.debug) {
        findings.push({
          line: lineOf(call),
          name: 'enableDebug',
          reason:
            'note: dropped. debug lines are off by default now (a browser, or `DEBUG` unset); turn them on with `LoggerFactory.use({ level: LogLevels.DEBUG })` at startup',
          kind: 'note',
        });
      }

      handled.add(target);
    };

    const visit = (node: TS.Node): void => {
      if (ts.isImportDeclaration(node)) {
        return;
      }

      if (ts.isIdentifier(node) && node.text === logger.local) {
        const { parent } = node;

        if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
          return;
        }

        if (
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === node &&
          parent.name.text === 'getInstance' &&
          ts.isCallExpression(parent.parent) &&
          parent.parent.expression === parent
        ) {
          rewriteCall(parent.parent, node);
        } else if (ts.isNewExpression(parent) && parent.expression === node) {
          rewriteCall(parent, node);
        } else if (ts.isTypeReferenceNode(parent) && parent.typeName === node) {
          edits.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            text: type,
          });
          additions.push(`type ${importOf(LoggerRenames.TYPE, type)}`);
          renamed += 1;
        } else if (ts.isExportSpecifier(parent) && parent.propertyName && parent.name === node) {
          return;
        } else {
          leave(
            node,
            'Logger is removed; this use has no one-line replacement (a subclass, instanceof, a static member): use an ILogger',
          );
        }

        return;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return { renamed, isFullyMoved };
  }

  /** The top-level names the file already owns, other than the IGNIS ones it imports and the ARDOR ones being moved. */
  private static takenNames(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    moved: Set<TS.ImportSpecifier>;
  }): Set<string> {
    const { ts, sourceFile, moved } = opts;
    const taken = new Set<string>();

    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        const named = clause?.namedBindings;

        if (
          !clause ||
          (ts.isStringLiteral(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text === LoggerRenames.CORE_MODULE)
        ) {
          continue;
        }

        if (clause.name) {
          taken.add(clause.name.text);
        }

        if (named && ts.isNamespaceImport(named)) {
          taken.add(named.name.text);
        } else if (named) {
          for (const element of named.elements) {
            if (!moved.has(element)) {
              taken.add(element.name.text);
            }
          }
        }
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            taken.add(declaration.name.text);
          }
        }
      } else if (
        (ts.isClassDeclaration(statement) ||
          ts.isFunctionDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
        statement.name
      ) {
        taken.add(statement.name.text);
      }
    }

    return taken;
  }

  /** `name` when the file does not own it, else `Ignis<name>`. */
  private static freeName(opts: { taken: Set<string>; name: string }): string {
    return opts.taken.has(opts.name) ? `Ignis${opts.name}` : opts.name;
  }

  /** The ARDOR import lines without the moved names, and `@venizia/ignis-helpers/core` with them. */
  private static importEdits(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    removed: Set<TS.ImportSpecifier>;
    additions: string[];
  }): ITextEdit[] {
    const { ts, sourceFile, removed, additions } = opts;
    const edits: ITextEdit[] = [];
    const nameOf = (addition: string): string =>
      addition
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop() ?? addition;

    // Which core import to add to, if the file has one with braces.
    const core = sourceFile.statements.find(
      (statement): statement is TS.ImportDeclaration =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === LoggerRenames.CORE_MODULE &&
        !statement.importClause?.isTypeOnly &&
        statement.importClause?.namedBindings !== undefined &&
        ts.isNamedImports(statement.importClause.namedBindings),
    );
    const present = new Set<string>();

    if (core?.importClause?.namedBindings && ts.isNamedImports(core.importClause.namedBindings)) {
      for (const element of core.importClause.namedBindings.elements) {
        present.add(element.name.text);
      }
    }

    const fresh = additions.filter((addition) => !present.has(nameOf(addition)));
    // A name already imported as a value covers the same name needed as a type.
    const names = fresh.filter(
      (addition) => !(addition.startsWith('type ') && fresh.includes(nameOf(addition))),
    );
    let insertion = '';

    if (
      names.length > 0 &&
      core?.importClause?.namedBindings &&
      ts.isNamedImports(core.importClause.namedBindings)
    ) {
      const named = core.importClause.namedBindings;
      const existing = named.elements.map((element) => element.getText(sourceFile));

      edits.push({
        start: named.getStart(sourceFile),
        end: named.getEnd(),
        text: `{ ${[...existing, ...names].join(', ')} }`,
      });
    } else if (names.length > 0) {
      insertion = `import { ${names.join(', ')} } from '${LoggerRenames.CORE_MODULE}';\n`;
    }

    let inserted = insertion === '';

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) {
        continue;
      }

      const clause = statement.importClause;
      const named = clause?.namedBindings;

      if (!clause || !named || !ts.isNamedImports(named)) {
        continue;
      }

      const dropped = named.elements.filter((element) => removed.has(element));

      if (dropped.length === 0) {
        continue;
      }

      const kept = named.elements
        .filter((element) => !removed.has(element))
        .map((element) => element.getText(sourceFile));
      const lead = inserted ? '' : insertion;

      inserted = true;

      if (kept.length > 0) {
        if (lead) {
          edits.push({
            start: statement.getStart(sourceFile),
            end: statement.getStart(sourceFile),
            text: lead,
          });
        }

        edits.push({
          start: named.getStart(sourceFile),
          end: named.getEnd(),
          text: named.getText(sourceFile).includes('\n')
            ? `{\n${kept.map((name) => `  ${name},`).join('\n')}\n}`
            : `{ ${kept.join(', ')} }`,
        });
      } else if (clause.name) {
        edits.push({ start: clause.name.getEnd(), end: named.getEnd(), text: '' });

        if (lead) {
          edits.push({
            start: statement.getStart(sourceFile),
            end: statement.getStart(sourceFile),
            text: lead,
          });
        }
      } else {
        let end = statement.getEnd();

        if (sourceFile.text[end] === '\n') {
          end += 1;
        }

        edits.push({ start: statement.getStart(sourceFile), end, text: lead });
      }
    }

    return edits;
  }

  private static apply(opts: { text: string; edits: ITextEdit[] }): string {
    // Equal starts: the longer edit first, so an insertion lands before what it precedes.
    const ordered = [...opts.edits].sort((a, b) => b.start - a.start || b.end - a.end);
    let result = opts.text;

    for (const edit of ordered) {
      result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
    }

    return result;
  }
}
