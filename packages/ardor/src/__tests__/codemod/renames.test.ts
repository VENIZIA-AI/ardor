import { describe, expect, test } from 'bun:test';

import * as umbrella from '@/index';
import { Ardor } from '@/index';
import { FunctionRenames, HookRenames, LoggerRenames } from '@/codemod/renames';

const exported: Record<string, unknown> = umbrella;

// The codemod is the only upgrade path for a removed name: these tests keep its tables true to the
// packages, so a name removed or renamed without a table row (or the reverse) fails here.
describe('the codemod tables match the packages', () => {
  test('every function the codemod moves is gone, and its class member exists', () => {
    for (const [name, target] of Object.entries(FunctionRenames.TARGETS)) {
      expect(exported[name], `${name} is still exported`).toBeUndefined();

      const owner = exported[target.owner] as Record<string, unknown> | undefined;

      expect(typeof owner?.[target.member], `${target.owner}.${target.member}`).toBe('function');
    }
  });

  test('the hooks the codemod moves are exactly the hooks Ardor holds', () => {
    expect([...HookRenames.NAMES].sort()).toEqual(Object.keys(Ardor).sort());
  });

  test('the removed constants are gone from their classes', () => {
    const app = exported.App as Record<string, unknown>;
    const headers = exported.HeaderConstants as Record<string, unknown>;

    expect(app.DEFAULT_LOCALE).toBeUndefined();
    expect(headers.REQUEST_DEVICE_INFO).toBeUndefined();
    expect(headers.RESPONSE_FORMAT).toBeUndefined();
    expect(exported.isEditableTarget).toBeUndefined();
    expect(exported.useSizer).toBeUndefined();
    expect(exported.useInjectableContainer).toBeUndefined();
    expect(exported.ISendResponse).toBeUndefined();
  });
});

describe('the logger names the codemod moves are gone', () => {
  test('Logger and the names that moved to ignis core are no longer exported', () => {
    expect(exported.Logger).toBeUndefined();

    for (const name of LoggerRenames.MOVED) {
      expect(exported[name], `${name} is still exported`).toBeUndefined();
    }
  });
});
