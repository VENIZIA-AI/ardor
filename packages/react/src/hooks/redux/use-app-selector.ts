import isEqual from 'lodash/isEqual.js';
import { shallowEqual, useSelector } from 'react-redux';

export const createAppSelectors = <TState>() => {
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
};
