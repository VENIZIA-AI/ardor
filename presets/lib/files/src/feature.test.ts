import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';
import {
  BaseArdorApplication,
  Features,
  type IApplicationInfo,
  type IFeatureBase,
} from '@venizia/ardor';

import { feature } from '#src/feature';

class ProbeApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'probe', version: '0.0.0', description: 'mounts the {{lib}} feature' };
  }

  override features(): Array<IFeatureBase> {
    return [feature];
  }

  bindContext(): void {}
}

describe('the {{lib}} feature', () => {
  test('is named {{lib}}', () => {
    expect(feature.name).toBe('{{lib}}');
  });

  test('an application that lists it starts and reads it back from the container', async () => {
    const application = new ProbeApplication();

    await application.start();

    expect(Features.read({ container: application })).toEqual([feature]);
  });
});
