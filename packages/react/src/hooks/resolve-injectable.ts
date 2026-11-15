import React from 'react';

import { type Container, getError, type TClass } from '@venizia/ignis-inversion';

interface IResolveInjectableOptions {
  container: Container;
  key?: string;
  target?: TClass<unknown>;
  hook: string;
  /** When set, a `target` bound under another namespace is refused. */
  namespace?: string;
}

interface IResolved {
  container: Container;
  subject: string | TClass<unknown> | undefined;
  value: unknown;
}

const isSameOrSubclass = (opts: { bound: TClass<unknown>; target: TClass<unknown> }): boolean => {
  const { bound, target } = opts;

  return bound === target || bound.prototype instanceof target;
};

const resolveInjectable = (opts: IResolveInjectableOptions): unknown => {
  const { container, key, target, hook, namespace } = opts;

  if (key) {
    if (!container.isBound({ key })) {
      throw getError({
        message: `Binding key: ${key} is not bounded in context! | A key derived from a class name (<namespace>.<ClassName>) changes when a minifier renames the class: resolve it by { target }, or pin it with binding: { namespace, key } on the class`,
      });
    }

    return container.get<unknown>({ key });
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

/**
 * The one resolution path of every injectable hook. It resolves once per component instance and
 * container, and again when the container or the `key` or `target` changes, so a `TRANSIENT` binding
 * keeps one instance across the renders of a component. A binding replaced in the same container is
 * not picked up until the component mounts again.
 */
export const useResolvedInjectable = (opts: IResolveInjectableOptions): unknown => {
  const { container } = opts;
  const subject = opts.key || opts.target;

  const [resolved, setResolved] = React.useState<IResolved>(() => ({
    container,
    subject,
    value: resolveInjectable(opts),
  }));

  if (resolved.container === container && resolved.subject === subject) {
    return resolved.value;
  }

  const next: IResolved = { container, subject, value: resolveInjectable(opts) };
  setResolved(next);

  return next.value;
};
