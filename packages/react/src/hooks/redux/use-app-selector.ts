import { shallowEqual, useSelector } from 'react-redux';

const isPlain = (value: unknown): value is object => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)))
  );
};

/**
 * Equality by value for what a selector returns: primitives, plain objects, arrays and dates, none
 * of them cyclic; `0` equals `-0`, and `NaN` equals `NaN`. Any other object (a `Map`, a class
 * instance) is equal only to itself.
 */
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b || Object.is(a, b)) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return Object.is(a.getTime(), b.getTime());
  }

  if (!isPlain(a) || !isPlain(b) || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keys = Object.keys(a);

  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => {
      return Object.hasOwn(b, key) && deepEqual(Reflect.get(a, key), Reflect.get(b, key));
    })
  );
};

export class SelectorHooks {
  /** The three typed selector hooks of a store: bind your `RootState` once, and export what comes back. */
  static create<TState>() {
    const useAppSelector = useSelector.withTypes<TState>();

    const useShallowEqualSelector = <TSelected>(selector: (state: TState) => TSelected) => {
      return useAppSelector(selector, shallowEqual);
    };

    const useDeepEqualSelector = <TSelected>(selector: (state: TState) => TSelected) => {
      return useAppSelector(selector, deepEqual);
    };

    return {
      useAppSelector,
      useShallowEqualSelector,
      useDeepEqualSelector,
    };
  }
}
