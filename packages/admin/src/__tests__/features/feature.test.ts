import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { cleanup, renderHook } from '@testing-library/react';

import { Features, type TFeature } from '@/features/feature';
import { useFeatures } from '@/hooks/use-features';
import { CoreBindings, Logger } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@venizia/ardor-react';
import { Container } from '@venizia/ignis-inversion';

const List = () => null;

// What a shell adds on top: BANA's menu entries, typed through the extension parameter.
interface IMenuExtension {
  menu: Array<{ id: string; label: string }>;
}

const inventory = Features.define<IMenuExtension>({
  name: 'inventory',
  resources: [{ name: 'stocks', list: List }],
  routes: [{ path: '/stock-report', element: null }],
  menu: [{ id: 'stocks', label: 'inventory.menu.stocks' }],
});

const commerce = Features.define<IMenuExtension>({
  name: 'commerce',
  resources: [{ name: 'orders', list: List }],
  menu: [{ id: 'orders', label: 'commerce.menu.orders' }],
});

const containerWith = (opts: { features?: Array<TFeature> }) => {
  const container = new Container();
  if (opts.features) {
    container.bind({ key: CoreBindings.FEATURES }).toValue(opts.features);
  }
  return container;
};

afterEach(() => {
  cleanup();
});

describe('Features.read', () => {
  test('reads the features the application bound', () => {
    expect(
      Features.read({ container: containerWith({ features: [inventory, commerce] }) }),
    ).toEqual([inventory, commerce]);
  });

  test('reads none from a container that holds no list', () => {
    expect(Features.read({ container: containerWith({}) })).toEqual([]);
  });
});

describe('Features.mount', () => {
  test("mounts the application's own resources and routes first, then each feature's in order", () => {
    const mounted = Features.mount({
      features: [inventory, commerce],
      resources: [{ name: 'dashboard', list: List }],
      routes: [{ path: '/settings', element: null }],
    });

    expect(mounted.resources.map((resource) => resource.name)).toEqual([
      'dashboard',
      'stocks',
      'orders',
    ]);
    expect(mounted.routes.map((route) => route.path)).toEqual(['/settings', '/stock-report']);
  });

  test('mounts features alone when the application declares no resources or routes', () => {
    const mounted = Features.mount({ features: [commerce] });

    expect(mounted.resources.map((resource) => resource.name)).toEqual(['orders']);
    expect(mounted.routes).toEqual([]);
  });

  // react-admin keeps one of two same-named resources and drops the other without a word.
  test('throws on a resource name two features both mount, naming both', () => {
    const shadow = Features.define({ name: 'shadow', resources: [{ name: 'stocks', list: List }] });

    expect(() => Features.mount({ features: [inventory, shadow] })).toThrow(
      "[features] Resource 'stocks' is mounted by both 'inventory' and 'shadow'",
    );
  });

  test('throws on a feature resource the application already mounts', () => {
    expect(() =>
      Features.mount({ features: [inventory], resources: [{ name: 'stocks', list: List }] }),
    ).toThrow("[features] Resource 'stocks' is mounted by both 'the application' and 'inventory'");
  });
});

describe('useFeatures', () => {
  test("returns the application's features, typed with the shell's extension", () => {
    const container = containerWith({ features: [inventory, commerce] });
    const wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        ApplicationContext.Provider,
        {
          value: { container, logger: Logger.getInstance({ scope: 'test' }) },
        },
        children,
      );

    const { result } = renderHook(() => useFeatures<TFeature<IMenuExtension>>(), { wrapper });

    expect(result.current.flatMap((feature) => feature.menu.map((entry) => entry.id))).toEqual([
      'stocks',
      'orders',
    ]);
  });
});
