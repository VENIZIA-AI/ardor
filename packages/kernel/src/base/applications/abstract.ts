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
  type IArtifactIndex,
  type IFeatureBase,
  type ValueOrPromise,
} from '@/common';

/** The six kinds of an artifact index, as `ignis-artifacts generate` emits them. */
const ArtifactIndexKinds = [
  'configurations',
  'dataSources',
  'components',
  'repositories',
  'services',
  'controllers',
] as const satisfies ReadonlyArray<keyof IArtifactIndex>;

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

  /** What `start()` resolved from `artifacts()`; unset when `preConfigure()` runs without it. */
  private resolvedIndexes: Array<IArtifactIndex> | undefined;

  /** Stays synchronous unless `getAppInfo()` returns a promise: a subclass may still return either. */
  preConfigure(): ValueOrPromise<void> {
    this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);

    const info = this.getAppInfo();

    if (info instanceof Promise) {
      return info.then((resolved) => this.bindInfoAndArtifacts({ info: resolved }));
    }

    return this.bindInfoAndArtifacts({ info });
  }

  private bindInfoAndArtifacts(opts: { info: IApplicationInfo }): ValueOrPromise<void> {
    this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(opts.info);

    // Least explicit first, so the most explicit wins: stereotype, features, bindingList(), bindContext().
    this.registerArtifacts();
    this.registerFeatures({ features: this.features() });

    for (const [key, target] of Object.entries(this.bindingList())) {
      this.getMetadataRegistry().setBindingKey({ target, key });
      this.bind({ key }).toClass(target).setScope(BindingScopes.SINGLETON);
    }

    return this.bindContext();
  }

  /**
   * Binds every stereotyped class under its key and scope, then each `@provide` method under its
   * own key, as IGNIS's `bindProvidedKeys` does: a lazy provider, SINGLETON unless `scope` says
   * otherwise.
   */
  registerArtifacts(): void {
    const registry = MetadataRegistry.getInstance();
    const targets = registry.getDiscoveredArtifacts();
    this.assertIndexed({
      indexes: this.resolvedIndexes ?? this.artifacts(),
      discovered: new Set(targets),
    });

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

  /**
   * The generated artifact indexes (`ignis-artifacts generate`). Discovery still binds every
   * stereotyped class; an index only holds each class by value and has `start()` check it.
   */
  artifacts(): Array<IArtifactIndex> {
    return [];
  }

  /** The feature packages this application mounts, bound under `CoreBindings.FEATURES`. */
  features(): Array<IFeatureBase> {
    return [];
  }

  /**
   * `artifacts()` with each group without `content` replaced by the index its `resolve()` returns.
   * Resolving imports the modules, which decorates their classes: it must finish before
   * `registerArtifacts()` reads the discovery list.
   */
  private async resolveArtifactIndexes(): Promise<Array<IArtifactIndex>> {
    const resolved: Array<IArtifactIndex> = [];

    for (const entry of this.artifacts()) {
      const group = entry as {
        isArtifactGroup?: boolean;
        content?: IArtifactIndex;
        resolve?: () => Promise<IArtifactIndex>;
      };

      if (group.isArtifactGroup !== true || group.content !== undefined) {
        resolved.push(entry);
        continue;
      }

      // Such a group (`ArtifactGroup.define()`, `application()`) resolves only through a resolver in
      // IGNIS's realm, which this package cannot reach; skipping it would bind none of its classes.
      if (typeof group.resolve !== 'function') {
        throw getError({
          message:
            '[artifacts] A group has neither content nor resolve | Return AutoArtifacts from @venizia/ignis-boot/auto, or build with IgnisArtifactsPlugin so the group arrives with its content',
        });
      }

      resolved.push(await group.resolve());
    }

    return resolved;
  }

  /**
   * Every class a flat index lists must be discovered, or its binding is silently never made. An
   * artifact group (`isArtifactGroup`) is not an index - its kind fields throw when read - so only
   * its inlined `content` is checked.
   */
  private assertIndexed(opts: { indexes: Array<IArtifactIndex>; discovered: Set<unknown> }): void {
    const { indexes, discovered } = opts;

    for (const entry of indexes) {
      const group = entry as { isArtifactGroup?: boolean; content?: IArtifactIndex };
      const index = group.isArtifactGroup === true ? group.content : entry;
      if (!index) {
        continue;
      }

      for (const kind of ArtifactIndexKinds) {
        for (const [position, target] of (index[kind] ?? []).entries()) {
          // A cycle leaves `undefined` here: a bundler's eager class list is built while the module of
          // the class is still evaluating. Say so, rather than fail on `.name` below.
          if (typeof target !== 'function') {
            throw getError({
              message: `[artifacts] '${kind}' lists an entry that is not a class (position ${position}) | Usually an import cycle: the module that imports the index (or @venizia/ignis-boot/auto) must not define decorated classes or be imported by them`,
            });
          }

          if (!discovered.has(target)) {
            throw getError({
              message: `[artifacts] '${kind}' lists ${target.name}, which was never discovered | Decorate it with its stereotype and regenerate the index`,
            });
          }
        }
      }
    }
  }

  /**
   * Binds the features after the stereotypes, so `bindingList()` and `bindContext()` still override
   * what a feature provides. A name is unique, and every configuration a feature lists must have
   * been discovered: one that was not means the feature's bindings were silently never made.
   */
  private registerFeatures(opts: { features: Array<IFeatureBase> }): void {
    const { features } = opts;
    const discovered = new Set(MetadataRegistry.getInstance().getDiscoveredArtifacts());
    const names = new Set<string>();

    for (const feature of features) {
      if (names.has(feature.name)) {
        throw getError({
          message: `[features] Two features are named '${feature.name}' | A feature name is unique within an application`,
        });
      }
      names.add(feature.name);

      for (const target of feature.configurations ?? []) {
        if (!discovered.has(target)) {
          throw getError({
            message: `[features] '${feature.name}' lists ${target.name}, which was never discovered | Decorate it with @configuration() and import its module before start()`,
          });
        }
      }
    }

    this.bind({ key: CoreBindings.FEATURES }).toValue(features);
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
    this.resolvedIndexes = await this.resolveArtifactIndexes();
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
