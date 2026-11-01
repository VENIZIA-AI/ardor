import isEqual from 'lodash/isEqual.js';
import { shallowEqual, useSelector } from 'react-redux';

export class SelectorHooks {
  /** The three typed selector hooks of a store: bind your `RootState` once, and export what comes back. */
  static create<TState>() {
    const useAppSelector = useSelector.withTypes<TState>();

    const useShallowEqualSelector = <TSelected>(selector: (state: TState) => TSelected) => {
      return useAppSelector(selector, shallowEqual);
    };

    const useDeepEqualSelector = <TSelected>(selector: (state: TState) => TSelected) => {
      return useAppSelector(selector, isEqual);
    };

    return {
      useAppSelector,
      useShallowEqualSelector,
      useDeepEqualSelector,
    };
  }
}

/** @deprecated Use `SelectorHooks.create`. Removed in 0.5. */
export const createAppSelectors = SelectorHooks.create;
