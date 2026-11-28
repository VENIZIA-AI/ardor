import type * as TS from 'typescript';

import type { ICodemodInput, ICodemodResult } from './command';
import { ProvideScan } from './provide-scan';
import { CodemodSource } from './source';
import type { IFinding, TTypeScript } from './transform';

/** The key members and the string values behind them, which a `@provide` method of a default provider names. */
const DEFAULT_KEYS = [
  { member: 'DEFAULT_REST_DATA_PROVIDER', value: '@app/application/data/rest/default' },
  { member: 'DEFAULT_AUTH_PROVIDER', value: '@app/application/auth/default' },
  { member: 'DEFAULT_I18N_PROVIDER', value: '@app/application/i18n/default' },
  { member: 'DEFAULT_AUTH_SERVICE', value: '@app/application/service/auth/default' },
];

/** The default class each key holds in 0.4.8: a method that builds that class under that key is the one to delete. */
const KEY_OF_CLASS: Record<string, string> = {
  DefaultRestDataProvider: 'DEFAULT_REST_DATA_PROVIDER',
  DefaultAuthProvider: 'DEFAULT_AUTH_PROVIDER',
  DefaultI18nProvider: 'DEFAULT_I18N_PROVIDER',
  DefaultAuthService: 'DEFAULT_AUTH_SERVICE',
};

/** What 0.4.8 binds itself. */
const DEFAULT_CLASSES = new Set(Object.keys(KEY_OF_CLASS));

const DROP_INJECTION = 'the APPLICATION_INSTANCE it injects if nothing else uses it';

/**
 * Lists the `@provide` methods that build a default provider by hand,
 * `<expr>.instantiate(X).value(<expr>)` or a bare `<expr>.instantiate(X)`, and never changes the text: what to do
 * about each one depends on the code around it.
 */
export class DefaultProvidersTransform {
  static run(opts: ICodemodInput): ICodemodResult {
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
    const keyMember = (node: TS.Expression): string | undefined =>
      DEFAULT_KEYS.find(({ member, value }) =>
        ProvideScan.isKey({ ts, node, coreBindings, member, value }),
      )?.member;
    const findings: IFinding[] = [];

    for (const { method, keyNode } of ProvideScan.providedMethods({ ts, sourceFile })) {
      for (const statement of ProvideScan.returns({ ts, method })) {
        const className = DefaultProvidersTransform.instantiated({
          ts,
          node: statement.expression,
        });

        const member = keyMember(keyNode);

        if (className === undefined || !(DEFAULT_CLASSES.has(className) || member !== undefined)) {
          continue;
        }

        const isProvider = DefaultProvidersTransform.hasValue({ ts, node: statement.expression });

        findings.push({
          line: CodemodSource.lineOf({ sourceFile, node: method }),
          name: `${DefaultProvidersTransform.nameOf({ ts, method })}(): instantiate(${className})${isProvider ? '.value()' : ''}`,
          reason: DefaultProvidersTransform.reasonOf({ className, member, isProvider }),
        });
      }
    }

    return { text, renamed: 0, findings: findings.sort((a, b) => a.line - b.line) };
  }

  /**
   * What to do about a method that builds `className` under the key `member` (`undefined`: a key of the application).
   * `isProvider`: the method returns `.value(...)` of a provider, else the class instance itself.
   */
  private static reasonOf(opts: {
    className: string;
    member: string | undefined;
    isProvider: boolean;
  }): string {
    const { className, member, isProvider } = opts;

    // Only the default class under its own key is bound by ARDOR: deleting any other method would unbind its key.
    if (DEFAULT_CLASSES.has(className) && KEY_OF_CLASS[className] === member) {
      return `delete this method and ${DROP_INJECTION}: ARDOR binds ${className} itself`;
    }

    const binder = isProvider ? 'toProvider' : 'toClass';
    const bind = `replace this method by one line in bindContext(): .${binder}(${className}).setScope(BindingScopes.SINGLETON) on the key, and delete ${DROP_INJECTION}`;

    return member === 'DEFAULT_AUTH_PROVIDER' && !DEFAULT_CLASSES.has(className)
      ? `${bind}. Also bind CoreBindings.AUTH_PROVIDER_OPTIONS as { use: true, ...paths }: without options sign-in is off and start() fails`
      : bind;
  }

  /** Whether the node is `<expr>.instantiate(Class).value(<expr>)`, not a bare `<expr>.instantiate(Class)`. */
  private static hasValue(opts: { ts: TTypeScript; node: TS.Expression | undefined }): boolean {
    const { ts, node } = opts;

    if (node === undefined) {
      return false;
    }

    const value = CodemodSource.unwrap({ ts, node });

    return DefaultProvidersTransform.receiverOf({ ts, node: value, method: 'value' }) !== undefined;
  }

  /** The `<expr>` of a call `<expr>.method(...)`, if that is what the node is. */
  private static receiverOf(opts: {
    ts: TTypeScript;
    node: TS.Expression;
    method: string;
  }): TS.Expression | undefined {
    const { ts, node, method } = opts;

    return ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === method
      ? node.expression.expression
      : undefined;
  }

  /** The class of `<expr>.instantiate(Class).value(<expr>)` or `<expr>.instantiate(Class)`, if that is what the node is. */
  private static instantiated(opts: {
    ts: TTypeScript;
    node: TS.Expression | undefined;
  }): string | undefined {
    const { ts } = opts;

    if (opts.node === undefined) {
      return undefined;
    }

    const value = CodemodSource.unwrap({ ts, node: opts.node });

    // `.value(<expr>)` is optional: a bare `<expr>.instantiate(Class)` is built the same way.
    const instantiate =
      DefaultProvidersTransform.receiverOf({ ts, node: value, method: 'value' }) ?? value;

    if (
      !ts.isCallExpression(instantiate) ||
      DefaultProvidersTransform.receiverOf({ ts, node: instantiate, method: 'instantiate' }) ===
        undefined
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
