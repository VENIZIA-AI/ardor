import { describe, test, expect, afterEach, mock } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { configureStore, createSlice, type Dispatch, type UnknownAction } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { useDebounce } from '@/hooks/use-debounce';
import { useAutosave } from '@/hooks/use-autosave';
import { useConfirm } from '@/hooks/use-confirm';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useBeforeUnload } from '@/hooks/use-before-unload';
import { useWindowDimensions } from '@/hooks/use-window-dimensions';
import { useSizer } from '@/hooks/use-sizer';
import { createAppDispatch } from '@/hooks/redux/use-app-dispatch';
import { createAppSelectors } from '@/hooks/redux/use-app-selector';

const wait = ({ ms }: { ms: number }): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

type TResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

class StubResizeObserver implements ResizeObserver {
  public static latestCallback: TResizeObserverCallback | undefined;
  public static latestInstance: StubResizeObserver | undefined;
  public static disconnected: boolean = false;

  public constructor(callback: TResizeObserverCallback) {
    StubResizeObserver.latestCallback = callback;
    StubResizeObserver.latestInstance = this;
    StubResizeObserver.disconnected = false;
  }

  public observe = (_target: Element): void => {};

  public unobserve = (_target: Element): void => {};

  public disconnect = (): void => {
    StubResizeObserver.disconnected = true;
  };
}

const createContainerElement = ({
  id,
  width,
  height,
  clientWidth,
}: {
  id: string;
  width: number;
  height: number;
  clientWidth: number;
}): HTMLElement => {
  const container = document.createElement('div');
  container.id = id;
  Object.defineProperty(container, 'offsetWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(container, 'offsetHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(container, 'clientWidth', {
    value: clientWidth,
    configurable: true,
    writable: true,
  });
  return container;
};

describe('useDebounce', () => {
  test('returns the initial value immediately and the new value only after delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => {
        return useDebounce({ value, delay });
      },
      { initialProps: { value: 'initial', delay: 20 } },
    );

    expect(result.current.debouncedValue).toBe('initial');

    rerender({ value: 'updated', delay: 20 });
    expect(result.current.debouncedValue).toBe('initial');

    await act(async () => {
      await wait({ ms: 40 });
    });

    expect(result.current.debouncedValue).toBe('updated');
  });

  test('does not update debounced value when disabled is true', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay, disabled }: { value: string; delay: number; disabled: boolean }) => {
        return useDebounce({ value, delay, disabled });
      },
      { initialProps: { value: 'initial', delay: 20, disabled: true } },
    );

    expect(result.current.debouncedValue).toBe('initial');

    rerender({ value: 'updated', delay: 20, disabled: true });

    await act(async () => {
      await wait({ ms: 40 });
    });

    expect(result.current.debouncedValue).toBe('initial');
  });
});

describe('useAutosave', () => {
  test('does not call onSave on the first render', () => {
    const onSaveMock = mock((_data: string) => {});

    renderHook(() => {
      return useAutosave({
        data: 'first-render-value',
        onSave: onSaveMock,
        interval: 20,
      });
    });

    expect(onSaveMock).not.toHaveBeenCalled();
  });

  test('calls onSave with the debounced value after a change', async () => {
    const onSaveMock = mock((_data: string) => {});

    const { rerender } = renderHook(
      ({ data }: { data: string }) => {
        return useAutosave({
          data,
          onSave: onSaveMock,
          interval: 20,
        });
      },
      { initialProps: { data: 'initial' } },
    );

    rerender({ data: 'modified' });
    expect(onSaveMock).not.toHaveBeenCalled();

    await act(async () => {
      await wait({ ms: 40 });
    });

    expect(onSaveMock).toHaveBeenCalledTimes(1);
    expect(onSaveMock).toHaveBeenCalledWith('modified');
  });

  test('calls onSave on unmount with the last value when enableSaveOnUnmount is true', () => {
    const onSaveMock = mock((_data: string) => {});

    const { rerender, unmount } = renderHook(
      ({ data }: { data: string }) => {
        return useAutosave({
          data,
          onSave: onSaveMock,
          interval: 20,
          enableSaveOnUnmount: true,
        });
      },
      { initialProps: { data: 'initial' } },
    );

    rerender({ data: 'latest-before-unmount' });
    expect(onSaveMock).not.toHaveBeenCalled();

    unmount();

    expect(onSaveMock).toHaveBeenCalledTimes(1);
    expect(onSaveMock).toHaveBeenCalledWith('latest-before-unmount');
  });
});

describe('useConfirm', () => {
  test('confirm sets message and resolves true after handleConfirm', async () => {
    const { result } = renderHook(() => {
      return useConfirm();
    });

    expect(result.current.message).toBeUndefined();

    let confirmPromise: Promise<boolean> | undefined;
    act(() => {
      confirmPromise = result.current.confirm({ message: 'Are you sure?' });
    });

    expect(result.current.message).toBe('Are you sure?');

    act(() => {
      result.current.handleConfirm();
    });

    const isConfirmed = await confirmPromise;
    expect(isConfirmed).toBe(true);
    expect(result.current.message).toBeUndefined();
  });

  test('confirm sets message and resolves false after handleAbort', async () => {
    const { result } = renderHook(() => {
      return useConfirm();
    });

    let abortPromise: Promise<boolean> | undefined;
    act(() => {
      abortPromise = result.current.confirm({ message: 'Cancel operation?' });
    });

    expect(result.current.message).toBe('Cancel operation?');

    act(() => {
      result.current.handleAbort();
    });

    const isConfirmed = await abortPromise;
    expect(isConfirmed).toBe(false);
    expect(result.current.message).toBeUndefined();
  });

  test('handleClose clears the message without resolving confirm promise', () => {
    const { result } = renderHook(() => {
      return useConfirm();
    });

    act(() => {
      result.current.confirm({ message: 'Dismissable prompt' }).catch(() => undefined);
    });

    expect(result.current.message).toBe('Dismissable prompt');

    act(() => {
      result.current.handleClose();
    });

    expect(result.current.message).toBeUndefined();
  });
});

describe('useCopyToClipboard', () => {
  const originalClipboard: Clipboard | undefined = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  test('resolves true and writes text when navigator.clipboard.writeText exists', async () => {
    const writeTextMock = mock(async (_text: string): Promise<void> => {});

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => {
      return useCopyToClipboard();
    });

    let copyResult: boolean = false;
    await act(async () => {
      copyResult = await result.current.copy({ value: 'ARDOR text' });
    });

    expect(copyResult).toBe(true);
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith('ARDOR text');
  });

  test('resolves false when navigator.clipboard is absent', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => {
      return useCopyToClipboard();
    });

    let copyResult: boolean = true;
    await act(async () => {
      copyResult = await result.current.copy({ value: 'IGNIS text' });
    });

    expect(copyResult).toBe(false);
  });
});

describe('useBeforeUnload', () => {
  test('calls preventDefault on beforeunload event when enabled is true', () => {
    const hook = renderHook(() => {
      return useBeforeUnload({ enabled: true, message: 'Unsaved progress' });
    });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    hook.unmount();
  });

  test('calls preventDefault when enabled is a function returning true', () => {
    const hook = renderHook(() => {
      return useBeforeUnload({
        enabled: () => {
          return true;
        },
      });
    });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    hook.unmount();
  });

  test('does not call preventDefault on beforeunload event when enabled is false', () => {
    const hook = renderHook(() => {
      return useBeforeUnload({ enabled: false });
    });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    hook.unmount();
  });
});

describe('useWindowDimensions', () => {
  test('reflects window dimensions and updates on a resize event', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => {
      return useWindowDimensions();
    });

    expect(result.current).toEqual({ width: 1024, height: 768 });

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1440,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 900,
        configurable: true,
        writable: true,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 1440, height: 900 });
  });
});

describe('useSizer', () => {
  const originalResizeObserver: typeof ResizeObserver | undefined = globalThis.ResizeObserver;

  afterEach(() => {
    StubResizeObserver.latestCallback = undefined;
    StubResizeObserver.latestInstance = undefined;
    StubResizeObserver.disconnected = false;
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
  });

  test('observes container and updates width and height on ResizeObserver callback', () => {
    globalThis.ResizeObserver = StubResizeObserver;

    const container = createContainerElement({
      id: 'sizer-container',
      width: 250,
      height: 120,
      clientWidth: 249,
    });
    document.body.appendChild(container);

    const { result, unmount } = renderHook(() => {
      return useSizer({ containerId: 'sizer-container' });
    });

    expect(result.current).toEqual({ width: 0, height: 0 });

    act(() => {
      const instance = StubResizeObserver.latestInstance;
      if (instance) {
        StubResizeObserver.latestCallback?.([], instance);
      }
    });

    expect(result.current).toEqual({ width: 250, height: 121 });

    unmount();
    expect(StubResizeObserver.disconnected).toBe(true);
    document.body.removeChild(container);
  });

  test('remains zero when container element does not exist', () => {
    globalThis.ResizeObserver = StubResizeObserver;

    const { result } = renderHook(() => {
      return useSizer({ containerId: 'missing-container' });
    });

    expect(result.current).toEqual({ width: 0, height: 0 });
  });
});

interface ICounterState {
  count: number;
  recordedActions: string[];
}

const initialCounterState: ICounterState = {
  count: 0,
  recordedActions: [],
};

const counterSlice = createSlice({
  name: 'counter',
  initialState: initialCounterState,
  reducers: {
    increment: (state) => {
      state.count += 1;
      state.recordedActions.push('increment');
    },
    decrement: (state) => {
      state.count -= 1;
      state.recordedActions.push('decrement');
    },
  },
});

const createCounterStore = () => {
  return configureStore({
    reducer: {
      counter: counterSlice.reducer,
    },
  });
};

type TCounterStore = ReturnType<typeof createCounterStore>;
type TFalsyAction = UnknownAction | undefined | null | false;
type TTestDispatch = Dispatch<UnknownAction> & ((action: TFalsyAction) => UnknownAction);

const createCounterWrapper = ({ store }: { store: TCounterStore }) => {
  return ({ children }: { children?: React.ReactNode }) => {
    return React.createElement(Provider, { store, children });
  };
};

describe('createAppDispatch', () => {
  const { useAppDispatch, useMultipleAppDispatch } = createAppDispatch<TTestDispatch>();

  test('useAppDispatch dispatches single action to the store', () => {
    const store = createCounterStore();

    const { result } = renderHook(
      () => {
        return useAppDispatch();
      },
      {
        wrapper: createCounterWrapper({ store }),
      },
    );

    act(() => {
      result.current(counterSlice.actions.increment());
    });

    expect(store.getState().counter.count).toBe(1);
    expect(store.getState().counter.recordedActions).toEqual(['increment']);
  });

  test('useMultipleAppDispatch dispatches every given action in order and skips falsy entries', () => {
    const store = createCounterStore();

    const { result } = renderHook(
      () => {
        return useMultipleAppDispatch();
      },
      {
        wrapper: createCounterWrapper({ store }),
      },
    );

    act(() => {
      result.current(
        counterSlice.actions.increment(),
        undefined,
        counterSlice.actions.increment(),
        null,
        counterSlice.actions.decrement(),
        false,
      );
    });

    expect(store.getState().counter.count).toBe(1);
    expect(store.getState().counter.recordedActions).toEqual([
      'increment',
      'increment',
      'decrement',
    ]);
  });
});

interface ISelectorState {
  data: {
    title: string;
    nested: {
      tag: string;
    };
  };
  tick: number;
}

const initialSelectorState: ISelectorState = {
  data: {
    title: 'ARDOR',
    nested: {
      tag: 'v1',
    },
  },
  tick: 0,
};

const selectorSlice = createSlice({
  name: 'selectorSlice',
  initialState: initialSelectorState,
  reducers: {
    bumpTick: (state) => {
      state.tick += 1;
    },
    setTitle: (state, action: { payload: string }) => {
      state.data.title = action.payload;
    },
    setTag: (state, action: { payload: string }) => {
      state.data.nested.tag = action.payload;
    },
  },
});

const createSelectorStore = () => {
  return configureStore({
    reducer: {
      selectorSlice: selectorSlice.reducer,
    },
  });
};

type TSelectorStore = ReturnType<typeof createSelectorStore>;
type TRootSelectorState = ReturnType<TSelectorStore['getState']>;

const createSelectorWrapper = ({ store }: { store: TSelectorStore }) => {
  return ({ children }: { children?: React.ReactNode }) => {
    return React.createElement(Provider, { store, children });
  };
};

describe('createAppSelectors', () => {
  const { useShallowEqualSelector, useDeepEqualSelector } =
    createAppSelectors<TRootSelectorState>();

  test('useShallowEqualSelector returns a stable reference for a shallow-equal object across renders', () => {
    const store = createSelectorStore();

    const selectShallow = (state: TRootSelectorState) => {
      return {
        title: state.selectorSlice.data.title,
      };
    };

    const { result } = renderHook(
      () => {
        return useShallowEqualSelector(selectShallow);
      },
      {
        wrapper: createSelectorWrapper({ store }),
      },
    );

    const firstReference = result.current;
    expect(firstReference).toEqual({ title: 'ARDOR' });

    act(() => {
      store.dispatch(selectorSlice.actions.bumpTick());
    });

    const secondReference = result.current;
    expect(secondReference).toBe(firstReference);

    act(() => {
      store.dispatch(selectorSlice.actions.setTitle('IGNIS'));
    });

    const thirdReference = result.current;
    expect(thirdReference).not.toBe(firstReference);
    expect(thirdReference).toEqual({ title: 'IGNIS' });
  });

  test('useDeepEqualSelector returns a stable reference for a deep-equal object across renders', () => {
    const store = createSelectorStore();

    const selectDeep = (state: TRootSelectorState) => {
      return {
        nested: {
          tag: state.selectorSlice.data.nested.tag,
        },
      };
    };

    const { result } = renderHook(
      () => {
        return useDeepEqualSelector(selectDeep);
      },
      {
        wrapper: createSelectorWrapper({ store }),
      },
    );

    const firstReference = result.current;
    expect(firstReference).toEqual({ nested: { tag: 'v1' } });

    act(() => {
      store.dispatch(selectorSlice.actions.bumpTick());
    });

    const secondReference = result.current;
    expect(secondReference).toBe(firstReference);

    act(() => {
      store.dispatch(selectorSlice.actions.setTag('v2'));
    });

    const thirdReference = result.current;
    expect(thirdReference).not.toBe(firstReference);
    expect(thirdReference).toEqual({ nested: { tag: 'v2' } });
  });
});
