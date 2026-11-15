import { useQueries } from '@tanstack/react-query';
import { useAuthProvider } from 'ra-core';
import React from 'react';

import type { IMenuEntry, IRouteAccess } from '@/features/feature';
import { useFeatures } from './use-features';

/** A menu entry with the name of the feature that declares it. */
export type TFeatureMenuEntry = IMenuEntry & { feature: string };

const accessKey = (opts: { access: IRouteAccess }) => {
  return JSON.stringify([opts.access.resource, opts.access.action]);
};

/**
 * The menu entries of the mounted features, in feature order, that the current user may open: an
 * entry without `access` always, one with `access` once the auth provider's `canAccess` allows it.
 * While a check is pending, or when it fails, the entry is left out. With no `canAccess` (no sign-in,
 * or no permission provider) every entry is listed. Call it inside `ArdorApplication`, such as in a
 * layout; the answers share react-admin's `['auth', 'canAccess']` cache.
 */
export const useMenuEntries = (): Array<TFeatureMenuEntry> => {
  const features = useFeatures();
  const authProvider = useAuthProvider();

  const entries = React.useMemo(() => {
    return features.flatMap((feature) => {
      return (feature.menu ?? []).map((entry) => ({ ...entry, feature: feature.name }));
    });
  }, [features]);

  const checks = React.useMemo(() => {
    const unique = new Map<string, IRouteAccess>();

    for (const entry of entries) {
      if (entry.access) {
        unique.set(accessKey({ access: entry.access }), entry.access);
      }
    }

    return [...unique.entries()];
  }, [entries]);

  const canAccess = authProvider?.canAccess;
  const supportAbortSignal = authProvider?.supportAbortSignal === true;

  const answers = useQueries({
    queries: checks.map(([, access]) => ({
      queryKey: ['auth', 'canAccess', { action: access.action, resource: access.resource }],
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        if (!canAccess) {
          return Promise.resolve(true);
        }

        return canAccess({
          resource: access.resource,
          action: access.action,
          signal: supportAbortSignal ? signal : undefined,
        });
      },
      enabled: canAccess !== undefined,
      retry: false,
    })),
  });

  const allowed = checks
    .filter((_check, position) => answers[position]?.data === true)
    .map(([key]) => key)
    .join('\n');

  return React.useMemo(() => {
    if (!canAccess) {
      return entries;
    }

    const keys = new Set(allowed.split('\n'));

    return entries.filter((entry) => {
      return !entry.access || keys.has(accessKey({ access: entry.access }));
    });
  }, [entries, canAccess, allowed]);
};
