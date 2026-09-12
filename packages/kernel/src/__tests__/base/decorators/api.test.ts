import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { getError } from '@venizia/ignis-inversion';
import { api } from '@/base/decorators/api';
import { BaseApiService } from '@/base/services/api';

interface ITestFetchPayload {
  id: string;
}

interface ITestFetchResult {
  id: string;
  name: string;
}

interface ITestFailingPayload {
  error: Error;
}

class TestApiService extends BaseApiService {
  constructor(opts: { scope: string; resource: string }) {
    super({ scope: opts.scope, resource: opts.resource });
  }

  @api()
  async fetchData(opts: ITestFetchPayload): Promise<ITestFetchResult> {
    return {
      id: opts.id,
      name: `item-${opts.id}`,
    };
  }

  @api()
  async failingMethod(opts: ITestFailingPayload): Promise<never> {
    throw opts.error;
  }
}

describe('api decorator', () => {
  let activeSpy: { mockRestore: () => void } | null = null;

  afterEach(() => {
    if (activeSpy) {
      activeSpy.mockRestore();
      activeSpy = null;
    }
  });

  test('returns the awaited result of the original method', async () => {
    const service = new TestApiService({
      scope: 'test-scope',
      resource: 'items',
    });
    const logger = service['logger'];
    const errorSpy = spyOn(logger, 'error').mockImplementation(() => {});
    activeSpy = errorSpy;

    const result = await service.fetchData({ id: 'item-1' });

    expect(result).toEqual({
      id: 'item-1',
      name: 'item-item-1',
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('rethrows the error unchanged and calls logger error once with method name and resource when original method throws', async () => {
    const service = new TestApiService({
      scope: 'test-scope',
      resource: 'items',
    });
    const logger = service['logger'];
    const errorSpy = spyOn(logger, 'error').mockImplementation(() => {});
    activeSpy = errorSpy;
    const expectedError = getError({ message: 'ARDOR service failure' });

    expect(service.failingMethod({ error: expectedError })).rejects.toBe(expectedError);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[%s] resource: %s | error: %o',
      'failingMethod',
      'items',
      expectedError,
    );
  });
});
