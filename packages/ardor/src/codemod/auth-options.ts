import type * as TS from 'typescript';

import type { ICodemodResult, ICodemodInput } from './command';
import { ProvideScan } from './provide-scan';
import { CodemodSource, type ISourceEdit } from './source';
import type { IFinding, TTypeScript } from './transform';

/** The value of `CoreBindings.AUTH_PROVIDER_OPTIONS`, so a key written as a string is found too. */
const AUTH_OPTIONS_VALUE = '@app/application/options/auth';
const AUTH_OPTIONS_MEMBER = 'AUTH_PROVIDER_OPTIONS';
const USE = 'use';

const NOT_LITERAL = 'the options are not a plain object literal: add use: true to them by hand';
const NO_RETURN = 'the method does not return the options: add use: true to them by hand';
const SPREAD_ONLY = 'the options are only a spread: add use: true to them by hand';
const NO_USE_TYPE =
  'it has no use, so the options no longer fit it: type them as TAuthProviderOptions';
const SIGN_IN_ON =
  'use: true was added, so sign-in is on. An app with no sign-in binds { use: false } or no options';

/** Where the options are given: the expression, or `undefined` when the method never returns one. */
interface IOptionsValue {
  value: TS.Expression | undefined;
  /** The node a finding points at. */
  anchor: TS.Node;
  /** The return type the method declares. */
  declaredType?: TS.TypeNode;
}

/** Adds `use: true` to the auth provider options an app binds, which 0.4.8 reads to turn sign-in on. */
export class AuthOptionsTransform {
  static run(opts: ICodemodInput): ICodemodResult {
    const { ts, fileName, text } = opts;

    if (!text.includes(AUTH_OPTIONS_MEMBER) && !text.includes(AUTH_OPTIONS_VALUE)) {
      return { text, renamed: 0, findings: [] };
    }

    const sourceFile = CodemodSource.parse({ ts, fileName, text });
    const coreBindings = CodemodSource.localNames({
      ts,
      sourceFile,
      exportName: ProvideScan.CORE_BINDINGS,
    });
    const isKey = (node: TS.Expression): boolean =>
      ProvideScan.isKey({
        ts,
        node,
        coreBindings,
        member: AUTH_OPTIONS_MEMBER,
        value: AUTH_OPTIONS_VALUE,
      });
    const noUseNames = CodemodSource.localNames({
      ts,
      sourceFile,
      exportName: 'IAuthProviderOptions',
    });
    const values = [
      ...AuthOptionsTransform.boundValues({ ts, sourceFile, isKey }),
      ...AuthOptionsTransform.providedValues({ ts, sourceFile, isKey }),
    ];
    const edits: ISourceEdit[] = [];
    const findings: IFinding[] = [];

    for (const { value, anchor, declaredType } of values) {
      const line = CodemodSource.lineOf({ sourceFile, node: anchor });

      if (value === undefined) {
        findings.push({ line, name: `CoreBindings.${AUTH_OPTIONS_MEMBER}`, reason: NO_RETURN });
        continue;
      }

      const literal = CodemodSource.unwrap({ ts, node: value });

      if (!ts.isObjectLiteralExpression(literal)) {
        findings.push({ line, name: `CoreBindings.${AUTH_OPTIONS_MEMBER}`, reason: NOT_LITERAL });
        continue;
      }

      const edit = AuthOptionsTransform.edit({ ts, sourceFile, literal });

      if (edit === 'spread-only') {
        findings.push({ line, name: `CoreBindings.${AUTH_OPTIONS_MEMBER}`, reason: SPREAD_ONLY });
      } else if (edit !== undefined) {
        edits.push(edit);

        for (const type of AuthOptionsTransform.typesOf({ ts, value, declaredType })) {
          if (
            ts.isTypeReferenceNode(type) &&
            ts.isIdentifier(type.typeName) &&
            noUseNames.has(type.typeName.text)
          ) {
            findings.push({
              line: CodemodSource.lineOf({ sourceFile, node: type }),
              name: 'IAuthProviderOptions',
              reason: NO_USE_TYPE,
            });
          }
        }

        findings.push({
          line,
          name: `CoreBindings.${AUTH_OPTIONS_MEMBER}`,
          reason: SIGN_IN_ON,
          level: 'note',
        });
      }
    }

    return {
      text: CodemodSource.apply({ text, edits }),
      renamed: edits.length,
      findings: AuthOptionsTransform.unique({ findings }).sort((a, b) => a.line - b.line),
    };
  }

  /** A method with two returns reports its type once. */
  private static unique(opts: { findings: IFinding[] }): IFinding[] {
    const seen = new Set<string>();

    return opts.findings.filter((finding) => {
      const id = `${finding.line}:${finding.name}:${finding.reason}`;

      if (seen.has(id)) {
        return false;
      }

      seen.add(id);

      return true;
    });
  }

  /** `<x>.bind({ key }).toValue(value)`: the value argument. */
  private static boundValues(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    isKey: (node: TS.Expression) => boolean;
  }): IOptionsValue[] {
    const { ts, sourceFile, isKey } = opts;
    const found: IOptionsValue[] = [];

    const visit = (node: TS.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'toValue' &&
        ts.isCallExpression(node.expression.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression.expression) &&
        node.expression.expression.expression.name.text === 'bind'
      ) {
        const bindCall = node.expression.expression;
        const [binding] = bindCall.arguments;
        const literal =
          binding === undefined ? undefined : CodemodSource.unwrap({ ts, node: binding });
        const key =
          literal !== undefined && ts.isObjectLiteralExpression(literal)
            ? CodemodSource.propertyOf({ ts, literal, name: 'key' })
            : undefined;

        if (key !== undefined && isKey(key)) {
          found.push({
            value: node.arguments[0],
            anchor: node,
            declaredType: bindCall.typeArguments?.[0],
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return found;
  }

  /** A `@provide({ key })` method of this key: what each `return` of it returns. */
  private static providedValues(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    isKey: (node: TS.Expression) => boolean;
  }): IOptionsValue[] {
    const { ts, sourceFile, isKey } = opts;
    const found: IOptionsValue[] = [];

    for (const { method, keyNode } of ProvideScan.providedMethods({ ts, sourceFile })) {
      if (!isKey(keyNode)) {
        continue;
      }

      const returns = ProvideScan.returns({ ts, method });

      if (returns.length === 0) {
        found.push({ value: undefined, anchor: method });
      }

      for (const statement of returns) {
        found.push({
          value: statement.expression,
          anchor: statement,
          declaredType: method.type,
        });
      }
    }

    return found;
  }

  /** The types written for the options: the return type of the method, and each `as` or `satisfies` around the literal. */
  private static typesOf(opts: {
    ts: TTypeScript;
    value: TS.Expression;
    declaredType: TS.TypeNode | undefined;
  }): TS.TypeNode[] {
    const { ts } = opts;
    const types = opts.declaredType === undefined ? [] : [opts.declaredType];
    let node = opts.value;

    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
        types.push(node.type);
      }

      node = node.expression;
    }

    return types;
  }

  /** The edit that starts the literal with `use: true`; `undefined` when it has `use` already. */
  private static edit(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    literal: TS.ObjectLiteralExpression;
  }): ISourceEdit | 'spread-only' | undefined {
    const { ts, sourceFile, literal } = opts;
    const { properties } = literal;

    const hasUse = properties.some(
      (property) =>
        (ts.isPropertyAssignment(property) ||
          ts.isShorthandPropertyAssignment(property) ||
          ts.isMethodDeclaration(property)) &&
        CodemodSource.nameOf({ ts, node: property.name }) === USE,
    );

    if (hasUse) {
      return undefined;
    }

    const open = literal.getStart(sourceFile) + 1;
    const text = sourceFile.text;

    if (properties.length === 0) {
      return /^\s*$/.test(text.slice(open, literal.getEnd() - 1))
        ? { start: open - 1, end: literal.getEnd(), text: `{ ${USE}: true }` }
        : { start: open, end: open, text: ` ${USE}: true` };
    }

    if (properties.every((property) => ts.isSpreadAssignment(property))) {
      return 'spread-only';
    }

    const [first] = properties;

    if (first === undefined) {
      return undefined;
    }

    const firstLine = sourceFile.getLineAndCharacterOfPosition(first.getStart(sourceFile));
    const openLine = sourceFile.getLineAndCharacterOfPosition(open - 1);

    if (firstLine.line !== openLine.line) {
      const lineStart = sourceFile.getPositionOfLineAndCharacter(firstLine.line, 0);
      const indent = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';

      return { start: open, end: open, text: `\n${indent}${USE}: true,` };
    }

    return {
      start: open,
      end: open,
      text: /\s/.test(text.charAt(open)) ? ` ${USE}: true,` : ` ${USE}: true, `,
    };
  }
}
