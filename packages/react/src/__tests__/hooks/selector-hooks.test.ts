import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { act, cleanup, renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { SelectorHooks } from '@/hooks/redux/use-app-selector';

interface IState {
  tick: number;
  items: Array<{ id: number; tags: Array<string> }>;
  shape: Array<number> | Record<string, number>;
  at: number;
}

const slice = createSlice({
  name: 'test',
  initialState: { tick: 0, items: [{ id: 1, tags: ['a'] }], shape: [], at: 0 } as IState,
  reducers: {
    tick: (state) => {
      state.tick += 1;
    },
    setItems: (state, action: PayloadAction<IState['items']>) => {
      state.items = action.payload;
    },
    setShape: (state, action: PayloadAction<IState['shape']>) => {
      state.shape = action.payload;
    },
    setAt: (state, action: PayloadAction<number>) => {
      state.at = action.payload;
    },
  },
});

const createStore = () => configureStore({ reducer: slice.reducer });
type TStore = ReturnType<typeof createStore>;

const { useDeepEqualSelector, useShallowEqualSelector } = SelectorHooks.create<IState>();

const mount = <TSelected>(opts: { store: TStore; selector: (state: IState) => TSelected }) => {
  const renders = { count: 0 };
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(Provider, { store: opts.store, children });
  };
  const hook = renderHook(
    () => {
      renders.count += 1;
      return useDeepEqualSelector(opts.selector);
    },
    { wrapper },
  );

  return { ...hook, renders };
};

// react-redux warns in development about a selector that returns a new object each time; these selectors do, on purpose.
beforeEach(() => {
  spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  mock.restore();
});

describe('SelectorHooks useDeepEqualSelector', () => {
  test('does not render again for a new object that is equal by value', () => {
    const store = createStore();
    const { renders } = mount({
      store,
      selector: (state) => ({
        items: state.items.map((item) => ({ ...item, tags: [...item.tags] })),
      }),
    });
    const before = renders.count;

    act(() => {
      store.dispatch(slice.actions.tick());
    });

    expect(renders.count).toBe(before);
  });

  test('renders again, with the new value, when a nested value changes', () => {
    const store = createStore();
    const { result, renders } = mount({ store, selector: (state) => ({ items: state.items }) });
    const before = renders.count;

    act(() => {
      store.dispatch(slice.actions.setItems([{ id: 1, tags: ['a', 'b'] }]));
    });

    expect(renders.count).toBeGreaterThan(before);
    expect(result.current.items[0]?.tags).toEqual(['a', 'b']);
  });

  test('tells an empty array from an empty object', () => {
    const store = createStore();
    const { result } = mount({ store, selector: (state) => state.shape });
    expect(Array.isArray(result.current)).toBe(true);

    act(() => {
      store.dispatch(slice.actions.setShape({}));
    });

    expect(Array.isArray(result.current)).toBe(false);
  });

  test('compares two dates by their time, not by identity', () => {
    const store = createStore();
    const { renders } = mount({ store, selector: (state) => new Date(state.at) });
    const before = renders.count;

    act(() => {
      store.dispatch(slice.actions.tick());
    });
    expect(renders.count).toBe(before);

    act(() => {
      store.dispatch(slice.actions.setAt(5));
    });
    expect(renders.count).toBeGreaterThan(before);
  });

  test('differs from the shallow selector, which renders again for the same new object', () => {
    const store = createStore();
    const renders = { count: 0 };
    const wrapper = ({ children }: { children: React.ReactNode }) => {
      return React.createElement(Provider, { store, children });
    };
    renderHook(
      () => {
        renders.count += 1;
        return useShallowEqualSelector((state) => ({
          items: state.items.map((item) => ({ ...item })),
        }));
      },
      { wrapper },
    );
    const before = renders.count;

    act(() => {
      store.dispatch(slice.actions.tick());
    });

    expect(renders.count).toBeGreaterThan(before);
  });
});
