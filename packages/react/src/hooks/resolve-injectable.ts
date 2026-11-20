import { BindingKeys, type Container, getError, type TClass } from '@venizia/ignis-inversion';

interface IResolveInjectableOptions {
  container: Container;
  key?: string;
  target?: TClass<unknown>;
  hook: string;
  /** When set, a `target` bound under another namespace is refused. */
  namespace?: string;
}

const isSameOrSubclass = (opts: { bound: TClass<unknown>; target: TClass<unknown> }): boolean => {
  const { bound, target } = opts;

  return bound === target || bound.prototype instanceof target;
};

/**
 * The one resolution path of every injectable hook. It resolves on every render, as the container
 * does for every `get`: a `TRANSIENT` binding gives a new instance each time, so keep an instance that
 * holds state in a `SINGLETON` binding, or hold it yourself in `useState`.
 */
export const resolveInjectable = (opts: IResolveInjectableOptions): unknown => {
  const { container, key, target, hook, namespace } = opts;

  if (key) {
    const bindingKey = BindingKeys.build<unknown>({ key });

    if (!container.isBound({ key: bindingKey })) {
      throw getError({
        message: `Binding key: ${key} is not bounded in context! | A key derived from a class name (<namespace>.<ClassName>) changes when a minifier renames the class: resolve it by { target }, or pin it with binding: { namespace, key } on the class`,
      });
    }

    return container.get({ key: bindingKey });
  }

  if (!target) {
    throw getError({
      message: `[${hook}] Failed to determine injectable! | Missing both key and target`,
    });
  }

  const resolved = container.getMetadataRegistry().getBindingKey({ target });

  if (!resolved) {
    throw getError({
      message: `[${hook}] No binding key is recorded on ${target.name} | Register it by stereotype (@service() and the rest) or by hand (service(), repository(), dataSource(), component(), bindingList()), or resolve it by { key }`,
    });
  }

  // `String(...)`: a key may be a symbol, which a template literal throws on.
  const bound = String(resolved);

  if (namespace && !bound.startsWith(`${namespace}.`)) {
    throw getError({
      message: `[${hook}] ${target.name} is bound as "${bound}", not under "${namespace}". Use the hook for that namespace, or change the stereotype on the class.`,
    });
  }

  const boundClass = container.getBinding<unknown>({ key: resolved })?.boundClass();

  if (boundClass && !isSameOrSubclass({ bound: boundClass, target })) {
    throw getError({
      message: `[${hook}] The key "${bound}" is bound to the class ${boundClass.name}, which is not the ${target.name} you passed as target. Two different classes share this name: rename one, or give one a key with binding: { namespace, key } on the class.`,
    });
  }

  return container.get<unknown>({ key: resolved });
};
