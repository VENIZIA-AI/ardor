import {
  ArtifactBindingKeys,
  ArtifactNamespaces,
  BindingNamespaces,
  MetadataRegistry,
} from '@venizia/ignis-kernel/metadata';
import {
  type Binding,
  BindingScopes,
  Container,
  getError,
  type TBindingScope,
  type TClass,
} from '@venizia/ignis-inversion';

import {
  CoreBindings,
  type IApplicationInfo,
  type IArdorApplication,
  type ValueOrPromise,
} from '@/common';

/** Per-registration choices for `service()`, `repository()`, `dataSource()` and `component()`. */
export interface IArtifactRegistration {
  /** Bind under this key instead of `<namespace>.<ClassName>`. */
  binding?: { namespace: string; key: string };
  scope?: TBindingScope;
  /** `false` refuses to replace a binding already under the key. */
  allowOverride?: boolean;
}

/**
 * Two ways to register, as in IGNIS: stereotype discovery, or `service()`/`repository()`/
 * `dataSource()`/`component()` by hand. Both record the key on the class. Every kind defaults to
 * SINGLETON (IGNIS's server uses transient): a hook resolves on every render.
 */
export abstract class AbstractArdorApplication extends Container implements IArdorApplication {
  abstract bindContext(): ValueOrPromise<void>;
  abstract getAppInfo(): ValueOrPromise<IApplicationInfo>;

  preConfigure(): ValueOrPromise<void> {
    this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);
    this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo());

    // Least explicit first, so the most explicit wins: stereotype, bindingList(), bindContext().
    this.registerArtifacts();

    for (const [key, target] of Object.entries(this.bindingList())) {
      this.getMetadataRegistry().setBindingKey({ target, key });
      this.bind({ key }).toClass(target).setScope(BindingScopes.SINGLETON);
    }

    return this.bindContext();
  }

  /**
   * Binds every stereotyped class under the key and scope it declares, then each of its `@provide`
   * methods under the method's key, as IGNIS's `bindProvidedKeys` does: a lazy provider that
   * resolves the class and calls the method on first `get()`, SINGLETON unless `scope` says
   * otherwise. One data provider then serves react-admin, the auth provider and every hook.
   */
  registerArtifacts(): void {
    const registry = MetadataRegistry.getInstance();
    const targets = registry.getDiscoveredArtifacts();

    // Two classes a minifier named alike derive one key, and the second would silently replace the
    // first. Checked here, never at decoration, so a hot reload that re-decorates a class is no error.
    ArtifactBindingKeys.assertNoDerivedCollision({
      caller: 'registerArtifacts',
      entries: targets.flatMap((target) => {
        const metadata = registry.getArtifactMetadata({ target });
        if (!metadata) {
          return [];
        }

        const namespace = ArtifactNamespaces.resolve({ type: metadata.type });
        return [{ target: target as TClass<unknown>, namespace, binding: metadata.binding }];
      }),
    });

    for (const target of targets) {
      const key = this.getMetadataRegistry().getBindingKey({ target });
      if (!key) {
        continue;
      }

      this.bind({ key })
        .toClass(target as TClass<unknown>)
        .setScope(registry.getArtifactMetadata({ target })?.scope ?? BindingScopes.SINGLETON);

      for (const entry of registry.getProvideMetadata({ target })) {
        this.bind({ key: entry.key })
          .toProvider((container) => {
            const instance = container.get<Record<string | symbol, () => unknown>>({ key });
            return instance[entry.methodName]();
          })
          .setScope(entry.scope ?? BindingScopes.SINGLETON);
      }
    }
  }

  /** Classes bound under literal keys before `bindContext()` runs. */
  bindingList(): Record<string, TClass<unknown>> {
    return {};
  }

  postConfigure(): ValueOrPromise<void> {}

  service<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.SERVICE,
      caller: 'service',
      opts,
    });
  }

  repository<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.REPOSITORY,
      caller: 'repository',
      opts,
    });
  }

  dataSource<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.DATASOURCE,
      caller: 'dataSource',
      opts,
    });
  }

  component<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.COMPONENT,
      caller: 'component',
      opts,
    });
  }

  /** `<scope>.<ClassName>`, singleton, with tags. Prefer the per-kind methods above. */
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>) {
    const { key } = ArtifactBindingKeys.resolve({ target: value, namespace: scope });
    this.getMetadataRegistry().setBindingKey({ target: value, key });
    this.bind({ key })
      .toClass(value)
      .setScope(BindingScopes.SINGLETON)
      .setTags(...(tags ?? []));
  }

  async start() {
    await this.preConfigure();
    await this.postConfigure();
  }

  /** Key: explicit `binding` > the class's stereotype > `<namespace>.<ClassName>`. Same for scope. */
  private registerArtifact<T>(opts: {
    target: TClass<T>;
    namespace: string;
    caller: string;
    opts?: IArtifactRegistration;
  }): Binding<T> {
    const { target, namespace, caller } = opts;
    const declared = MetadataRegistry.getInstance().getArtifactMetadata({ target });
    const { key } = ArtifactBindingKeys.resolve({
      target,
      namespace,
      binding: opts.opts?.binding ?? declared?.binding,
    });

    const allowOverride = opts.opts?.allowOverride ?? declared?.allowOverride ?? true;
    if (!allowOverride && this.isBound({ key })) {
      throw getError({
        message: `[${caller}] '${key}' is already bound and allowOverride is false | Pass a distinct binding key`,
      });
    }

    this.getMetadataRegistry().setBindingKey({ target, key });
    return this.bind<T>({ key })
      .toClass(target)
      .setScope(opts.opts?.scope ?? declared?.scope ?? BindingScopes.SINGLETON);
  }
}

export abstract class BaseArdorApplication extends AbstractArdorApplication {}
