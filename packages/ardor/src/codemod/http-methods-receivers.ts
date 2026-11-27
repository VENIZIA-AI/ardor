import type * as TS from 'typescript';

import type { TConstValue } from '@venizia/ignis-helpers/common';
import { NamespaceModules } from './renames';
import type { TTypeScript } from './transform';

/** The calls that uppercase the method they are handed. */
export class SenderCalls {
  static readonly SEND = 'send';
  static readonly DO_REQUEST = 'doRequest';
}

class ReceiverKinds {
  static readonly PROVIDER = 'provider';
  static readonly SERVICE = 'service';
  static readonly OTHER = 'other';

  /** The ARDOR types whose `send` or `doRequest` uppercases the method. */
  static readonly BY_TYPE = new Map([
    ['IDataProvider', this.PROVIDER],
    ['DefaultRestDataProvider', this.PROVIDER],
    ['CountRestDataProvider', this.PROVIDER],
    ['DefaultNetworkRequestService', this.SERVICE],
  ]);
}

/**
 * Whether the receiver of a call is ARDOR's data provider or network service, read from syntax: the
 * declared type of a name, the class that `this` is in, or `getNetworkService()`. Anything it
 * cannot read is not ARDOR's.
 */
export class HttpMethodReceivers {
  private readonly ts: TTypeScript;
  /** The local name of each ARDOR type the file imports, to its kind. */
  private readonly types = new Map<string, string>();
  /** Every kind a name is declared with: one kind alone is trusted. */
  private readonly names = new Map<string, Set<string>>();
  private overridesDoRequest = false;

  constructor(opts: { ts: TTypeScript; sourceFile: TS.SourceFile }) {
    this.ts = opts.ts;
    this.readImports({ sourceFile: opts.sourceFile });
    this.readDeclarations({ node: opts.sourceFile });
  }

  /** Whether `call` is `send` on a data provider, or `doRequest` on a network service. */
  isSend(opts: { call: TS.Node; name: TConstValue<typeof SenderCalls> }): boolean {
    const { call, name } = opts;
    const { ts } = this;

    if (
      !ts.isCallExpression(call) ||
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.name.text !== name
    ) {
      return false;
    }

    if (name === SenderCalls.DO_REQUEST && this.overridesDoRequest) {
      return false;
    }

    const expected = name === SenderCalls.SEND ? ReceiverKinds.PROVIDER : ReceiverKinds.SERVICE;

    return this.kindOf({ node: call.expression.expression }) === expected;
  }

  private kindOf(opts: { node: TS.Expression }): string | undefined {
    const { node } = opts;
    const { ts } = this;

    if (ts.isIdentifier(node)) {
      return this.kindOfName({ name: node.text });
    }

    if (ts.isPropertyAccessExpression(node)) {
      return node.expression.kind === ts.SyntaxKind.ThisKeyword
        ? this.kindOfName({ name: node.name.text })
        : undefined;
    }

    if (node.kind === ts.SyntaxKind.ThisKeyword || node.kind === ts.SyntaxKind.SuperKeyword) {
      return this.kindOfClass({ node });
    }

    const isNetworkService =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'getNetworkService' &&
      this.kindOf({ node: node.expression.expression }) === ReceiverKinds.PROVIDER;

    return isNetworkService ? ReceiverKinds.SERVICE : undefined;
  }

  private kindOfName(opts: { name: string }): string | undefined {
    const kinds = this.names.get(opts.name);

    return kinds?.size === 1 ? [...kinds][0] : undefined;
  }

  private kindOfClass(opts: { node: TS.Node }): string | undefined {
    const { ts } = this;
    let node: TS.Node = opts.node;

    while (!ts.isSourceFile(node)) {
      if (ts.isClassLike(node)) {
        const base = node.heritageClauses?.find(
          (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
        )?.types[0]?.expression;

        return base && ts.isIdentifier(base) ? this.types.get(base.text) : undefined;
      }

      node = node.parent;
    }

    return undefined;
  }

  private readImports(opts: { sourceFile: TS.SourceFile }): void {
    const { ts } = this;

    for (const statement of opts.sourceFile.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !NamespaceModules.isValid(statement.moduleSpecifier.text)
      ) {
        continue;
      }

      const named = statement.importClause?.namedBindings;

      for (const element of named && ts.isNamedImports(named) ? named.elements : []) {
        const kind = ReceiverKinds.BY_TYPE.get((element.propertyName ?? element.name).text);

        if (kind) {
          this.types.set(element.name.text, kind);
        }
      }
    }
  }

  private readDeclarations(opts: { node: TS.Node }): void {
    const { node } = opts;
    const { ts } = this;

    if (
      (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) &&
      node.name.getText() === SenderCalls.DO_REQUEST
    ) {
      this.overridesDoRequest = true;
    }

    if (
      (ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node) ||
        ts.isPropertyDeclaration(node)) &&
      ts.isIdentifier(node.name)
    ) {
      const type = ts.isBindingElement(node) ? undefined : node.type;
      const kind =
        type && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)
          ? this.types.get(type.typeName.text)
          : undefined;
      const kinds = this.names.get(node.name.text) ?? new Set<string>();

      this.names.set(node.name.text, kinds.add(kind ?? ReceiverKinds.OTHER));
    }

    ts.forEachChild(node, (child) => this.readDeclarations({ node: child }));
  }
}
