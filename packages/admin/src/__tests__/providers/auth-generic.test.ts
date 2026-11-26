import { describe, expect, test } from 'bun:test';

import type { IDataProvider } from '@/common';
import { type DefaultAuthProvider } from '@/providers/auth';

describe('DefaultAuthProvider', () => {
  test('takes no resource type, and a data provider of any resource', () => {
    // @ts-expect-error - the class has no type argument: the paths it posts to are plain strings
    const typed: DefaultAuthProvider<'posts'> | undefined = undefined;

    const accept = (provider: IDataProvider) => {
      const given: ConstructorParameters<typeof DefaultAuthProvider>[0] = provider;

      return given;
    };

    expect(typed).toBeUndefined();
    expect(accept).toBeFunction();
  });
});
