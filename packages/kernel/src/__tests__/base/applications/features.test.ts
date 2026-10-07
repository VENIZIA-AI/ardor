import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { BaseArdorApplication } from '@/base/applications/abstract';
import { configuration, provide } from '@/base/metadata';
import { CoreBindings, type IApplicationInfo, type IFeatureBase } from '@/common';

@configuration()
class InventoryConfiguration {
  @provide({ key: 'test.features.inventory' })
  inventory() {
    return 'from the inventory feature';
  }
}

// Never decorated: a feature that lists it has lost its bindings.
class ForgottenConfiguration {}

const inventory: IFeatureBase = {
  name: 'inventory',
  configurations: [InventoryConfiguration],
  permissions: ['stock.read'],
};

const createApplication = (opts: { features: Array<IFeatureBase> }) => {
  class FeatureApplication extends BaseArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'features', version: '1.0.0', description: 'feature modules' };
    }

    override features(): Array<IFeatureBase> {
      return opts.features;
    }

    bindContext(): void {}
  }

  return new FeatureApplication();
};

describe('AbstractArdorApplication.features', () => {
  test('binds the features under CoreBindings.FEATURES, in order', async () => {
    const commerce: IFeatureBase = { name: 'commerce' };
    const application = createApplication({ features: [inventory, commerce] });
    await application.start();

    expect(application.get<Array<IFeatureBase>>({ key: CoreBindings.FEATURES })).toEqual([
      inventory,
      commerce,
    ]);
  });

  test('binds an empty list when the application mounts none', async () => {
    const application = createApplication({ features: [] });
    await application.start();

    expect(application.get<Array<IFeatureBase>>({ key: CoreBindings.FEATURES })).toEqual([]);
  });

  test("binds what a feature's configuration provides", async () => {
    const application = createApplication({ features: [inventory] });
    await application.start();

    expect(application.get<string>({ key: 'test.features.inventory' })).toBe(
      'from the inventory feature',
    );
  });

  test('throws on two features with one name', async () => {
    const application = createApplication({ features: [inventory, { name: 'inventory' }] });

    await expect(application.start()).rejects.toThrow(
      /\[features\] Two features are named 'inventory'/,
    );
  });

  test('throws when a feature lists a configuration that was never discovered', async () => {
    const application = createApplication({
      features: [{ name: 'billing', configurations: [ForgottenConfiguration] }],
    });

    await expect(application.start()).rejects.toThrow(
      /\[features\] 'billing' lists ForgottenConfiguration, which was never discovered/,
    );
  });

  test('bindContext still overrides what a feature provides', async () => {
    class OverridingApplication extends BaseArdorApplication {
      getAppInfo(): IApplicationInfo {
        return { name: 'features', version: '1.0.0', description: 'feature modules' };
      }

      override features(): Array<IFeatureBase> {
        return [inventory];
      }

      bindContext(): void {
        this.bind({ key: 'test.features.inventory' }).toValue('from bindContext');
      }
    }

    const application = new OverridingApplication();
    await application.start();

    expect(application.get<string>({ key: 'test.features.inventory' })).toBe('from bindContext');
  });
});
