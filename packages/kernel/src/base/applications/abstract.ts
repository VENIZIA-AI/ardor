import { MetadataRegistry } from '@venizia/ignis-kernel/metadata';
import { BindingScopes, Container, type TClass } from '@venizia/ignis-inversion';

import {
  CoreBindings,
  type IApplicationInfo,
  type IArdorApplication,
  type ValueOrPromise,
} from '@/common';

export abstract class AbstractArdorApplication extends Container implements IArdorApplication {
  abstract bindContext(): ValueOrPromise<void>;
  abstract getAppInfo(): ValueOrPromise<IApplicationInfo>;

  preConfigure(): ValueOrPromise<void> {
    this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);
    this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo());

    // Least explicit first, so the more explicit one lands last and wins:
    //
    //   stereotype  ->  bindingList()  ->  bindContext()
    //
    // A stereotype is what a class declares about itself. `bindingList()` is what THIS application
    // decided for this build, by hand. An override that loses to a decorator is an override that
    // was ignored with nothing to show it.
    this.registerArtifacts();

    for (const [key, target] of Object.entries(this.bindingList())) {
      this.bind({ key }).toClass(target).setScope(BindingScopes.SINGLETON);
    }

    return this.bindContext();
  }

  /**
   * Binds every class a stereotype marked - `@service()`, `@component()` and the rest from
   * `@venizia/ignis-kernel/metadata`.
   *
   * The stereotype does two things at import time: it records the binding key ON THE CLASS through
   * `reflect-metadata`, and it appends the class to a module-level discovery list. This reads that
   * list and binds each entry under the key the class already carries, so nothing here derives a key
   * and nothing a minifier renames is ever compared against a string a human typed.
   *
   * The list is global, not per application. Two applications in one process therefore bind the same
   * classes - which is what a test suite wants, and what a browser never encounters, since a page
   * runs one application.
   */
  registerArtifacts(): void {
    const registry = this.getMetadataRegistry();

    for (const target of MetadataRegistry.getInstance().getDiscoveredArtifacts()) {
      const key = registry.getBindingKey({ target });

      // A discovered class with no key is not an error to raise here: the stereotype that failed to
      // record one is the bug, and it reports itself where it ran.
      if (!key) {
        continue;
      }

      this.bind({ key })
        .toClass(target as TClass<unknown>)
        .setScope(BindingScopes.SINGLETON);
    }
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

  postConfigure(): ValueOrPromise<void> {}

  // Singleton by default: a service or provider registered by class is one instance per
  // application, which is what every consumer bound by hand before this default existed.
  // Keys on `value.name` - see `bindingList()` for the build-proof form.
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>) {
    this.bind({ key: `${scope}.${value.name}` })
      .toClass(value)
      .setScope(BindingScopes.SINGLETON)
      .setTags(...(tags ?? []));
  }

  service<T>(value: TClass<T>) {
    this.injectable('services', value);
  }

  async start() {
    await this.preConfigure();
    await this.postConfigure();
  }
}

export abstract class BaseArdorApplication extends AbstractArdorApplication {}
