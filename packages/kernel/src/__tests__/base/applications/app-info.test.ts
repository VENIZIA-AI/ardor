import { describe, expect, test } from 'bun:test';
import { RejectionHelper } from '@venizia/dev-configs/testing';

import { CoreBindings, type IApplicationInfo, type ValueOrPromise } from '@/common';
import { TestArdorApplication } from './test-application';

class InfoApplication extends TestArdorApplication {
  constructor(private readonly info: () => ValueOrPromise<IApplicationInfo>) {
    super();
  }

  getAppInfo(): ValueOrPromise<IApplicationInfo> {
    return this.info();
  }

  bindContext(): void {}
}

const valid: IApplicationInfo = { name: 'shop', version: '1.0.0', description: 'The shop' };

describe('start(), the application info', () => {
  test('rejects an empty name, an empty version and an invalid id', async () => {
    const application = new InfoApplication(() => ({
      name: '',
      version: '',
      description: '',
      id: 'a b/../x',
    }));

    await RejectionHelper.expectRejection({ task: application.start(), message: 'name' });
  });

  test('rejects an empty name', async () => {
    const application = new InfoApplication(() => ({ ...valid, name: '' }));

    await RejectionHelper.expectRejection({
      task: application.start(),
      message: '[appInfo] IApplicationInfo.name must be a non-empty string',
    });
  });

  test('rejects a name that is only spaces', async () => {
    const application = new InfoApplication(() => ({ ...valid, name: '   ' }));

    await RejectionHelper.expectRejection({ task: application.start(), message: 'name' });
  });

  test('rejects a version that is not a string', async () => {
    const application = new InfoApplication(() => ({
      ...valid,
      version: JSON.parse('1'),
    }));

    await RejectionHelper.expectRejection({
      task: application.start(),
      message: '[appInfo] IApplicationInfo.version must be a string',
    });
  });

  test.each(['a b/../x', '..', '', 'a/b'])('rejects the id %p', async (id) => {
    const application = new InfoApplication(() => ({ ...valid, id }));

    await RejectionHelper.expectRejection({
      task: application.start(),
      message: 'IApplicationInfo.id',
    });
  });

  test('rejects when getAppInfo resolves to an invalid value', async () => {
    const application = new InfoApplication(async () => ({ ...valid, name: '' }));

    await RejectionHelper.expectRejection({ task: application.start(), message: 'name' });
  });

  test('rejects a value that is not an object', async () => {
    const application = new InfoApplication(() => JSON.parse('null'));

    await RejectionHelper.expectRejection({ task: application.start(), message: 'object' });
  });

  test('binds nothing when the info is refused', async () => {
    const application = new InfoApplication(() => ({ ...valid, name: '' }));

    await RejectionHelper.rejectionOf({ task: application.start() });

    expect(application.isBound({ key: CoreBindings.APPLICATION_INFO })).toBe(false);
  });

  test('accepts a valid info, with or without an id', async () => {
    const plain = new InfoApplication(() => valid);
    const scoped = new InfoApplication(() => ({ ...valid, id: 'shop.v2_a-b' }));

    await plain.start();
    await scoped.start();

    expect(plain.get<IApplicationInfo>({ key: CoreBindings.APPLICATION_INFO })).toEqual(valid);
    expect(scoped.get<IApplicationInfo>({ key: CoreBindings.APPLICATION_INFO }).id).toBe(
      'shop.v2_a-b',
    );
  });
});
