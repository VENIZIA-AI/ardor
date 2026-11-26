import {
  ArtifactBindingKeys,
  ArtifactGroup,
  ArtifactNamespaces,
  ArtifactTypes,
  BindingNamespaces,
  MetadataRegistry,
} from '@venizia/ignis-kernel/metadata';
import {
  type Binding,
  BindingKeys,
  BindingScopes,
  Container,
  getError,
  type TBindingKey,
  type TClass,
} from '@venizia/ignis-inversion';
import type { IArtifactRegistrationOptions } from '@venizia/ignis-kernel';

import {
  CoreBindings,
  type IApplicationInfo,
  type IArdorArtifactIndex,
  type IFeatureBase,
  type ValueOrPromise,
} from '@/common';
import { ApplicationInfoGuard } from './app-info';

/** The six kinds of an artifact index, as `ignis-artifacts generate` emits them. */
const ArtifactIndexKinds = [
  'configurations',
  'dataSources',
  'components',
  'repositories',
  'services',
  'controllers',
] as const satisfies ReadonlyArray<keyof IArdorArtifactIndex>;

/** Per-registration choices for `service()`, `repository()`, `dataSource()` and `component()`. */
export interface IArtifactRegistration extends Pick<
  IArtifactRegistrationOptions,
  'binding' | 'scope' | 'allowOverride'
> {}

/**
 * Two ways to register, as in IGNIS: stereotype discovery, or `service()`/`repository()`/
 * `dataSource()`/`component()` by hand. Both record the key on the class. Every kind defaults to
 * SINGLETON (IGNIS's server uses transient): a hook resolves on every render.
 *
 * @useWhen you write the application class of an ARDOR app and register its services, repositories, data sources and components
 * @insteadOf wiring the container by hand
 */
export abstract class AbstractArdorApplication extends Container {
  /** The application's own bindings; `preConfigure` runs it last, so they win over discovered and feature bindings. */
  abstract bindContext(): ValueOrPromise<void>;
  /** The `IApplicationInfo` that `preConfigure` binds under `CoreBindings.APPLICATION_INFO`. */
  abstract getAppInfo(): ValueOrPromise<IApplicationInfo>;

  /** What `start()` resolved from `artifacts()`; unset when `preConfigure()` runs without it. */
  private resolvedIndexes: Array<IArdorArtifactIndex> | undefined;

  /** The keys bound with `allowOverride: false`, each with the class that holds it; only `bindContext()` may replace them. */
  private readonly lockedKeys = new Map<TBindingKey, Function>();

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
    ApplicationInfoGuard.assert({ info: opts.info });
    this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(opts.info);

    // Least explicit first, so the most explicit wins: defaults, stereotypes and @provide, features,
    // bindingList(), bindContext().
    this.bindDefaults();
    this.registerArtifacts();
    this.registerFeatures({ features: this.features() });

    for (const [name, target] of Object.entries(this.bindingList())) {
      const key = BindingKeys.build<unknown>({ key: name });
      const holder = this.lockedKeys.get(key);

      if (holder !== undefined) {
        throw getError({
          message: `[bindingList] '${key}' is held by ${holder.name} with allowOverride false, and bindingList() would replace it with ${target.name} | Bind it in bindContext() to override on purpose, or drop allowOverride: false`,
        });
      }

      this.getMetadataRegistry().setBindingKey({ target, key });
      this.bind({ key }).toClass(target).setScope(BindingScopes.SINGLETON);
    }

    return this.bindContext();
  }

  /**
   * Binds every stereotyped class whose `when` allows it, under its key and scope, then each
   * `@provide` method under its own key, as IGNIS's `bindProvidedKeys` does: a lazy provider,
   * SINGLETON unless `scope` says otherwise. `order` and `after` are not read: every binding is
   * lazy, so registration order changes nothing.
   */
  registerArtifacts(): void {
    const registry = MetadataRegistry.getInstance();
    const discovered = registry.getDiscoveredArtifacts();
    this.assertIndexed({
      indexes: this.resolvedIndexes ?? this.artifacts(),
      discovered: new Set(discovered),
    });

    const targets = discovered
      .filter((target): target is Function => typeof target === 'function')
      .filter((target) => this.isSelected({ target }));

    // Two classes a minifier named alike derive one key, and the second would silently replace the
    // first. Checked here, never at decoration, so a hot reload that re-decorates a class is no error.
    const entries = targets.flatMap((target) => {
      const metadata = registry.getArtifactMetadata({ target });

      if (!metadata) {
        return [];
      }

      const namespace = ArtifactNamespaces.resolve({ type: metadata.type });

      return [{ target, namespace, binding: metadata.binding }];
    });

    ArtifactBindingKeys.assertNoDerivedCollision({ caller: 'registerArtifacts', entries });
    this.assertNoPinnedCollision({ entries });

    for (const target of targets) {
      const key = this.getMetadataRegistry().getBindingKey({ target });

      if (!key) {
        continue;
      }

      const metadata = registry.getArtifactMetadata({ target });
      const holder = this.lockedKeys.get(key);

      if (
        holder !== undefined &&
        !AbstractArdorApplication.isSameDeclaration({ left: holder, right: target })
      ) {
        throw getError({
          message: `[registerArtifacts] '${String(key)}' is held by ${holder.name} with allowOverride false, and ${target.name} would replace it | Give one of them another key, or bind the intended one in bindContext()`,
        });
      }

      if (metadata?.allowOverride === false) {
        this.lockedKeys.set(key, target);
      }

      const definition = metadata ? ArtifactTypes.definitionOf({ type: metadata.type }) : undefined;

      this.bind({ key })
        .toClass(target as TClass<unknown>)
        .setScope(metadata?.scope ?? definition?.scope ?? BindingScopes.SINGLETON);

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

  /**
   * Two different classes that end up on one key where at least one pinned it: the later import would
   * silently win. Two derived keys are `ArtifactBindingKeys`'s to judge. Two pinned classes with one
   * name are a hot reload that declared the class again, which leaves nothing to tell apart.
   */
  private assertNoPinnedCollision(opts: {
    entries: Array<{
      target: Function;
      namespace: string;
      binding?: { namespace: string; key: string };
    }>;
  }): void {
    const owners = new Map<string, { target: Function; isDerived: boolean }>();

    for (const entry of opts.entries) {
      const { key, isDerived } = ArtifactBindingKeys.resolve(entry);
      const owner = owners.get(key);
      owners.set(key, { target: entry.target, isDerived });

      if (!owner || owner.target === entry.target) {
        continue;
      }

      const isSameDeclaration =
        !owner.isDerived &&
        !isDerived &&
        AbstractArdorApplication.isSameDeclaration({ left: owner.target, right: entry.target });

      if ((owner.isDerived && isDerived) || isSameDeclaration) {
        continue;
      }

      throw getError({
        message: `[registerArtifacts] The key '${key}' is claimed by both ${owner.target.name} and ${entry.target.name}, and the one imported last would silently replace the other | Give one of them another key, select one with 'when', or bind the intended one in bindContext()`,
      });
    }
  }

  /**
   * Whether two classes are one declaration evaluated twice, as a hot reload does: the same name and the same
   * source text. Two different classes that share a name (a minifier does it) are not, and the later one would
   * silently replace the earlier; two different classes with the same name and identical source text are taken as
   * one, the price of allowing a hot reload.
   */
  private static isSameDeclaration(opts: { left: Function; right: Function }): boolean {
    const { left, right } = opts;

    return (
      left === right ||
      (left.name === right.name &&
        Function.prototype.toString.call(left) === Function.prototype.toString.call(right))
    );
  }

  /**
   * Evaluates the `when` a stereotype declares, once, with the application. It must answer
   * synchronously: a promise is refused rather than read as true.
   */
  private isSelected(opts: { target: Function }): boolean {
    const { target } = opts;
    const when = MetadataRegistry.getInstance().getArtifactMetadata({ target })?.when;

    if (when === undefined) {
      return true;
    }

    let selected: unknown;

    try {
      selected = when({ application: this });
    } catch (error) {
      throw getError({
        message: `[registerArtifacts] The 'when' of ${target.name} threw: ${error instanceof Error ? error.message : String(error)} | A 'when' must not throw: return false to leave the class out`,
      });
    }

    if (typeof selected !== 'boolean') {
      throw getError({
        message: `[registerArtifacts] The 'when' of ${target.name} must return a boolean synchronously, it returned ${selected instanceof Promise ? 'a Promise' : typeof selected} | Resolve the answer before decoration, or bind the class by hand in bindContext()`,
      });
    }

    return selected;
  }

  /**
   * Classes bound under literal keys before `bindContext()` runs. A key that holds a class declared
   * `allowOverride: false` throws; only `bindContext()` replaces it.
   */
  bindingList(): Record<string, TClass<unknown>> {
    return {};
  }

  /**
   * The generated artifact indexes (`ignis-artifacts generate`). Discovery still binds every
   * stereotyped class; an index only holds each class by value and has `start()` check it.
   */
  artifacts(): Array<IArdorArtifactIndex> {
    return [];
  }

  /** The feature packages this application mounts, bound under `CoreBindings.FEATURES`. */
  features(): Array<IFeatureBase> {
    return [];
  }

  /**
   * `artifacts()` with each group replaced by its index. Resolving imports the modules, which
   * decorates their classes: it must finish before `registerArtifacts()` reads the discovery list.
   */
  private async resolveArtifactIndexes(): Promise<Array<IArdorArtifactIndex>> {
    const resolved: Array<IArdorArtifactIndex> = [];

    for (const entry of this.artifacts()) {
      if (!ArtifactGroup.isGroup(entry)) {
        resolved.push(entry);
        continue;
      }

      const index = await ArtifactGroup.resolveContent({ group: entry });
      resolved.push(index);
    }

    return resolved;
  }

  /**
   * Every class a flat index lists must be discovered, or its binding is silently never made. An
   * artifact group (`isArtifactGroup`) is not an index - its kind fields throw when read - so only
   * its inlined `content` is checked.
   */
  private assertIndexed(opts: {
    indexes: Array<IArdorArtifactIndex>;
    discovered: Set<unknown>;
  }): void {
    const { indexes, discovered } = opts;

    for (const entry of indexes) {
      const group = entry as { isArtifactGroup?: boolean; content?: IArdorArtifactIndex };
      const index = group.isArtifactGroup === true ? group.content : entry;

      if (!index) {
        continue;
      }

      for (const { field, targets } of AbstractArdorApplication.listsOf({ index })) {
        this.assertListed({ field, targets, discovered });
      }
    }
  }

  /** Every class list of an index: the six built-in fields, then `custom.<type>` for each defined type. */
  private static listsOf(opts: {
    index: IArdorArtifactIndex;
  }): Array<{ field: string; targets: ReadonlyArray<unknown> }> {
    const { index } = opts;

    return [
      ...ArtifactIndexKinds.map((field) => ({ field, targets: index[field] ?? [] })),
      ...Object.entries(index.custom ?? {}).map(([type, targets]) => ({
        field: `custom.${type}`,
        targets,
      })),
    ];
  }

  private assertListed(opts: {
    field: string;
    targets: ReadonlyArray<unknown>;
    discovered: Set<unknown>;
  }): void {
    const { field, targets, discovered } = opts;

    for (const [position, target] of targets.entries()) {
      // A cycle leaves `undefined` here: a bundler's eager class list is built while the module of
      // the class is still evaluating. Say so, rather than fail on `.name` below.
      if (typeof target !== 'function') {
        throw getError({
          message: `[artifacts] '${field}' lists an entry that is not a class (position ${position}) | Usually an import cycle: the module that imports the index (or @venizia/ignis-boot/auto) must not define decorated classes or be imported by them`,
        });
      }

      if (!discovered.has(target)) {
        throw getError({
          message: `[artifacts] '${field}' lists ${target.name}, which was never discovered | Decorate it with its stereotype and regenerate the index`,
        });
      }
    }
  }

  /**
   * Binds the features after the stereotypes, so `bindingList()` and `bindContext()` still override
   * what a feature provides. A name is unique, and every configuration and artifact a feature lists
   * must have been discovered: one that was not means its binding was silently never made.
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

      for (const { field, targets } of AbstractArdorApplication.listsOf({
        index: feature.artifacts ?? {},
      })) {
        for (const [position, target] of targets.entries()) {
          if (typeof target !== 'function') {
            throw getError({
              message: `[features] '${feature.name}' lists an entry in artifacts.${field} that is not a class (position ${position}) | Usually an import cycle: the feature module must not be imported by the classes it lists`,
            });
          }

          if (!discovered.has(target)) {
            throw getError({
              message: `[features] '${feature.name}' lists ${target.name} in artifacts.${field}, which was never discovered | Decorate it with its stereotype and import its module before start()`,
            });
          }
        }
      }
    }

    this.bind({ key: CoreBindings.FEATURES }).toValue(features);
  }

  /** Runs after `preConfigure` in `start()`; empty by default, for a subclass to override. */
  postConfigure(): ValueOrPromise<void> {}

  /** Binds `target` in the service namespace; returns the binding. */
  service<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.SERVICE,
      caller: 'service',
      opts,
    });
  }

  /** Binds `target` in the repository namespace; returns the binding. */
  repository<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.REPOSITORY,
      caller: 'repository',
      opts,
    });
  }

  /** Binds `target` in the data source namespace; returns the binding. */
  dataSource<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.DATASOURCE,
      caller: 'dataSource',
      opts,
    });
  }

  /** Binds `target` in the component namespace; returns the binding. */
  component<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T> {
    return this.registerArtifact({
      target,
      namespace: BindingNamespaces.COMPONENT,
      caller: 'component',
      opts,
    });
  }

  /**
   * The bindings a framework layer supplies before anything of the application, so a stereotype, a
   * `@provide` method, a feature, `bindingList()` or `bindContext()` under the same key replaces
   * them. Runs once `APPLICATION_INSTANCE` and `APPLICATION_INFO` are bound. Empty here: the
   * `BaseArdorApplication` of `@venizia/ardor-admin` binds the default providers.
   */
  protected bindDefaults(): void {}

  /** Resolves the artifact indexes, then runs `preConfigure`, then `postConfigure`, in that order. */
  async start() {
    const result = await this.resolveArtifactIndexes();
    this.resolvedIndexes = result;
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

    if (!allowOverride) {
      this.lockedKeys.set(key, target);
    }

    this.getMetadataRegistry().setBindingKey({ target, key });

    return this.bind<T>({ key })
      .toClass(target)
      .setScope(opts.opts?.scope ?? declared?.scope ?? BindingScopes.SINGLETON);
  }
}
