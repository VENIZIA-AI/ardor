import type * as TS from 'typescript';

import type { ICodemodInput, ICodemodResult } from './command';
import { CodemodSource, type ISourceEdit } from './source';
import type { IFinding, TTypeScript } from './transform';

/** Each removed option and its name inside `noAuth`, in the order the object lists them. */
const MEMBER_OF: ReadonlyMap<string, string> = new Map([
  ['noAuthPaths', 'paths'],
  ['noAuthPathRegex', 'regex'],
]);
const GROUP = 'noAuth';

const NOT_ARDOR =
  'the file imports nothing from ARDOR: move it into noAuth: { paths, regex } by hand';
const SPREAD =
  'the literal has a spread, which may carry the other half: merge noAuth: { paths, regex } by hand';
const MERGED =
  'the literal is spread or assigned into another object, where one noAuth replaces another: merge noAuth by hand';
const SPLIT =
  'this file makes a noAuth elsewhere or holds the other half alone, and a merge would keep one noAuth: write one noAuth: { paths, regex } by hand';
const HAS_GROUP = 'the literal already has noAuth: move it inside by hand';
const NOT_VALUE = 'not a plain value: move it into noAuth by hand';
const COMMENT = 'a comment sits inside what would move: move it into noAuth by hand';
const OLD_TYPE =
  'INoAuthOptions is now the type of noAuth: write { paths, regex } there and put it under noAuth where it is used';
const PATTERN = 'a destructuring: read it from noAuth by hand';
const TYPE_MEMBER = 'a type or class member: declare noAuth?: { paths?, regex? } by hand';
const MERGE_NOTE =
  'rewritten: if it is later merged with another object that sets noAuth, only the last noAuth stays, so merge paths and regex there';

/** Calls whose object argument is the options themselves, never merged afterwards. */
const DIRECT_CALLEES = new Set(['DefaultNetworkRequestService', 'DefaultRestDataProvider']);

/** A literal that holds something a merge could replace, or another place that makes a `noAuth`. */
interface IHolder {
  node: TS.Node;
  /** The removed options it holds. */
  names: Set<string>;
  /** Whether it has `noAuth` already. */
  hasGroup: boolean;
}

/** A removed option as one property of a literal. */
interface IMember {
  property: TS.ObjectLiteralElementLike;
  name: string;
}

/** Moves `noAuthPaths` and `noAuthPathRegex` of an object literal into `noAuth: { paths, regex }`. */
export class NoAuthTransform {
  static run(opts: ICodemodInput): ICodemodResult {
    const { ts, fileName, text } = opts;

    if (!text.includes('noAuthPath')) {
      return { text, renamed: 0, findings: [] };
    }

    const sourceFile = CodemodSource.parse({ ts, fileName, text });
    const isArdorFile = NoAuthTransform.importsArdor({ ts, sourceFile });
    const objects = NoAuthTransform.objectsOf({ ts, sourceFile });
    const edits: ISourceEdit[] = [];
    const findings: IFinding[] = [];
    let renamed = 0;

    const report = (found: {
      node: TS.Node;
      name: string;
      reason: string;
      level?: IFinding['level'];
    }): void => {
      const { node, name, reason, level } = found;
      const line = CodemodSource.lineOf({ sourceFile, node });

      findings.push({ line, name, reason, ...(level === undefined ? {} : { level }) });
    };

    const visitLiteral = (literal: TS.ObjectLiteralExpression): void => {
      const members = NoAuthTransform.membersOf({ ts, literal });
      const [first] = members;

      if (first === undefined) {
        return;
      }

      const reason = NoAuthTransform.refusalOf({
        ts,
        sourceFile,
        literal,
        members,
        isArdorFile,
        objects,
      });

      if (reason !== undefined) {
        report({ node: first.property, name: first.name, reason });

        return;
      }

      edits.push(...NoAuthTransform.editsOf({ ts, sourceFile, literal, members }));
      renamed += 1;

      if (!NoAuthTransform.isHandedOver({ ts, node: literal })) {
        report({ node: literal, name: GROUP, reason: MERGE_NOTE, level: 'note' });
      }
    };

    const visit = (node: TS.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        visitLiteral(node);
      }

      const read = NoAuthTransform.readOf({ ts, node });

      if (read !== undefined) {
        report({ node, ...read });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      text: CodemodSource.apply({ text, edits }),
      renamed,
      findings: findings.sort((a, b) => a.line - b.line),
    };
  }

  private static importsArdor(opts: { ts: TTypeScript; sourceFile: TS.SourceFile }): boolean {
    const { ts, sourceFile } = opts;

    return sourceFile.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.startsWith('@venizia/ardor'),
    );
  }

  /** The name of a property, a computed string included. */
  private static keyOf(opts: {
    ts: TTypeScript;
    name: TS.PropertyName | undefined;
  }): string | undefined {
    const { ts, name } = opts;

    if (name === undefined) {
      return undefined;
    }

    if (ts.isComputedPropertyName(name)) {
      return ts.isStringLiteralLike(name.expression) ? name.expression.text : undefined;
    }

    return CodemodSource.nameOf({ ts, node: name });
  }

  private static membersOf(opts: {
    ts: TTypeScript;
    literal: TS.ObjectLiteralExpression;
  }): IMember[] {
    const { ts, literal } = opts;

    return literal.properties.flatMap((property) => {
      const name = NoAuthTransform.keyOf({ ts, name: property.name });

      return name !== undefined && MEMBER_OF.has(name) ? [{ property, name }] : [];
    });
  }

  /** Every literal of the file that holds a removed option or `noAuth`, and every other maker of `noAuth`. */
  private static objectsOf(opts: { ts: TTypeScript; sourceFile: TS.SourceFile }): IHolder[] {
    const { ts, sourceFile } = opts;
    const holders: IHolder[] = [];

    const visit = (node: TS.Node): void => {
      if (ts.isObjectLiteralExpression(node)) {
        const names = new Set(
          NoAuthTransform.membersOf({ ts, literal: node }).map(({ name }) => name),
        );
        const hasGroup = NoAuthTransform.hasGroup({ ts, literal: node });

        if (names.size > 0 || hasGroup) {
          holders.push({ node, names, hasGroup });
        }
      } else if (NoAuthTransform.makesGroup({ ts, node })) {
        holders.push({ node, names: new Set(), hasGroup: true });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return holders;
  }

  /**
   * Whether the node is `x.noAuth = ...`, `x['noAuth'] = ...`, a class field `noAuth` or a constructor
   * parameter property of that name.
   */
  private static makesGroup(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts, node } = opts;

    if (ts.isPropertyDeclaration(node)) {
      return NoAuthTransform.keyOf({ ts, name: node.name }) === GROUP;
    }

    if (ts.isParameter(node)) {
      return (
        ts.isParameterPropertyDeclaration(node, node.parent) &&
        ts.isIdentifier(node.name) &&
        node.name.text === GROUP
      );
    }

    if (
      !ts.isBinaryExpression(node) ||
      node.operatorToken.kind < ts.SyntaxKind.FirstAssignment ||
      node.operatorToken.kind > ts.SyntaxKind.LastAssignment
    ) {
      return false;
    }

    const { left } = node;

    if (ts.isPropertyAccessExpression(left)) {
      return left.name.text === GROUP;
    }

    return (
      ts.isElementAccessExpression(left) &&
      ts.isStringLiteralLike(left.argumentExpression) &&
      left.argumentExpression.text === GROUP
    );
  }

  private static hasGroup(opts: { ts: TTypeScript; literal: TS.ObjectLiteralExpression }): boolean {
    const { ts, literal } = opts;

    return literal.properties.some(
      (property) => NoAuthTransform.keyOf({ ts, name: property.name }) === GROUP,
    );
  }

  /** Why a literal holding a removed option cannot be rewritten; `undefined` when it can. */
  private static refusalOf(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    literal: TS.ObjectLiteralExpression;
    members: IMember[];
    isArdorFile: boolean;
    objects: IHolder[];
  }): string | undefined {
    const { ts, sourceFile, literal, members, isArdorFile, objects } = opts;
    const hasDefault = members.some(
      ({ property }) =>
        ts.isShorthandPropertyAssignment(property) &&
        property.objectAssignmentInitializer !== undefined,
    );

    if (hasDefault || NoAuthTransform.isPattern({ ts, node: literal })) {
      return PATTERN;
    }

    if (!isArdorFile) {
      return NOT_ARDOR;
    }

    if (NoAuthTransform.isTypedAsGroup({ ts, node: literal })) {
      return OLD_TYPE;
    }

    if (literal.properties.some((property) => ts.isSpreadAssignment(property))) {
      return SPREAD;
    }

    if (NoAuthTransform.isMerged({ ts, node: literal })) {
      return MERGED;
    }

    if (NoAuthTransform.hasGroup({ ts, literal })) {
      return HAS_GROUP;
    }

    const names = new Set(members.map(({ name }) => name));

    // A `noAuth` elsewhere would replace this one whole, and so would the other half of a lone option:
    // nothing shows whether the objects are merged.
    const isSplit = objects.some(
      (other) =>
        other.node !== literal &&
        (other.hasGroup || (names.size === 1 && [...other.names].some((name) => !names.has(name)))),
    );

    if (isSplit) {
      return SPLIT;
    }

    const isPlain = members.every(
      ({ property }) =>
        (ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name)) ||
        ts.isShorthandPropertyAssignment(property),
    );
    const isNested = members.some(({ property }) =>
      NoAuthTransform.holdsMember({ ts, node: property }),
    );

    if (!isPlain || isNested || names.size !== members.length) {
      return NOT_VALUE;
    }

    return members.some(({ property }, index) =>
      NoAuthTransform.hasComment({ ts, sourceFile, node: property, isRemoved: index > 0 }),
    )
      ? COMMENT
      : undefined;
  }

  /** Whether the literal is, or sits inside, the target of a destructuring. */
  private static isPattern(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts, node } = opts;
    const { parent } = node;

    if (ts.isBinaryExpression(parent)) {
      return parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
    }

    if (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) {
      return parent.initializer === node;
    }

    const isInside =
      ts.isParenthesizedExpression(parent) ||
      ts.isArrayLiteralExpression(parent) ||
      ts.isObjectLiteralExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isSpreadAssignment(parent) ||
      ts.isSpreadElement(parent);

    return isInside && NoAuthTransform.isPattern({ ts, node: parent });
  }

  /** Whether the literal feeds a spread or `Object.assign` in the expression it is written in. */
  private static isMerged(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts, node } = opts;
    const { parent } = node;

    if (ts.isSpreadAssignment(parent)) {
      return true;
    }

    const isAssigned =
      ts.isCallExpression(parent) &&
      ts.isPropertyAccessExpression(parent.expression) &&
      parent.expression.getText() === 'Object.assign';

    if (isAssigned) {
      return true;
    }

    if (ts.isStatement(parent) || ts.isFunctionLike(parent) || ts.isSourceFile(parent)) {
      return false;
    }

    return NoAuthTransform.isMerged({ ts, node: parent });
  }

  /** Whether the literal is written as an `INoAuthOptions`, which now means the group itself. */
  private static isTypedAsGroup(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts } = opts;
    let node = opts.node.parent;

    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      if (!ts.isParenthesizedExpression(node) && node.type.getText().includes('INoAuthOptions')) {
        return true;
      }

      node = node.parent;
    }

    if (ts.isReturnStatement(node)) {
      const owner = ts.findAncestor(node, ts.isFunctionLike);

      return owner?.type?.getText().includes('INoAuthOptions') ?? false;
    }

    return (
      ts.isVariableDeclaration(node) && (node.type?.getText().includes('INoAuthOptions') ?? false)
    );
  }

  /** Whether the literal goes straight to its consumer: a method result, a binding or a constructor. */
  private static isHandedOver(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts, node } = opts;
    const { parent } = node;

    if (ts.isReturnStatement(parent)) {
      const owner = ts.findAncestor(parent, ts.isFunctionLike);

      return owner !== undefined && ts.isMethodDeclaration(owner);
    }

    if (ts.isNewExpression(parent)) {
      return DIRECT_CALLEES.has(parent.expression.getText());
    }

    return (
      ts.isCallExpression(parent) &&
      (parent.expression.kind === ts.SyntaxKind.SuperKeyword ||
        (ts.isPropertyAccessExpression(parent.expression) &&
          parent.expression.name.text === 'toValue'))
    );
  }

  /** Whether a literal inside this property holds a removed option too. */
  private static holdsMember(opts: { ts: TTypeScript; node: TS.Node }): boolean {
    const { ts, node } = opts;

    return (
      ts.forEachChild(node, (child) =>
        (ts.isObjectLiteralExpression(child) &&
          NoAuthTransform.membersOf({ ts, literal: child }).length > 0) ||
        NoAuthTransform.holdsMember({ ts, node: child })
          ? true
          : undefined,
      ) ?? false
    );
  }

  /**
   * A comment inside the property or between it and its comma, and for a property that goes away one
   * above it or after its comma: an edit would drop it or leave it on another property.
   */
  private static hasComment(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    node: TS.Node;
    /** The edit deletes this property. */
    isRemoved: boolean;
  }): boolean {
    const { ts, sourceFile, node, isRemoved } = opts;
    const { text } = sourceFile;
    const inside = (child: TS.Node): boolean =>
      (child.pos !== node.pos && ts.getLeadingCommentRanges(text, child.pos) !== undefined) ||
      ts.getTrailingCommentRanges(text, child.end) !== undefined ||
      child.getChildren(sourceFile).some(inside);

    // TypeScript reads a block comment between a comma and a property of the same line as trailing.
    const isBeside = (ts.getTrailingCommentRanges(text, node.pos) ?? []).some(
      (range) =>
        range.kind === ts.SyntaxKind.MultiLineCommentTrivia &&
        !text.slice(range.end, node.getStart(sourceFile)).includes('\n'),
    );
    const isAround =
      isRemoved &&
      (isBeside ||
        ts.getLeadingCommentRanges(text, node.pos) !== undefined ||
        /^[ \t]*,?[ \t]*\/[/*]/.test(text.slice(node.end)));

    return isAround || inside(node);
  }

  /** The first removed option becomes the group, and the second one goes with its comma. */
  private static editsOf(opts: {
    ts: TTypeScript;
    sourceFile: TS.SourceFile;
    literal: TS.ObjectLiteralExpression;
    members: Array<{ property: TS.ObjectLiteralElementLike; name: string }>;
  }): ISourceEdit[] {
    const { ts, sourceFile, literal, members } = opts;
    const { text } = sourceFile;
    // In the order they are written, so their values are still evaluated in that order.
    const entries = members.flatMap(({ property, name }) => {
      const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
      const member = MEMBER_OF.get(name);

      return value === undefined ? [] : [`${member}: ${value.getText(sourceFile)}`];
    });
    const [first, second] = members.map(({ property }) => property);

    if (first === undefined) {
      return [];
    }

    const edits: ISourceEdit[] = [
      {
        start: first.getStart(sourceFile),
        end: first.getEnd(),
        text: `${GROUP}: { ${entries.join(', ')} }`,
      },
    ];

    if (second === undefined) {
      return edits;
    }

    let start = second.getStart(sourceFile);
    let end = second.getEnd();
    const comma = /^[ \t]*,/.exec(text.slice(end))?.[0];

    if (comma !== undefined) {
      end += comma.length;
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const rest = /^[ \t]*\n/.exec(text.slice(end))?.[0];

      // A property alone on its line takes the line with it; one inside a line takes its leading space.
      if (rest !== undefined && /^[ \t]*$/.test(text.slice(lineStart, start))) {
        start = lineStart;
        end += rest.length;
      } else {
        end += /^[ \t]*/.exec(text.slice(end))?.[0].length ?? 0;
      }
    } else {
      const previous = literal.properties[literal.properties.indexOf(second) - 1];

      if (previous !== undefined && /^\s*,\s*$/.test(text.slice(previous.getEnd(), start))) {
        start = previous.getEnd();
      }
    }

    return [...edits, { start, end, text: '' }];
  }

  /** A use of a removed option that is not a property of a literal. */
  private static readOf(opts: {
    ts: TTypeScript;
    node: TS.Node;
  }): { name: string; reason: string } | undefined {
    const { ts, node } = opts;

    const found = (name: string | undefined, reason?: string) => {
      const member = name === undefined ? undefined : MEMBER_OF.get(name);

      return name === undefined || member === undefined
        ? undefined
        : { name, reason: reason ?? `use options.${GROUP}?.${member}` };
    };

    if (ts.isPropertyAccessExpression(node)) {
      // `this.noAuthPaths` is the protected member of the network service, which keeps its name.
      const isMember =
        node.expression.kind === ts.SyntaxKind.ThisKeyword && node.name.text === 'noAuthPaths';

      return isMember ? undefined : found(node.name.text);
    }

    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      return found(node.argumentExpression.text);
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
      ts.isStringLiteralLike(node.left)
    ) {
      return found(node.left.text);
    }

    if (ts.isBindingElement(node)) {
      const name = node.propertyName ?? node.name;

      return ts.isIdentifier(name) ? found(name.text, PATTERN) : undefined;
    }

    if (ts.isLiteralTypeNode(node) && ts.isStringLiteralLike(node.literal)) {
      return found(node.literal.text, TYPE_MEMBER);
    }

    if (ts.isPropertySignature(node)) {
      return found(NoAuthTransform.keyOf({ ts, name: node.name }), TYPE_MEMBER);
    }

    if (ts.isPropertyDeclaration(node)) {
      const name = NoAuthTransform.keyOf({ ts, name: node.name });
      const isOptions =
        name !== 'noAuthPaths' ||
        (node.parent.heritageClauses?.some(
          (clause) => clause.token === ts.SyntaxKind.ImplementsKeyword,
        ) ??
          false);

      return isOptions ? found(name, TYPE_MEMBER) : undefined;
    }

    return undefined;
  }
}
