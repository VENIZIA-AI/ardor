import { type AnyType, BindingNamespaces } from '@venizia/ardor-kernel';
import { Container, getError, type TClass } from '@venizia/ignis-inversion';

import {
  useInjectable,
  useInjectableContainer,
  type TUseInjectableKeys,
  type TUseInjectableOptions,
} from './use-injectable';

/**
 * Resolving by class, where the class IS the type. `useService({ target: AuditService })` returns a
 * `AuditService` with no generic written down - the target already says what it is, and repeating it
 * is a second place to get wrong.
 */
export interface IUseArtifactByTarget<T> {
  container?: Container;
  target: TClass<T>;
  key?: never;
}

/** Resolving by key, where nothing carries the type, so the caller supplies it. */
export interface IUseArtifactByKey {
  container?: Container;
  key: TUseInjectableKeys;
  target?: never;
}

/**
 * The per-stereotype hooks: `useService`, `useProvider`, `useComponent`, `useConfiguration`.
 *
 * Each takes an options object - `{ target }` or `{ key }`, never a positional class. One
 * positional parameter reads fine until the second one arrives, and by then every caller pays.
 *
 * They are not aliases for `useInjectable`. Each asserts that what it resolved is bound under its
 * own namespace, so `useService({ target: SomeProvider })` throws with both namespaces named rather
 * than returning an object of the wrong kind. Resolving the wrong artifact kind is the mistake this
 * catches, and an alias would not catch it.
 */
const resolveInNamespace = <T>(opts: {
  options: TUseInjectableOptions;
  namespace: string;
  hook: string;
}): T => {
  const { options, namespace, hook } = opts;

  // Same inputs as the call inside `useInjectable`, so provably the same container - the check and
  // the resolution can never read two different ones.
  const container = useInjectableContainer({ container: options.container });

  // A `key` the caller wrote carries its namespace in the string, and is theirs to be wrong about.
  // Only a `target` hides which namespace it lands in, so only that is worth checking.
  if (options.target) {
    const key = container.getMetadataRegistry().getBindingKey({ target: options.target });
    // `String(...)`, never interpolation: a binding key may be a symbol, and a template literal on
    // one throws at run time rather than reading as its description.
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
