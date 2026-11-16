import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';
import { type Binding, BindingScopes } from '@venizia/ignis-inversion';

import { AbstractArdorApplication } from '@/base/applications/abstract';
import { configuration, provide } from '@/base/metadata';
import {
  CoreBindings,
  type IApplicationInfo,
  type IArdorApplication,
  type ValueOrPromise,
} from '@/common';
import { TestArdorApplication } from './test-application';

class LifecycleSteps {
  static readonly PRE_CONFIGURE = 'preConfigure';
  static readonly BIND_CONTEXT = 'bindContext';
  static readonly BIND_CONTEXT_START = 'bindContext:start';
  static readonly BIND_CONTEXT_END = 'bindContext:end';
  static readonly POST_CONFIGURE = 'postConfigure';

  static readonly SCHEME_SET = new Set<string>([
    LifecycleSteps.PRE_CONFIGURE,
    LifecycleSteps.BIND_CONTEXT,
    LifecycleSteps.BIND_CONTEXT_START,
    LifecycleSteps.BIND_CONTEXT_END,
    LifecycleSteps.POST_CONFIGURE,
  ]);

  static isValid = ({ value }: { value: unknown }): boolean => {
    return typeof value === 'string' && LifecycleSteps.SCHEME_SET.has(value);
  };
}

class InjectionScopes {
  static readonly SERVICES = 'services';

  static readonly SCHEME_SET = new Set<string>([InjectionScopes.SERVICES]);

  static isValid = ({ value }: { value: unknown }): boolean => {
    return typeof value === 'string' && InjectionScopes.SCHEME_SET.has(value);
  };
}

class TestTags {
  static readonly TAG_AUDIT = 'audit';
  static readonly TAG_LOGGING = 'logging';

  static readonly SCHEME_SET = new Set<string>([TestTags.TAG_AUDIT, TestTags.TAG_LOGGING]);

  static isValid = ({ value }: { value: unknown }): boolean => {
    return typeof value === 'string' && TestTags.SCHEME_SET.has(value);
  };
}

class AuditService {
  readonly scopeName = 'audit-service-instance';

  getScopeName(): string {
    return this.scopeName;
  }
}

class LoggingService {
  readonly channel = 'console';

  getChannel(): string {
    return this.channel;
  }
}

class AppInfoTestApplication extends TestArdorApplication {
  bindContextExecuted = false;
  appInfoAtBindContext: IApplicationInfo | null = null;

  getAppInfo(): IApplicationInfo {
    return {
      name: 'ARDOR-app-info-test',
      version: '1.0.0',
      description: 'Tests CoreBindings.APPLICATION_INFO binding order in ARDOR application',
    };
  }

  bindContext(): void {
    this.bindContextExecuted = true;
    this.appInfoAtBindContext = this.get<IApplicationInfo>({
      key: CoreBindings.APPLICATION_INFO,
    });
  }
}

class AsyncLifecycleApplication extends TestArdorApplication {
  readonly executionLog: Array<string> = [];

  getAppInfo(): IApplicationInfo {
    return {
      name: 'ARDOR-async-lifecycle-test',
      version: '1.0.0',
      description: 'Tests async bindContext lifecycle sequencing in ARDOR application',
    };
  }

  async bindContext(): Promise<void> {
    this.executionLog.push(LifecycleSteps.BIND_CONTEXT_START);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.executionLog.push(LifecycleSteps.BIND_CONTEXT_END);
        resolve();
      }, 20);
    });
  }

  override postConfigure(): void {
    this.executionLog.push(LifecycleSteps.POST_CONFIGURE);
  }
}

class ContainerBindingApplication extends TestArdorApplication {
  getAppInfo(): IApplicationInfo {
    return {
      name: 'ARDOR-container-binding-test',
      version: '1.0.0',
      description: 'Tests injectable and service registration in ARDOR application',
    };
  }

  bindContext(): void {}
}

class PostConfigureOverrideApplication extends TestArdorApplication {
  readonly lifecycleOrder: Array<string> = [];

  getAppInfo(): IApplicationInfo {
    return {
      name: 'ARDOR-post-configure-override-test',
      version: '1.0.0',
      description: 'Tests overriding postConfigure in ARDOR application',
    };
  }

  override preConfigure(): ValueOrPromise<void> {
    this.lifecycleOrder.push(LifecycleSteps.PRE_CONFIGURE);

    return super.preConfigure();
  }

  bindContext(): void {
    this.lifecycleOrder.push(LifecycleSteps.BIND_CONTEXT);
  }

  override postConfigure(): void {
    this.lifecycleOrder.push(LifecycleSteps.POST_CONFIGURE);
  }
}

class AsyncPostConfigureApplication extends TestArdorApplication {
  postConfigureCompleted = false;

  getAppInfo(): IApplicationInfo {
    return {
      name: 'ARDOR-async-post-configure-test',
      version: '1.0.0',
      description: 'Tests async postConfigure override in ARDOR application',
    };
  }

  bindContext(): void {}

  override async postConfigure(): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.postConfigureCompleted = true;
        resolve();
      }, 20);
    });
  }
}

describe('AbstractArdorApplication - CoreBindings.APPLICATION_INFO registration', () => {
  test('start() binds CoreBindings.APPLICATION_INFO to getAppInfo() value before bindContext runs', async () => {
    const app = new AppInfoTestApplication();
    await app.start();

    expect(app.bindContextExecuted).toBe(true);
    expect(app.appInfoAtBindContext).toEqual({
      name: 'ARDOR-app-info-test',
      version: '1.0.0',
      description: 'Tests CoreBindings.APPLICATION_INFO binding order in ARDOR application',
    });
    expect(app.get<IApplicationInfo>({ key: CoreBindings.APPLICATION_INFO })).toEqual({
      name: 'ARDOR-app-info-test',
      version: '1.0.0',
      description: 'Tests CoreBindings.APPLICATION_INFO binding order in ARDOR application',
    });
  });
});

describe('AbstractArdorApplication - async bindContext lifecycle ordering', () => {
  test('start() awaits an async bindContext before postConfigure runs', async () => {
    const app = new AsyncLifecycleApplication();
    await app.start();

    expect(app.executionLog).toEqual([
      LifecycleSteps.BIND_CONTEXT_START,
      LifecycleSteps.BIND_CONTEXT_END,
      LifecycleSteps.POST_CONFIGURE,
    ]);
  });
});

describe('AbstractArdorApplication - service registration', () => {
  test('injectable() is gone: register with service() and its binding option', () => {
    const app = new ContainerBindingApplication();

    expect(Reflect.get(AbstractArdorApplication.prototype, 'injectable')).toBeUndefined();
    expect(Reflect.get(app, 'injectable')).toBeUndefined();

    const binding = app.service(AuditService, {
      binding: { namespace: InjectionScopes.SERVICES, key: 'Audit' },
    });
    binding.setTags(TestTags.TAG_AUDIT, TestTags.TAG_LOGGING);

    const resolved = app.get<AuditService>({ key: `${InjectionScopes.SERVICES}.Audit` });

    expect(resolved).toBeInstanceOf(AuditService);
    expect(resolved.getScopeName()).toBe('audit-service-instance');
    expect(binding.getTags()).toEqual(
      expect.arrayContaining([TestTags.TAG_AUDIT, TestTags.TAG_LOGGING]),
    );
  });

  test('IArdorApplication carries the registration signatures of the class, and no injectable', () => {
    type TMembers = keyof IArdorApplication;
    const members: Array<TMembers> = [
      'preConfigure',
      'postConfigure',
      'bindContext',
      'bindingList',
      'features',
      'artifacts',
      'service',
      'repository',
      'dataSource',
      'component',
      'start',
    ];
    // @ts-expect-error - injectable() was removed
    const removed: TMembers = 'injectable';
    const app: IArdorApplication = new ContainerBindingApplication();
    const binding: Binding<LoggingService> = app.service(LoggingService, {
      scope: BindingScopes.TRANSIENT,
    });

    expect(members).toHaveLength(11);
    expect(String(removed)).toBe('injectable');
    expect(binding.getScope()).toBe(BindingScopes.TRANSIENT);
  });

  test('service() binds target class under services scope and is resolvable via container.get', () => {
    const app = new ContainerBindingApplication();

    app.service(LoggingService);

    expect(app.getMetadataRegistry().getBindingKey({ target: LoggingService })).toBe(
      `${InjectionScopes.SERVICES}.${LoggingService.name}`,
    );

    const resolved = app.get<LoggingService>({
      key: `${InjectionScopes.SERVICES}.${LoggingService.name}`,
    });

    expect(resolved).toBeInstanceOf(LoggingService);
    expect(resolved.getChannel()).toBe('console');
  });
});

describe('AbstractArdorApplication - postConfigure override behavior', () => {
  test('a subclass may override postConfigure and it runs after preConfigure', async () => {
    const app = new PostConfigureOverrideApplication();
    await app.start();

    expect(app.lifecycleOrder).toEqual([
      LifecycleSteps.PRE_CONFIGURE,
      LifecycleSteps.BIND_CONTEXT,
      LifecycleSteps.POST_CONFIGURE,
    ]);

    const preConfigureIndex = app.lifecycleOrder.indexOf(LifecycleSteps.PRE_CONFIGURE);
    const postConfigureIndex = app.lifecycleOrder.indexOf(LifecycleSteps.POST_CONFIGURE);
    expect(postConfigureIndex).toBeGreaterThan(preConfigureIndex);
  });

  test('postConfigure override can be async and completes before start() finishes', async () => {
    const app = new AsyncPostConfigureApplication();
    expect(app.postConfigureCompleted).toBe(false);

    await app.start();

    expect(app.postConfigureCompleted).toBe(true);
  });
});

describe('bindingList', () => {
  class ListedAuditService {}

  class ListedApplication extends TestArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'listed', version: '0.0.0', description: 'bindingList test' };
    }

    bindContext(): void {}

    override bindingList() {
      return { 'services.AuditService': ListedAuditService };
    }
  }

  test('binds every listed class under its literal key as a singleton before bindContext', async () => {
    const app = new ListedApplication();
    await app.start();

    const first = app.get<AuditService>({ key: 'services.AuditService' });
    const second = app.get<AuditService>({ key: 'services.AuditService' });

    expect(first).toBeInstanceOf(ListedAuditService);
    expect(second).toBe(first);
  });

  test('a manual binding in bindContext replaces a listed one', async () => {
    class Replacement {}
    class OverridingApplication extends ListedApplication {
      override bindContext(): void {
        this.bind({ key: 'services.AuditService' }).toClass(Replacement);
      }
    }
    const app = new OverridingApplication();
    await app.start();

    expect(app.get({ key: 'services.AuditService' })).toBeInstanceOf(Replacement);
  });
});

class AsyncAppInfoApplication extends TestArdorApplication {
  async getAppInfo(): Promise<IApplicationInfo> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });

    return {
      name: 'ARDOR-async-app-info-test',
      version: '1.0.0',
      description: 'Tests an async getAppInfo in ARDOR application',
    };
  }

  bindContext(): void {}
}

describe('AbstractArdorApplication - an async getAppInfo', () => {
  test('start() binds the resolved info to CoreBindings.APPLICATION_INFO, not a promise', async () => {
    const app = new AsyncAppInfoApplication();
    await app.start();

    const info = app.get<IApplicationInfo>({ key: CoreBindings.APPLICATION_INFO });

    expect(info).not.toBeInstanceOf(Promise);
    expect(info).toEqual({
      name: 'ARDOR-async-app-info-test',
      version: '1.0.0',
      description: 'Tests an async getAppInfo in ARDOR application',
    });
  });
});

class DefaultKeys {
  static readonly PROVIDED = 'test.defaults.provided';
  static readonly LISTED = 'test.defaults.listed';
  static readonly CONTEXT = 'test.defaults.context';
  static readonly UNTOUCHED = 'test.defaults.untouched';
}

class DefaultValue {
  readonly source = 'default';
}

class ListedValue {
  readonly source = 'bindingList';
}

@configuration()
class DefaultsOverridingConfiguration {
  @provide({ key: DefaultKeys.PROVIDED })
  provided() {
    return { source: '@provide' };
  }
}

class DefaultsApplication extends TestArdorApplication {
  infoAtDefaults: IApplicationInfo | undefined;

  getAppInfo(): IApplicationInfo {
    return { name: 'defaults', version: '0.0.0', description: 'bindDefaults test' };
  }

  protected override bindDefaults(): void {
    this.infoAtDefaults = this.get<IApplicationInfo>({ key: CoreBindings.APPLICATION_INFO });

    for (const key of [
      DefaultKeys.PROVIDED,
      DefaultKeys.LISTED,
      DefaultKeys.CONTEXT,
      DefaultKeys.UNTOUCHED,
    ]) {
      this.bind({ key }).toClass(DefaultValue).setScope(BindingScopes.SINGLETON);
    }
  }

  override bindingList() {
    return { [DefaultKeys.LISTED]: ListedValue };
  }

  bindContext(): void {
    this.bind({ key: DefaultKeys.CONTEXT }).toValue({ source: 'bindContext' });
  }
}

describe('AbstractArdorApplication - bindDefaults', () => {
  test('binds nothing by default', async () => {
    const app = new ContainerBindingApplication();
    await app.start();

    expect(app.isBound({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })).toBe(false);
    expect(app.isBound({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })).toBe(false);
  });

  test('runs after the application info is bound', async () => {
    const app = new DefaultsApplication();
    await app.start();

    expect(app.infoAtDefaults?.name).toBe('defaults');
  });

  test('runs first: @provide, bindingList() and bindContext() each replace a default', async () => {
    const app = new DefaultsApplication();
    await app.start();

    expect(DefaultsOverridingConfiguration.name).toBe('DefaultsOverridingConfiguration');
    expect(app.get({ key: DefaultKeys.PROVIDED })).toEqual({ source: '@provide' });
    expect(app.get({ key: DefaultKeys.LISTED })).toBeInstanceOf(ListedValue);
    expect(app.get({ key: DefaultKeys.CONTEXT })).toEqual({ source: 'bindContext' });
    expect(app.get({ key: DefaultKeys.UNTOUCHED })).toBeInstanceOf(DefaultValue);
  });
});
