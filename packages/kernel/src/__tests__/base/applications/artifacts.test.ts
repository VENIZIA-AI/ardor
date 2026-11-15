import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { TestArdorApplication } from './test-application';
import {
  component,
  configuration,
  MetadataRegistry,
  provide,
  service,
} from '@venizia/ignis-kernel/metadata';
import { BindingScopes } from '@venizia/ignis-inversion';
import type { IApplicationInfo } from '@/common';
import { RejectionHelper } from '@venizia/dev-configs/testing';

class TestApplication extends TestArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'artifact-test', version: '1.0.0', description: 'stereotype registration' };
  }

  bindContext(): void {}
}

@service()
class DiscoveredService {
  greet(): string {
    return 'from the stereotype';
  }
}

@component()
class DiscoveredComponent {}

class UndecoratedService {}

let providedBuilds = 0;

@configuration()
class ProvidingConfiguration {
  @provide({ key: 'test.provided.shared' })
  shared() {
    providedBuilds++;

    return { build: providedBuilds };
  }

  @provide({ key: 'test.provided.fresh', scope: BindingScopes.TRANSIENT })
  fresh() {
    return { at: Symbol('fresh') };
  }
}

describe('AbstractArdorApplication.registerArtifacts', () => {
  let application: TestApplication;

  beforeEach(async () => {
    application = new TestApplication();
    await application.start();
  });

  test('binds a stereotyped class the application never listed', () => {
    const resolved = application.get<DiscoveredService>({ key: 'services.DiscoveredService' });

    expect(resolved).toBeInstanceOf(DiscoveredService);
    expect(resolved.greet()).toBe('from the stereotype');
  });

  test('keys the binding by namespace, so a component and a service do not collide', () => {
    expect(
      application.get<DiscoveredComponent>({ key: 'components.DiscoveredComponent' }),
    ).toBeInstanceOf(DiscoveredComponent);
  });

  test('resolves by class, which is what survives a minifier', () => {
    const key = application.getMetadataRegistry().getBindingKey({ target: DiscoveredService });

    expect(key).toBe('services.DiscoveredService');
  });

  /**
   * The positive control. Every assertion above would also pass if `registerArtifacts` bound every
   * class it could reach, so one class that must NOT be bound proves the discovery list is what
   * decides - not the loop.
   */
  test('leaves an undecorated class unbound and unkeyed', () => {
    expect(
      application.getMetadataRegistry().getBindingKey({ target: UndecoratedService }),
    ).toBeUndefined();

    expect(() => application.get({ key: 'services.UndecoratedService' })).toThrow();
  });

  /**
   * Precedence. A stereotype is what a class declares; `bindingList()` is what the APPLICATION
   * decided, by hand, for this build. The explicit one has to win, or an override is ignored with
   * nothing to show it was.
   */
  test('bindingList overrides a stereotype on the same key', async () => {
    class Replacement {
      readonly tag = 'from-bindingList';
    }

    class OverridingApplication extends TestApplication {
      override bindingList() {
        return { 'services.DiscoveredService': Replacement };
      }
    }

    const app = new OverridingApplication();
    await app.start();

    expect(app.get({ key: 'services.DiscoveredService' })).toBeInstanceOf(Replacement);
  });

  test('binds as a singleton, so two resolves are one instance', () => {
    const first = application.get<DiscoveredService>({ key: 'services.DiscoveredService' });
    const second = application.get<DiscoveredService>({ key: 'services.DiscoveredService' });

    expect(first).toBe(second);
  });

  test('the discovery list is what the application reads', () => {
    const discovered = MetadataRegistry.getInstance().getDiscoveredArtifacts();

    expect(discovered).toContain(DiscoveredService);
    expect(discovered).toContain(DiscoveredComponent);
    expect(discovered).not.toContain(UndecoratedService);
  });

  // A transient data provider hands react-admin, the auth provider and each hook their own network
  // service, so a header or token set on one never reaches the others.
  test('binds a @provide method under its key, built once and shared', () => {
    const before = providedBuilds;
    const first = application.get<{ build: number }>({ key: 'test.provided.shared' });

    expect(application.get<{ build: number }>({ key: 'test.provided.shared' })).toBe(first);
    expect(providedBuilds - before).toBe(1);
  });

  test('a @provide scope is the method author to choose', () => {
    expect(MetadataRegistry.getInstance().getDiscoveredArtifacts()).toContain(
      ProvidingConfiguration,
    );
    expect(application.get({ key: 'test.provided.fresh' })).not.toBe(
      application.get({ key: 'test.provided.fresh' }),
    );
  });

  test('bindContext overrides a provided key', async () => {
    class OverridingApplication extends TestApplication {
      override bindContext(): void {
        this.bind({ key: 'test.provided.shared' }).toValue('from bindContext');
      }
    }
    const overriding = new OverridingApplication();
    await overriding.start();

    expect(overriding.get<string>({ key: 'test.provided.shared' })).toBe('from bindContext');
  });
});

// A minified build gives classes in different chunks one short name: both derive `services.e`, and
// the second silently replaced the first. The discovery list is process-wide, so each test puts it
// back for the files that run after.
describe('AbstractArdorApplication.registerArtifacts, derived key collisions', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReturnType<typeof registry.getDiscoveredArtifacts> = [];

  beforeEach(() => {
    discovered = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    registry.clearDiscoveredArtifacts();

    for (const target of discovered) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  // Two different classes named alike, as a minifier leaves them.
  const declareMinified = (opts: { binding?: { namespace: string; key: string } }) => {
    @service(opts.binding ? { binding: opts.binding } : {})
    class Minified {}

    return Minified;
  };

  test('throws when two different classes derive one key, naming the key and the fix', async () => {
    declareMinified({});
    declareMinified({});

    const result = await RejectionHelper.rejectionOf({ task: new TestApplication().start() });
    expect(result).toMatchObject({
      message: expect.stringMatching(
        /\[registerArtifacts\] Two classes derive the binding key 'services\.Minified'.*pin 'binding/,
      ),
    });
  });

  test('accepts two classes named alike when each pins its key', async () => {
    const first = declareMinified({ binding: { namespace: 'services', key: 'First' } });
    const second = declareMinified({ binding: { namespace: 'services', key: 'Second' } });

    const application = new TestApplication();
    await application.start();

    expect(application.get({ key: 'services.First' })).toBeInstanceOf(first);
    expect(application.get({ key: 'services.Second' })).toBeInstanceOf(second);
  });
});

// The discovery list is process-wide: each test puts it back for the files that run after.
describe('AbstractArdorApplication.registerArtifacts, the when condition', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReturnType<typeof registry.getDiscoveredArtifacts> = [];

  beforeEach(() => {
    discovered = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    registry.clearDiscoveredArtifacts();

    for (const target of discovered) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  test('does not bind a class whose when returns false', async () => {
    @service({ when: () => false })
    class DevOnlyMock {}

    const application = new TestApplication();
    await application.start();

    expect(application.isBound({ key: 'services.DevOnlyMock' })).toBe(false);
    expect(() => application.get({ key: 'services.DevOnlyMock' })).toThrow();
    expect(MetadataRegistry.getInstance().getDiscoveredArtifacts()).toContain(DevOnlyMock);
  });

  test('binds a class whose when returns true, and calls when once with the application', async () => {
    const calls: Array<unknown> = [];

    @service({
      when: (opts) => {
        calls.push(opts.application);

        return true;
      },
    })
    class SelectedService {}

    const application = new TestApplication();
    await application.start();

    expect(application.get({ key: 'services.SelectedService' })).toBeInstanceOf(SelectedService);
    expect(calls).toEqual([application]);
  });

  test('applies to the component and configuration stereotypes too', async () => {
    @component({ when: () => false })
    class SkippedComponent {}

    @configuration({ when: () => false })
    class SkippedConfiguration {}

    const application = new TestApplication();
    await application.start();

    expect(application.isBound({ key: 'components.SkippedComponent' })).toBe(false);
    expect(application.isBound({ key: 'configurations.SkippedConfiguration' })).toBe(false);
    expect(registry.getDiscoveredArtifacts()).toEqual(
      expect.arrayContaining([SkippedComponent, SkippedConfiguration]),
    );
  });

  test('skips the @provide methods of a class whose when returns false', async () => {
    @configuration({ when: () => false })
    class SkippedProviders {
      @provide({ key: 'test.when.skipped' })
      value() {
        return 'never';
      }
    }

    const application = new TestApplication();
    await application.start();

    expect(application.isBound({ key: 'test.when.skipped' })).toBe(false);
    expect(registry.getProvideMetadata({ target: SkippedProviders })).toHaveLength(1);
  });

  test('a class a when left out does not take part in the derived key collision check', async () => {
    const declare = (opts: { selected: boolean }) => {
      @service({ when: () => opts.selected })
      class Twin {}

      return Twin;
    };

    declare({ selected: true });
    declare({ selected: false });

    const application = new TestApplication();
    await application.start();

    expect(application.isBound({ key: 'services.Twin' })).toBe(true);
  });

  test('a class a when left out is still discovered, so an index that lists it passes', async () => {
    @service({ when: () => false })
    class ListedButSkipped {}

    class IndexedApplication extends TestApplication {
      override artifacts() {
        return [{ services: [ListedButSkipped] }];
      }
    }

    const application = new IndexedApplication();
    await application.start();

    expect(application.isBound({ key: 'services.ListedButSkipped' })).toBe(false);
  });

  test('a when that throws fails start and names the class', async () => {
    @service({
      when: () => {
        throw new Error('flag store is down');
      },
    })
    class FlaggedService {}

    const result = await RejectionHelper.rejectionOf({ task: new TestApplication().start() });

    expect(result).toMatchObject({
      message: expect.stringMatching(/FlaggedService.*flag store is down/),
    });
    expect(registry.getDiscoveredArtifacts()).toContain(FlaggedService);
  });

  test('a when that returns a promise fails start and names the class', async () => {
    @service({ when: async () => false })
    class AsyncFlaggedService {}

    const result = await RejectionHelper.rejectionOf({ task: new TestApplication().start() });

    expect(result).toMatchObject({
      message: expect.stringMatching(/AsyncFlaggedService.*synchronous/),
    });
    expect(registry.getDiscoveredArtifacts()).toContain(AsyncFlaggedService);
  });

  test('a by-hand registration binds the class whatever its when says', async () => {
    @service({ when: () => false })
    class HandBound {}

    const application = new TestApplication();
    application.service(HandBound);
    await application.start();

    expect(application.get({ key: 'services.HandBound' })).toBeInstanceOf(HandBound);
  });
});

describe('AbstractArdorApplication.registerArtifacts, duplicate explicit keys', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReturnType<typeof registry.getDiscoveredArtifacts> = [];

  beforeEach(() => {
    discovered = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    registry.clearDiscoveredArtifacts();

    for (const target of discovered) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  const authKey = { namespace: 'services', key: 'auth' };

  test('throws when two different classes pin one key, naming both classes and the key', async () => {
    @service({ binding: authKey })
    class RealAuth {}

    @service({ binding: authKey })
    class MockAuth {}

    const result = await RejectionHelper.rejectionOf({ task: new TestApplication().start() });

    expect(result).toMatchObject({
      message: expect.stringMatching(/'services\.auth'.*RealAuth.*MockAuth/),
    });
    expect(registry.getDiscoveredArtifacts()).toEqual(expect.arrayContaining([RealAuth, MockAuth]));
  });

  test('throws when a pinned key equals the key another class derives', async () => {
    @service()
    class Billing {}

    @service({ binding: { namespace: 'services', key: 'Billing' } })
    class PinnedBilling {}

    const result = await RejectionHelper.rejectionOf({ task: new TestApplication().start() });

    expect(result).toMatchObject({
      message: expect.stringMatching(/'services\.Billing'.*Billing.*PinnedBilling/),
    });
    expect(registry.getDiscoveredArtifacts()).toEqual(
      expect.arrayContaining([Billing, PinnedBilling]),
    );
  });

  test('accepts the pair when a when selects one of them', async () => {
    @service({ binding: authKey, when: () => false })
    class MockAuth {}

    @service({ binding: authKey })
    class RealAuth {}

    const application = new TestApplication();
    await application.start();

    expect(application.get({ key: 'services.auth' })).toBeInstanceOf(RealAuth);
    expect(registry.getDiscoveredArtifacts()).toContain(MockAuth);
  });

  // A hot reload evaluates the module again: a new class, the same name and the same key.
  test('accepts a class declared again under its own name, and binds the later one', async () => {
    const declare = () => {
      @service({ binding: authKey })
      class ReloadedAuth {}

      return ReloadedAuth;
    };

    declare();
    const reloaded = declare();

    const application = new TestApplication();
    await application.start();

    expect(application.get({ key: 'services.auth' })).toBeInstanceOf(reloaded);
  });
});

describe('AbstractArdorApplication.bindingList, allowOverride false', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReturnType<typeof registry.getDiscoveredArtifacts> = [];

  beforeEach(() => {
    discovered = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    registry.clearDiscoveredArtifacts();

    for (const target of discovered) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  test('throws when bindingList would replace a stereotype declared allowOverride false', async () => {
    class Shared {}

    @service({ allowOverride: false })
    class Locked {}

    class ListingApplication extends TestApplication {
      override bindingList() {
        return { 'services.Locked': Shared };
      }
    }

    const result = await RejectionHelper.rejectionOf({ task: new ListingApplication().start() });

    expect(result).toMatchObject({
      message: expect.stringMatching(/'services\.Locked'.*Locked.*Shared.*bindContext/),
    });
    expect(registry.getDiscoveredArtifacts()).toContain(Locked);
  });

  test('throws when bindingList would replace a by-hand registration declared allowOverride false', async () => {
    class Shared {}
    class ByHand {}

    class ListingApplication extends TestApplication {
      override bindingList() {
        return { 'services.ByHand': Shared };
      }
    }

    const application = new ListingApplication();
    application.service(ByHand, { allowOverride: false });

    const result = await RejectionHelper.rejectionOf({ task: application.start() });

    expect(result).toMatchObject({ message: expect.stringMatching(/'services\.ByHand'.*ByHand/) });
  });

  test('throws when a discovered class would replace a by-hand registration declared allowOverride false', async () => {
    @service({ binding: { namespace: 'services', key: 'auth' } })
    class Discovered {}

    class ByHand {}

    const application = new TestApplication();
    application.service(ByHand, {
      binding: { namespace: 'services', key: 'auth' },
      allowOverride: false,
    });

    const result = await RejectionHelper.rejectionOf({ task: application.start() });

    expect(result).toMatchObject({
      message: expect.stringMatching(/'services\.auth'.*ByHand.*Discovered/),
    });
    expect(registry.getDiscoveredArtifacts()).toContain(Discovered);
  });

  test('bindContext still replaces a binding declared allowOverride false', async () => {
    class Shared {}

    @service({ allowOverride: false })
    class Locked {}

    class OverridingApplication extends TestApplication {
      override bindingList() {
        return {};
      }

      override bindContext(): void {
        this.bind({ key: 'services.Locked' }).toClass(Shared);
      }
    }

    const application = new OverridingApplication();
    await application.start();

    expect(application.get({ key: 'services.Locked' })).toBeInstanceOf(Shared);
    expect(registry.getDiscoveredArtifacts()).toContain(Locked);
  });

  test('bindingList still replaces a stereotype that allows it', async () => {
    class Shared {}

    @service()
    class Open {}

    class ListingApplication extends TestApplication {
      override bindingList() {
        return { 'services.Open': Shared };
      }
    }

    const application = new ListingApplication();
    await application.start();

    expect(application.get({ key: 'services.Open' })).toBeInstanceOf(Shared);
    expect(registry.getDiscoveredArtifacts()).toContain(Open);
  });
});
