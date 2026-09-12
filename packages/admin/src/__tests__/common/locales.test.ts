import { describe, expect, test } from 'bun:test';
import type { TranslationMessages } from 'ra-core';
import { englishMessages, vietnameseMessages } from '@/common/locales';

interface IIsRecordCandidateOptions {
  readonly candidate: unknown;
}

const isRecord = (
  options: IIsRecordCandidateOptions,
): options is { readonly candidate: Record<string, unknown> } => {
  return (
    typeof options.candidate === 'object' &&
    options.candidate !== null &&
    !Array.isArray(options.candidate)
  );
};

interface ICollectDottedKeysOptions {
  readonly target: Record<string, unknown>;
  readonly prefix?: string;
}

const collectDottedKeys = ({
  target,
  prefix = '',
}: ICollectDottedKeysOptions): readonly string[] => {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(target)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    const recordCheck = { candidate: value };
    if (isRecord(recordCheck)) {
      keys.push(
        ...collectDottedKeys({
          target: recordCheck.candidate,
          prefix: path,
        }),
      );
    } else {
      keys.push(path);
    }
  }
  return keys;
};

interface IComputeSymmetricDifferenceOptions {
  readonly leftKeys: ReadonlySet<string>;
  readonly rightKeys: ReadonlySet<string>;
  readonly leftName: string;
  readonly rightName: string;
}

const computeSymmetricDifference = ({
  leftKeys,
  rightKeys,
  leftName,
  rightName,
}: IComputeSymmetricDifferenceOptions): readonly string[] => {
  const missingInRight = [...leftKeys]
    .filter((key) => !rightKeys.has(key))
    .map((key) => `Missing in ${rightName}: ${key}`);
  const missingInLeft = [...rightKeys]
    .filter((key) => !leftKeys.has(key))
    .map((key) => `Missing in ${leftName}: ${key}`);
  return [...missingInRight, ...missingInLeft];
};

interface ICollectEmptyLeafPathsOptions {
  readonly target: Record<string, unknown>;
  readonly prefix?: string;
}

const collectEmptyLeafPaths = ({
  target,
  prefix = '',
}: ICollectEmptyLeafPathsOptions): readonly string[] => {
  const emptyPaths: string[] = [];
  for (const [key, value] of Object.entries(target)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    const recordCheck = { candidate: value };
    if (isRecord(recordCheck)) {
      emptyPaths.push(
        ...collectEmptyLeafPaths({
          target: recordCheck.candidate,
          prefix: path,
        }),
      );
    } else if (typeof value === 'string' && value.trim().length === 0) {
      emptyPaths.push(path);
    }
  }
  return emptyPaths;
};

describe('locale key path symmetry', () => {
  test('englishMessages and vietnameseMessages have identical sets of dotted key paths', () => {
    const englishKeySet = new Set(collectDottedKeys({ target: englishMessages }));
    const vietnameseKeySet = new Set(collectDottedKeys({ target: vietnameseMessages }));
    const symmetricDifference = computeSymmetricDifference({
      leftKeys: englishKeySet,
      rightKeys: vietnameseKeySet,
      leftName: 'englishMessages',
      rightName: 'vietnameseMessages',
    });
    expect(symmetricDifference).toEqual([]);
  });
});

describe('locale type contract', () => {
  test('englishMessages satisfies TranslationMessages at the type level', () => {
    const checked = englishMessages satisfies TranslationMessages;
    expect(checked).toBeDefined();
  });

  test('vietnameseMessages satisfies TranslationMessages at the type level', () => {
    const checked = vietnameseMessages satisfies TranslationMessages;
    expect(checked).toBeDefined();
  });
});

describe('locale leaf value validity', () => {
  // `ra.boolean.null` is react-admin's own blank label for a null boolean; every other leaf has text.
  test('the only blank leaf in englishMessages is ra.boolean.null', () => {
    const emptyPaths = collectEmptyLeafPaths({ target: englishMessages });
    expect(emptyPaths).toEqual(['ra.boolean.null']);
  });

  test('the only blank leaf in vietnameseMessages is ra.boolean.null', () => {
    const emptyPaths = collectEmptyLeafPaths({ target: vietnameseMessages });
    expect(emptyPaths).toEqual(['ra.boolean.null']);
  });
});
