import 'reflect-metadata';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  BaseArdorApplication,
  CoreBindings,
  RUNTIME_CONFIG_GLOBAL,
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

const restUrlOf = async (): Promise<unknown> => {
  const application = new TestApplication();

  await application.start();

  return application.get<{ url: string }>({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).url;
};

describe('AdminConfiguration', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, RUNTIME_CONFIG_GLOBAL);
  });

  test('binds the REST data provider options under their key', async () => {
    expect(await restUrlOf()).toBe('/api');
  });

  test('the API url is the one config.js wrote when the container started', async () => {
    Reflect.set(globalThis, RUNTIME_CONFIG_GLOBAL, { VITE_API_URL: 'https://api.example.com' });

    expect(await restUrlOf()).toBe('https://api.example.com');
  });
});
