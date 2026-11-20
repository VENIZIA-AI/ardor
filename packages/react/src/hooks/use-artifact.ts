import { BindingNamespaces } from '@venizia/ardor-kernel';

import { resolveInjectable } from './resolve-injectable';
import {
  useApplicationContainer,
  type IUseInjectableByKey,
  type IUseInjectableByTarget,
} from './use-injectable';

/** By class: the return type is inferred from the target. */
export interface IUseArtifactByTarget<TInstance> extends IUseInjectableByTarget<TInstance> {}

/** By key: the instance type is the one the key carries. */
export interface IUseArtifactByKey<TValue = unknown> extends IUseInjectableByKey<TValue> {}

/**
 * `useService`, `useRepository`, `useProvider`, `useComponent`, `useConfiguration`: the same
 * resolution as `useInjectable`, and a `{ target }` must be bound under the hook's namespace, or it throws.
 */
const useArtifactInNamespace = (opts: {
  options: IUseArtifactByTarget<unknown> | IUseArtifactByKey;
  namespace: string;
  hook: string;
}): unknown => {
  const { options, namespace, hook } = opts;
  const container = useApplicationContainer({ container: options.container });

  return resolveInjectable({
    container,
    key: options.key,
    target: options.target,
    hook,
    namespace,
  });
};

/** Resolves the instance bound under the `service` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export function useService<TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance;

export function useService(opts: IUseArtifactByTarget<unknown> | IUseArtifactByKey): unknown {
  return useArtifactInNamespace({
    options: opts,
    namespace: BindingNamespaces.SERVICE,
    hook: 'useService',
  });
}

/**
 * Resolves the instance bound under the `provider` namespace. A `target` bound under another
 * namespace throws.
 *
 * - `{ target }` returns the instance type of the class.
 * - `{ key }` of a provider of `CoreBindings` returns what that key holds: `IDataProvider`,
 *   `IAuthProvider` or react-admin's `I18nProvider`, with no generic and no augmentation. Any key made by
 *   `BindingKeys.build<T>` does the same with its own `T`.
 *
 * @example
 * ```tsx
 * import { CoreBindings, useProvider } from '@venizia/ardor';
 *
 * export function Providers() {
 *   const dataProvider = useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });
 *   const authProvider = useProvider({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });
 *   return <span>{typeof dataProvider.getList} {typeof authProvider.getRoles}</span>;
 * }
 * ```
 */
export function useProvider<TValue = unknown>(opts: IUseArtifactByKey<TValue>): TValue;
export function useProvider<TInstance = unknown>(opts: IUseArtifactByTarget<TInstance>): TInstance;

export function useProvider(opts: IUseArtifactByTarget<unknown> | IUseArtifactByKey): unknown {
  return useArtifactInNamespace({
    options: opts,
    namespace: BindingNamespaces.PROVIDER,
    hook: 'useProvider',
  });
}

/** Resolves the instance bound under the `component` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export function useComponent<TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance;

export function useComponent(opts: IUseArtifactByTarget<unknown> | IUseArtifactByKey): unknown {
  return useArtifactInNamespace({
    options: opts,
    namespace: BindingNamespaces.COMPONENT,
    hook: 'useComponent',
  });
}

/** Resolves the instance bound under the `configuration` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export function useConfiguration<TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance;

export function useConfiguration(opts: IUseArtifactByTarget<unknown> | IUseArtifactByKey): unknown {
  return useArtifactInNamespace({
    options: opts,
    namespace: BindingNamespaces.CONFIGURATION,
    hook: 'useConfiguration',
  });
}

/**
 * Resolves the instance bound under the `repository` namespace by `target` or `key`. A `target` bound under another namespace throws.
 *
 * @example
 * ```tsx
 * import { repository, useRepository } from '@venizia/ardor';
 *
 * @repository()
 * class ProductRepository {
 *   findStock(productId: string) { return productId ? 42 : 0; }
 * }
 *
 * export function StockDisplay() {
 *   const productRepository = useRepository({ target: ProductRepository });
 *   return <span>Stock: {productRepository.findStock('p1')}</span>;
 * }
 * ```
 */
export function useRepository<TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance;

export function useRepository(opts: IUseArtifactByTarget<unknown> | IUseArtifactByKey): unknown {
  return useArtifactInNamespace({
    options: opts,
    namespace: BindingNamespaces.REPOSITORY,
    hook: 'useRepository',
  });
}
