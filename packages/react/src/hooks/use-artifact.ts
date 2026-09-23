import { type AnyType, BindingNamespaces } from '@venizia/ardor-kernel';
import { Container, getError, type TClass } from '@venizia/ignis-inversion';

import {
  useInjectable,
  useInjectableContainer,
  type TUseInjectableKeys,
  type TUseInjectableOptions,
} from './use-injectable';

/** By class: the return type is inferred from the target. */
export interface IUseArtifactByTarget<T> {
  container?: Container;
  target: TClass<T>;
  key?: never;
}

/** By key: the caller supplies the type. */
export interface IUseArtifactByKey {
  container?: Container;
  key: TUseInjectableKeys;
  target?: never;
}

/**
 * `useService`, `useRepository`, `useProvider`, `useComponent`, `useConfiguration`. Unlike
 * `useInjectable`, a `{ target }` must be bound under the hook's namespace, or it throws.
 */
const resolveInNamespace = <T>(opts: {
  options: TUseInjectableOptions;
  namespace: string;
  hook: string;
}): T => {
  const { options, namespace, hook } = opts;

  // Same inputs as `useInjectable`, so the check and the resolve read one container.
  const container = useInjectableContainer({ container: options.container });

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

  return useInjectable<T>(options);
};

export const useService = <T = AnyType>(opts: IUseArtifactByTarget<T> | IUseArtifactByKey): T =>
  resolveInNamespace<T>({
    options: opts,
    namespace: BindingNamespaces.SERVICE,
    hook: 'useService',
  });

export const useProvider = <T = AnyType>(opts: IUseArtifactByTarget<T> | IUseArtifactByKey): T =>
  resolveInNamespace<T>({
    options: opts,
    namespace: BindingNamespaces.PROVIDER,
    hook: 'useProvider',
  });

export const useComponent = <T = AnyType>(opts: IUseArtifactByTarget<T> | IUseArtifactByKey): T =>
  resolveInNamespace<T>({
    options: opts,
    namespace: BindingNamespaces.COMPONENT,
    hook: 'useComponent',
  });

export const useConfiguration = <T = AnyType>(
  opts: IUseArtifactByTarget<T> | IUseArtifactByKey,
): T =>
  resolveInNamespace<T>({
    options: opts,
    namespace: BindingNamespaces.CONFIGURATION,
    hook: 'useConfiguration',
  });

export const useRepository = <T = AnyType>(opts: IUseArtifactByTarget<T> | IUseArtifactByKey): T =>
  resolveInNamespace<T>({
    options: opts,
    namespace: BindingNamespaces.REPOSITORY,
    hook: 'useRepository',
  });
