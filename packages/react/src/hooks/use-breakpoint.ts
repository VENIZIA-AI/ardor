import React from 'react';

import { MediaQueryStore } from './media-query-store';

/** The breakpoints of Tailwind: a name is reached at its width, in CSS pixels. */
export const DefaultBreakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;

const isEntry = (value: unknown): value is [string, number] => {
  return Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'number';
};

/** The table as the signature (its sorted entries as JSON) holds it, with the media query of each width. */
const parseBreakpoints = (opts: { signature: string }): Array<{ name: string; query: string }> => {
  const parsed: unknown = JSON.parse(opts.signature);

  return (Array.isArray(parsed) ? parsed : []).filter(isEntry).map(([name, width]) => {
    return { name, query: `(min-width: ${width}px)` };
  });
};

/** The current breakpoint and what to ask of it. */
export interface IBreakpoint<TName extends string> {
  /** The widest name reached, or `null` below the smallest (and in a server render). */
  name: TName | null;
  /** Whether the viewport has reached the width of `name`. */
  isAtLeast(name: TName): boolean;
  /** Whether the viewport is narrower than the width of `name`. */
  isBelow(name: TName): boolean;
}

/**
 * The current breakpoint from a table of named widths: Tailwind's by default, or `{ breakpoints }`
 * with typed names. It reads `(min-width)` media queries, so browser zoom moves it with the layout,
 * and it re-renders only when the name changes. The table is ordered by width, not by key.
 *
 * @example
 * ```tsx
 * const { name, isAtLeast } = useBreakpoint();
 * return isAtLeast('md') ? <Sidebar /> : <Drawer />;
 * ```
 */
export function useBreakpoint(opts?: {
  breakpoints?: undefined;
}): IBreakpoint<keyof typeof DefaultBreakpoints>;
export function useBreakpoint<TTable extends Record<string, number>>(opts: {
  breakpoints: TTable;
}): IBreakpoint<keyof TTable & string>;

export function useBreakpoint(opts?: {
  breakpoints?: Record<string, number>;
}): IBreakpoint<string> {
  // An inline table is a new object on every render: it is told apart by its content, sorted by width.
  const signature = JSON.stringify(
    Object.entries(opts?.breakpoints ?? DefaultBreakpoints).sort(([, a], [, b]) => a - b),
  );
  const sorted = React.useMemo(() => parseBreakpoints({ signature }), [signature]);

  const subscribe = React.useMemo(() => {
    return (listener: () => void) =>
      MediaQueryStore.subscribe({ queries: sorted.map((entry) => entry.query), listener });
  }, [sorted]);

  const name = React.useSyncExternalStore(
    subscribe,
    () => {
      let reached: string | null = null;

      for (const entry of sorted) {
        if (MediaQueryStore.matches({ query: entry.query })) {
          reached = entry.name;
        }
      }

      return reached;
    },
    () => null,
  );

  return React.useMemo(() => {
    const rank = (pick: { of: string | null }) => {
      return sorted.findIndex((entry) => entry.name === pick.of);
    };

    const isAtLeast = (target: string) =>
      name !== null && rank({ of: target }) <= rank({ of: name });

    return { name, isAtLeast, isBelow: (target: string) => !isAtLeast(target) };
  }, [name, sorted]);
}
