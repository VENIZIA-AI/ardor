import { BindingNamespaces } from '@venizia/ardor-kernel';
import { type Container, getError, type TClass } from '@venizia/ignis-inversion';

import {
  useInjectable,
  useApplicationContainer,
  type TUseInjectableKeys,
  type TUseInjectableOptions,
} from './use-injectable';

/** By class: the return type is inferred from the target. */
export interface IUseArtifactByTarget<TInstance> {
  /** The container to resolve from. @default The application's container (`ApplicationContext`) */
  container?: Container;
  /** The class to resolve; its recorded binding key is used. */
  target: TClass<TInstance>;
  key?: never;
}

/** By key: the caller supplies the type. */
export interface IUseArtifactByKey {
  /** The container to resolve from. @default The application's container (`ApplicationContext`) */
  container?: Container;
  /** The binding key to resolve. */
  key: TUseInjectableKeys;
  target?: never;
}

/**
 * `useService`, `useRepository`, `useProvider`, `useComponent`, `useConfiguration`. Unlike
 * `useInjectable`, a `{ target }` must be bound under the hook's namespace, or it throws.
 */
const useArtifactInNamespace = <TInstance>(opts: {
  options: TUseInjectableOptions;
  namespace: string;
  hook: string;
}): TInstance => {
  const { options, namespace, hook } = opts;

  // Same inputs as `useInjectable`, so the check and the resolve read one container.
  const container = useApplicationContainer({ container: options.container });

  // A `key` carries its namespace in the string; only a `target` is checked.
  if (options.target) {
    const key = container.getMetadataRegistry().getBindingKey({ target: options.target });
    // `String(...)`: a key may be a symbol, which a template literal throws on.
    const bound = key === undefined ? undefined : String(key);

    if (bound && !bound.startsWith(`${namespace}.`)) {
      throw getError({
        message: `[${hook}] ${options.target.name} is bound as "${bound}", not under "${namespace}". Use the hook for that namespace, or change the stereotype on the class.`,
      });
    }
  }

  return useInjectable<TInstance>(options);
};

/** Resolves the instance bound under the `service` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export const useService = <TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance =>
  useArtifactInNamespace<TInstance>({
    options: opts,
    namespace: BindingNamespaces.SERVICE,
    hook: 'useService',
  });

/** Resolves the instance bound under the `provider` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export const useProvider = <TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance =>
  useArtifactInNamespace<TInstance>({
    options: opts,
    namespace: BindingNamespaces.PROVIDER,
    hook: 'useProvider',
  });

/** Resolves the instance bound under the `component` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export const useComponent = <TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance =>
  useArtifactInNamespace<TInstance>({
    options: opts,
    namespace: BindingNamespaces.COMPONENT,
    hook: 'useComponent',
  });

/** Resolves the instance bound under the `configuration` namespace by `target` or `key`. A `target` bound under another namespace throws. */
export const useConfiguration = <TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance =>
  useArtifactInNamespace<TInstance>({
    options: opts,
    namespace: BindingNamespaces.CONFIGURATION,
    hook: 'useConfiguration',
  });

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
export const useRepository = <TInstance = unknown>(
  opts: IUseArtifactByTarget<TInstance> | IUseArtifactByKey,
): TInstance =>
  useArtifactInNamespace<TInstance>({
    options: opts,
    namespace: BindingNamespaces.REPOSITORY,
    hook: 'useRepository',
  });
