import React from 'react';

import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';

export const createAppDispatch = <
  TDispatch extends Dispatch<UnknownAction> = Dispatch<UnknownAction>,
>() => {
  const useAppDispatch = useDispatch.withTypes<TDispatch>();

  const useMultipleAppDispatch = () => {
    const dispatch = useAppDispatch();

    type DispatchActionType = Parameters<TDispatch>[0];

    const multipleDispatch = React.useCallback(
      (...actions: DispatchActionType[]) => {
        actions.forEach(action => {
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
};
