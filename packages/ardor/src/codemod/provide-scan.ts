import type * as TS from 'typescript';

import { CodemodSource } from './source';
import type { TTypeScript } from './transform';

export interface IProvidedMethod {
  method: TS.MethodDeclaration;
  /** The expression written as `key` in `@provide({ key })`. */
  keyNode: TS.Expression;
  /** The decorator is `provideOption`, which the compiler checks against the type of the key. */
  isOption: boolean;
}

/** Finds the binding keys and the `@provide` methods of a file, the way an app spells them. */
export class ProvideScan {
  static readonly CORE_BINDINGS = 'CoreBindings';
  static readonly DECORATOR = 'provide';
  static readonly OPTION_DECORATOR = 'provideOption';

  /** True when `node` is `<CoreBindings>.<member>`, `<CoreBindings>['<member>']` or the string `value`. */
  static isKey(opts: {
    ts: TTypeScript;
    node: TS.Expression;
    coreBindings: Set<string>;
    member: string;
    value: string;
  }): boolean {
    const { ts, coreBindings, member, value } = opts;
    const node = CodemodSource.unwrap({ ts, node: opts.node });

    if (ts.isStringLiteralLike(node)) {
      return node.text === value;
    }

    if (ts.isPropertyAccessExpression(node)) {
      return (
        ts.isIdentifier(node.expression) &&
        coreBindings.has(node.expression.text) &&
        node.name.text === member
      );
    }

    return (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      coreBindings.has(node.expression.text) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === member
    );
  }

  /** Every method decorated `@provide({ key })` or `@provideOption({ key })`, whatever the decorators are called here. */
  static providedMethods(opts: { ts: TTypeScript; sourceFile: TS.SourceFile }): IProvidedMethod[] {
    const { ts, sourceFile } = opts;
    const optionNames = CodemodSource.localNames({
      ts,
      sourceFile,
      exportName: ProvideScan.OPTION_DECORATOR,
    });
    const names = new Set([
      ...optionNames,
      ...CodemodSource.localNames({ ts, sourceFile, exportName: ProvideScan.DECORATOR }),
    ]);
    const found: IProvidedMethod[] = [];

    const visit = (node: TS.Node): void => {
      if (ts.isMethodDeclaration(node)) {
        for (const decorator of ts.getDecorators(node) ?? []) {
          const call = decorator.expression;

          if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
            continue;
          }

          const [argument] = call.arguments;

          if (!names.has(call.expression.text) || argument === undefined) {
            continue;
          }

          const literal = CodemodSource.unwrap({ ts, node: argument });
          const keyNode = ts.isObjectLiteralExpression(literal)
            ? CodemodSource.propertyOf({ ts, literal, name: 'key' })
            : undefined;

          if (keyNode !== undefined) {
            found.push({ method: node, keyNode, isOption: optionNames.has(call.expression.text) });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return found;
  }

  /** The `return` statements of a method itself, not those of a function nested in it. */
  static returns(opts: { ts: TTypeScript; method: TS.MethodDeclaration }): TS.ReturnStatement[] {
    const { ts, method } = opts;
    const found: TS.ReturnStatement[] = [];

    const visit = (node: TS.Node): void => {
      if (ts.isReturnStatement(node)) {
        found.push(node);

        return;
      }

      if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
        return;
      }

      ts.forEachChild(node, visit);
    };

    if (method.body !== undefined) {
      ts.forEachChild(method.body, visit);
    }

    return found;
  }
}
