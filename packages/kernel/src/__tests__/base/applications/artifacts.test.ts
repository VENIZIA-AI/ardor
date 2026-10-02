import 'reflect-metadata';

import { beforeEach, describe, expect, test } from 'bun:test';

import { BaseArdorApplication } from '@/base/applications/abstract';
import {
  component,
  configuration,
  MetadataRegistry,
  provide,
  service,
} from '@venizia/ignis-kernel/metadata';
import { BindingScopes } from '@venizia/ignis-inversion';
import { type IApplicationInfo } from '@/common';

class TestApplication extends BaseArdorApplication {
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
