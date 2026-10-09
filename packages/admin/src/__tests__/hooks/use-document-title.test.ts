import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, renderHook } from '@testing-library/react';

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
});
