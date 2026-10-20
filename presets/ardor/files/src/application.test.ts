import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import {
  BaseArdorApplication,
  CoreBindings,
  type IApplicationInfo,
  type IArtifactIndex,
} from '@venizia/ardor';

import { AdminConfiguration } from '#src/configurations/admin.configuration';

// The class list is given by hand: the one `application.ts` uses is built by Vite, not by Bun.
class TestApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'test', version: '0.0.0', description: 'A test of the container' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [{ configurations: [AdminConfiguration] }];
  }

  bindContext(): void {}
}

describe('AdminConfiguration', () => {
  test('binds the REST data provider options under their key', async () => {
    const application = new TestApplication();

    await application.start();

    expect(application.get({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })).toMatchObject({
      url: '/api',
    });
  });
});
