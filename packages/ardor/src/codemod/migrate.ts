import { LoggerTransform } from './logger';
import { type IFinding, NamespaceTransform, type TTypeScript } from './transform';

export interface IMigrationResult {
  text: string;
  /** Uses rewritten, across both passes. */
  renamed: number;
  /** What was left, and the notes about what was changed on purpose. */
  findings: IFinding[];
}

/**
 * Every pass of `ardor codemod namespace` over one file: the renames to class members and plain
 * types, then the move off the kernel logger. The second pass reads the first one's output, but a
 * finding must point at the line of the file as it is on disk, so the findings of each pass come
 * from the original text and only the text comes from the chain.
 */
export class Migration {
  static run(opts: {
    ts: TTypeScript;
    fileName: string;
    text: string;
    hooks: boolean;
  }): IMigrationResult {
    const { ts, fileName, text, hooks } = opts;
    const names = NamespaceTransform.run({ ts, fileName, text, hooks });
    const loggerOnOriginal = LoggerTransform.run({ ts, fileName, text });
    const logger = LoggerTransform.run({ ts, fileName, text: names.text });

    return {
      text: logger.text,
      renamed: names.renamed + logger.renamed,
      findings: [...names.findings, ...loggerOnOriginal.findings],
    };
  }
}
