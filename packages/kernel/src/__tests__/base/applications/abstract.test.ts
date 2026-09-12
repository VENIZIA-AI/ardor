import { describe, expect, spyOn, test } from 'bun:test';

import { BaseArdorApplication } from '@/base/applications/abstract';
import { CoreBindings, type IApplicationInfo, type ValueOrPromise } from '@/common';

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

class AppInfoTestApplication extends BaseArdorApplication {
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

class AsyncLifecycleApplication extends BaseArdorApplication {
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

class ContainerBindingApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return {
      name: 'ARDOR-container-binding-test',
      version: '1.0.0',
      description: 'Tests injectable and service registration in ARDOR application',
    };
  }

  bindContext(): void {}
}

class PostConfigureOverrideApplication extends BaseArdorApplication {
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

class AsyncPostConfigureApplication extends BaseArdorApplication {
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

describe('BaseArdorApplication - CoreBindings.APPLICATION_INFO registration', () => {
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

describe('BaseArdorApplication - async bindContext lifecycle ordering', () => {
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

describe('BaseArdorApplication - injectable and service registration', () => {
  test('injectable() binds target class under scope with tags and is resolvable via container.get', async () => {
    const app = new ContainerBindingApplication();
    let capturedTags: Array<string> = [];

    const originalBind = app.bind.bind(app);
    spyOn(app, 'bind').mockImplementation(<T>(options: Parameters<typeof app.bind>[0]) => {
      const binding = originalBind<T>(options);
      const originalSetTags = binding.setTags.bind(binding);
      spyOn(binding, 'setTags').mockImplementation((...tags: Array<string>) => {
        capturedTags = tags;
        return originalSetTags(...tags);
      });
      return binding;
    });

    app.injectable(InjectionScopes.SERVICES, AuditService, [
      TestTags.TAG_AUDIT,
      TestTags.TAG_LOGGING,
    ]);

    const resolved = app.get<AuditService>({
      key: `${InjectionScopes.SERVICES}.${AuditService.name}`,
    });

    expect(resolved).toBeInstanceOf(AuditService);
    expect(resolved.getScopeName()).toBe('audit-service-instance');
    expect(capturedTags).toEqual([TestTags.TAG_AUDIT, TestTags.TAG_LOGGING]);
  });

  test('service() binds target class under services scope and is resolvable via container.get', () => {
    const app = new ContainerBindingApplication();
    const injectableSpy = spyOn(app, 'injectable');

    app.service(LoggingService);

    expect(injectableSpy).toHaveBeenCalledWith(InjectionScopes.SERVICES, LoggingService);

    const resolved = app.get<LoggingService>({
      key: `${InjectionScopes.SERVICES}.${LoggingService.name}`,
    });

    expect(resolved).toBeInstanceOf(LoggingService);
    expect(resolved.getChannel()).toBe('console');
  });
});

describe('BaseArdorApplication - postConfigure override behavior', () => {
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

  class ListedApplication extends BaseArdorApplication {
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
