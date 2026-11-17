import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { FakeMatchMedia } from '@venizia/ardor-kernel/testing';
import { useDocumentVisibility } from '@/hooks/use-document-visibility';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOnlineStatus } from '@/hooks/use-online-status';

let visibility: DocumentVisibilityState = 'visible';
let isOnline = true;
let stateReads = 0;

let restoreMatchMedia: (() => void) | undefined;

beforeEach(() => {
  restoreMatchMedia = FakeMatchMedia.install();
  stateReads = 0;
  visibility = 'visible';
  isOnline = true;
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => {
      stateReads += 1;

      return visibility;
    },
  });
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => {
      stateReads += 1;

      return isOnline;
    },
  });
});

afterEach(() => {
  cleanup();
  mock.restore();

  restoreMatchMedia?.();

  Reflect.deleteProperty(document, 'visibilityState');
  Reflect.deleteProperty(navigator, 'onLine');
});

describe('useMediaQuery', () => {
  test('reads whether the query matches, and follows each change', () => {
    FakeMatchMedia.set({ query: '(min-width: 600px)', matches: true });

    const { result } = renderHook(() => useMediaQuery({ query: '(min-width: 600px)' }));
    expect(result.current).toBe(true);

    act(() => {
      FakeMatchMedia.set({ query: '(min-width: 600px)', matches: false });
    });
    expect(result.current).toBe(false);
  });

  test('follows a changed query, and stops listening to the old one', () => {
    FakeMatchMedia.set({ query: '(a)', matches: true });
    FakeMatchMedia.set({ query: '(b)', matches: false });

    const { result, rerender } = renderHook((props: { query: string }) => useMediaQuery(props), {
      initialProps: { query: '(a)' },
    });
    expect(result.current).toBe(true);

    rerender({ query: '(b)' });
    expect(result.current).toBe(false);

    act(() => {
      FakeMatchMedia.set({ query: '(a)', matches: false });
      FakeMatchMedia.set({ query: '(b)', matches: true });
    });
    expect(result.current).toBe(true);
  });

  test('stops listening on unmount', () => {
    const removed = spyOn(FakeMatchMedia.of('(a)'), 'removeEventListener');

    const { unmount } = renderHook(() => useMediaQuery({ query: '(a)' }));
    unmount();

    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0]?.[0]).toBe('change');
  });

  test('a server render gives false and does not touch matchMedia', () => {
    const Probe = () => React.createElement('p', null, String(useMediaQuery({ query: '(a)' })));

    expect(renderToString(React.createElement(Probe))).toContain('false');
    expect(FakeMatchMedia.queries.size).toBe(0);
  });
});

describe('useDocumentVisibility', () => {
  test('reads the visibility state, and follows visibilitychange', () => {
    visibility = 'hidden';

    const { result } = renderHook(() => useDocumentVisibility());
    expect(result.current).toBe('hidden');

    act(() => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('visible');
  });

  test('stops listening on unmount', () => {
    const removed = spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useDocumentVisibility());
    unmount();

    expect(removed.mock.calls.map((call) => call[0])).toContain('visibilitychange');
  });

  test('a server render gives visible and does not read the document', () => {
    visibility = 'hidden';
    const Probe = () => React.createElement('p', null, useDocumentVisibility());

    expect(renderToString(React.createElement(Probe))).toContain('visible');
    expect(stateReads).toBe(0);
  });
});

describe('useOnlineStatus', () => {
  test('reads navigator.onLine, and follows the offline and online events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      isOnline = false;
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      isOnline = true;
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  test('stops listening to both events on unmount', () => {
    const removed = spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    const types = removed.mock.calls.map((call) => call[0]);
    expect(types).toContain('online');
    expect(types).toContain('offline');
  });

  test('a server render gives true and does not read navigator', () => {
    isOnline = false;
    const Probe = () => React.createElement('p', null, String(useOnlineStatus()));

    expect(renderToString(React.createElement(Probe))).toContain('true');
    expect(stateReads).toBe(0);
  });
});
