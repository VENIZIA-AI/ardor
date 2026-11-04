import React from 'react';

import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';

/** Builds the typed dispatch hooks of a store. */
export class DispatchHooks {
  /**
   * The typed dispatch hooks of a store: bind your `AppDispatch` once, and export what comes back.
   * `useMultipleAppDispatch` returns a function that dispatches each action in order and skips falsy ones.
   */
  static create<TDispatch extends Dispatch<UnknownAction> = Dispatch<UnknownAction>>() {
    const useAppDispatch = useDispatch.withTypes<TDispatch>();

    const useMultipleAppDispatch = () => {
      const dispatch = useAppDispatch();

      type DispatchActionType = Parameters<TDispatch>[0];

      const multipleDispatch = React.useCallback(
        (...actions: DispatchActionType[]) => {
          actions.forEach((action) => {
            if (action) {
              dispatch(action);
            }
          });
        },
        [dispatch],
      );

      return multipleDispatch;
    };

    return {
      useAppDispatch,
      useMultipleAppDispatch,
    };
  }
}
