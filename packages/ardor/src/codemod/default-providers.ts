import type * as TS from 'typescript';

import type { ICodemodResult } from './command';
import { ProvideScan } from './provide-scan';
import { CodemodSource } from './source';
import type { IFinding, TTypeScript } from './transform';

/** The key members and the string values behind them, which a `@provide` method of a default provider names. */
const DEFAULT_KEYS = [
  { member: 'DEFAULT_REST_DATA_PROVIDER', value: '@app/application/data/rest/default' },
  { member: 'DEFAULT_AUTH_PROVIDER', value: '@app/application/auth/default' },
  { member: 'DEFAULT_I18N_PROVIDER', value: '@app/application/i18n/default' },
];

/** What 0.4.8 binds itself. */
const DEFAULT_CLASSES = new Set([
  'DefaultRestDataProvider',
  'DefaultAuthProvider',
  'DefaultI18nProvider',
  'DefaultAuthService',
]);

const DROP_INJECTION = 'the APPLICATION_INSTANCE it injects if nothing else uses it';

/**
 * Lists the `@provide` methods that build a default provider by hand,
 * `<expr>.instantiate(X).value(<expr>)`, and never changes the text: what to do about each one
 * depends on the code around it.
 */
export class DefaultProvidersTransform {
  static run(opts: {
    ts: TTypeScript;
    fileName: string;
    text: string;
    hooks: boolean;
  }): ICodemodResult {
    const { ts, fileName, text } = opts;

    if (!text.includes('instantiate')) {
      return { text, renamed: 0, findings: [] };
    }

    const sourceFile = CodemodSource.parse({ ts, fileName, text });
    const coreBindings = CodemodSource.localNames({
      ts,
      sourceFile,
      exportName: ProvideScan.CORE_BINDINGS,
    });
    const isDefaultKey = (node: TS.Expression): boolean =>
      DEFAULT_KEYS.some(({ member, value }) =>
        ProvideScan.isKey({ ts, node, coreBindings, member, value }),
      );
    const findings: IFinding[] = [];

    for (const { method, keyNode } of ProvideScan.providedMethods({ ts, sourceFile })) {
      for (const statement of ProvideScan.returns({ ts, method })) {
        const className = DefaultProvidersTransform.instantiated({
          ts,
          node: statement.expression,
        });

        if (className === undefined || !(DEFAULT_CLASSES.has(className) || isDefaultKey(keyNode))) {
          continue;
        }

        findings.push({
          line: CodemodSource.lineOf({ sourceFile, node: method }),
          name: `${DefaultProvidersTransform.nameOf({ ts, method })}(): instantiate(${className}).value()`,
          reason: DEFAULT_CLASSES.has(className)
            ? `delete this method and ${DROP_INJECTION}: ARDOR binds ${className} itself`
            : `replace this method by one line in bindContext(): .toProvider(${className}) on the key, and delete ${DROP_INJECTION}`,
        });
      }
    }

    return { text, renamed: 0, findings: findings.sort((a, b) => a.line - b.line) };
  }

  /** The class of `<expr>.instantiate(Class).value(<expr>)`, if that is what the node is. */
  private static instantiated(opts: {
    ts: TTypeScript;
    node: TS.Expression | undefined;
  }): string | undefined {
    const { ts } = opts;

    if (opts.node === undefined) {
      return undefined;
    }

    const value = CodemodSource.unwrap({ ts, node: opts.node });

    if (
      !ts.isCallExpression(value) ||
      !ts.isPropertyAccessExpression(value.expression) ||
      value.expression.name.text !== 'value'
    ) {
      return undefined;
    }

    const instantiate = value.expression.expression;

    if (
      !ts.isCallExpression(instantiate) ||
      !ts.isPropertyAccessExpression(instantiate.expression) ||
      instantiate.expression.name.text !== 'instantiate'
    ) {
      return undefined;
    }

    const [target] = instantiate.arguments;

    return target !== undefined && ts.isIdentifier(target) ? target.text : undefined;
  }

  private static nameOf(opts: { ts: TTypeScript; method: TS.MethodDeclaration }): string {
    const { ts, method } = opts;

    return ts.isIdentifier(method.name) ? method.name.text : 'method';
  }
}
