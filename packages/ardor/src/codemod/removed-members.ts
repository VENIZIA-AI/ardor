import type * as TS from 'typescript';

import { RemovedNames } from './renames';
import { CodemodSource } from './source';
import type { IFinding, TTypeScript } from './transform';

/** The uses of a member an ARDOR class no longer has, which the codemod lists and leaves alone. */
export class RemovedMembers {
  /** `App.DEFAULT_LOCALE`: listed, there is nothing to write instead. */
  static find(opts: { ts: TTypeScript; sourceFile: TS.SourceFile; findings: IFinding[] }): void {
    const { ts, sourceFile, findings } = opts;
    const owners = new Map<string, string>();

    for (const { local, imported } of CodemodSource.ardorImports({ ts, sourceFile })) {
      owners.set(local, imported);
    }

    if (owners.size === 0) {
      return;
    }

    const imported = new Set(owners.values());

    const visit = (node: TS.Node): void => {
      let name: TS.Node | undefined;

      if (
        ts.isPropertyAccessExpression(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node)
      ) {
        name = node.name;
      } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
        name = node.propertyName ?? node.name;
      } else if (
        ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        name = node.argumentExpression;
      }

      const key = name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name : undefined;
      const property =
        key && Object.hasOwn(RemovedNames.PROPERTIES, key.text)
          ? RemovedNames.PROPERTIES[key.text]
          : undefined;

      if (key && property && [...property.owners].some((owner) => imported.has(owner))) {
        findings.push({
          line: CodemodSource.lineOf({ sourceFile, node: key }),
          name: `.${key.text}`,
          reason: `removed: ${property.reason}`,
        });
      }

      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const owner = owners.get(node.expression.text);
        const reason = owner
          ? RemovedNames.findMember({ owner, member: node.name.text })
          : undefined;

        if (reason) {
          findings.push({
            line: CodemodSource.lineOf({ sourceFile, node }),
            name: `${node.expression.text}.${node.name.text}`,
            reason: `removed: ${reason}`,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }
}
