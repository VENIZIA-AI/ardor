import { BindingScopes, Container, type TClass } from '@venizia/ignis-inversion';

import {
  CoreBindings,
  type IApplicationInfo,
  type IArdorApplication,
  type ValueOrPromise,
} from '@/common';

// --------------------------------------------------------------------------------
export abstract class AbstractArdorApplication extends Container implements IArdorApplication {
  abstract bindContext(): ValueOrPromise<void>;
  abstract getAppInfo(): ValueOrPromise<IApplicationInfo>;

  // ------------------------------------------------------------------------------
  // Context Binding
  // ------------------------------------------------------------------------------
  preConfigure(): ValueOrPromise<void> {
    this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);
    this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo());

    for (const [key, target] of Object.entries(this.bindingList())) {
      this.bind({ key }).toClass(target).setScope(BindingScopes.SINGLETON);
    }

    return this.bindContext();
  }

  /**
   * Classes bound under an explicit key, before `bindContext()` runs. This is the production-safe
   * registration: `service(Class)` keys on `Class.name`, which a minifier rewrites, so a bundle
   * built with mangled class names resolves `services.ProductApi` to nothing. A literal key here
   * survives any build, and `keyof ReturnType<Application['bindingList']>` types `useInjectable`.
   */
  bindingList(): Record<string, TClass<unknown>> {
    return {};
  }

  // ------------------------------------------------------------------------------
  postConfigure(): ValueOrPromise<void> {}

  // ------------------------------------------------------------------------------
  // Singleton by default: a service or provider registered by class is one instance per
  // application, which is what every consumer bound by hand before this default existed.
  // Keys on `value.name` - see `bindingList()` for the build-proof form.
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>) {
    this.bind({ key: `${scope}.${value.name}` })
      .toClass(value)
      .setScope(BindingScopes.SINGLETON)
      .setTags(...(tags ?? []));
  }

  // ------------------------------------------------------------------------------
  service<T>(value: TClass<T>) {
    this.injectable('services', value);
  }

  // ------------------------------------------------------------------------------
  async start() {
    await this.preConfigure();
    await this.postConfigure();
  }
}

// --------------------------------------------------------------------------------
export abstract class BaseArdorApplication extends AbstractArdorApplication {}
