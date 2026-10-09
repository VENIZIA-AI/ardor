import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { cleanup, render, renderHook } from '@testing-library/react';

import { type IUseDocumentTitleOptions, useDocumentTitle } from '@/hooks/use-document-title';

const ORIGINAL_TITLE = 'index.html title';

describe('useDocumentTitle', () => {
  beforeEach(() => {
    document.title = ORIGINAL_TITLE;
  });

  afterEach(() => {
    cleanup();
  });

  test('puts the screen title before appTitle with the default separator', () => {
    renderHook(() => {
      useDocumentTitle({ title: 'Orders', appTitle: 'Back Office' });
    });

    expect(document.title).toBe('Orders · Back Office');
  });

  test('joins an array of segments and skips the empty ones', () => {
    renderHook(() => {
      useDocumentTitle({
        title: ['Order #12', false, null, undefined, '', 'Orders'],
        appTitle: 'Back Office',
        separator: ' | ',
      });
    });

    expect(document.title).toBe('Order #12 | Orders | Back Office');
  });

  test('shows appTitle alone when the screen has no title yet', () => {
    renderHook(() => {
      useDocumentTitle({ title: undefined, appTitle: 'Back Office' });
    });

    expect(document.title).toBe('Back Office');
  });

  test('leaves the title untouched when disabled', () => {
    renderHook(() => {
      useDocumentTitle({ title: 'Orders', appTitle: 'Back Office', enabled: false });
    });

    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  test('follows a title change and puts back the original title on unmount', () => {
    const { rerender, unmount } = renderHook(
      (props: IUseDocumentTitleOptions) => {
        useDocumentTitle(props);
      },
      { initialProps: { title: 'Orders', appTitle: 'Back Office' } },
    );

    rerender({ title: 'Order #12', appTitle: 'Back Office' });
    expect(document.title).toBe('Order #12 · Back Office');

    unmount();
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  test('keeps the screen title across a re-render with the same title', () => {
    const { rerender } = renderHook(
      (props: IUseDocumentTitleOptions) => {
        useDocumentTitle(props);
      },
      { initialProps: { title: 'Order', appTitle: 'Back Office' } },
    );

    rerender({ title: 'Order', appTitle: 'Back Office' });

    expect(document.title).toBe('Order · Back Office');
  });

  test('leaves a title someone else wrote after it in place on unmount', () => {
    const { unmount } = renderHook(() => {
      useDocumentTitle({ title: 'Orders', appTitle: 'Manager' });
    });

    // A layout re-mounted for a new locale writes its own default before this hook is cleaned up.
    document.title = 'Quản lý';
    unmount();

    expect(document.title).toBe('Quản lý');
  });

  test('puts back the original title when two calls with the same title unmount together', () => {
    const Titled = () => {
      useDocumentTitle({ title: 'Orders', appTitle: 'Manager' });
      return null;
    };
    const Screen = () =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Titled),
        React.createElement(Titled),
      );

    const { unmount } = render(React.createElement(Screen));
    expect(document.title).toBe('Orders · Manager');

    unmount();

    expect(document.title).toBe(ORIGINAL_TITLE);
  });
});
