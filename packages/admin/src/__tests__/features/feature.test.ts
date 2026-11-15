import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { cleanup, renderHook } from '@testing-library/react';

import { Features, type TFeature } from '@/features/feature';
import { useFeatures } from '@/hooks/use-features';
import { BaseHelper } from '@venizia/ignis-helpers/core';
import { CoreBindings } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@venizia/ardor-react';
import { Container } from '@venizia/ignis-inversion';

const List = () => null;

// What a shell adds on top: the industries a feature serves, typed through the extension parameter.
interface IIndustryExtension {
  industries: Array<string>;
}

const inventory = Features.define<IIndustryExtension>({
  name: 'inventory',
  resources: [{ name: 'stocks', list: List }],
  routes: [{ path: '/stock-report', element: null }],
  industries: ['retail'],
});

const commerce = Features.define<IIndustryExtension>({
  name: 'commerce',
  resources: [{ name: 'orders', list: List }],
  industries: ['retail', 'food'],
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

  test('throws on a route that has access and is public, naming its path', () => {
    const contradiction = Features.define({
      name: 'contradiction',
      routes: [
        {
          path: '/audit',
          element: null,
          access: { resource: 'audit', action: 'list' },
          auth: { use: false },
        },
      ],
    });

    expect(() => Features.mount({ features: [contradiction] })).toThrow(
      "[features] Route '/audit' of 'contradiction' has access and auth: { use: false }",
    );
  });

  test('throws on a route path the application and a feature both mount, naming both', () => {
    expect(() =>
      Features.mount({
        features: [inventory],
        routes: [{ path: 'stock-report', element: null }],
      }),
    ).toThrow(
      "[features] Route '/stock-report' is mounted by both 'the application' and 'inventory'",
    );
  });

  test('throws on a route path two features both mount', () => {
    const shadow = Features.define({
      name: 'shadow',
      routes: [{ path: '/stock-report', element: null }],
    });

    expect(() => Features.mount({ features: [inventory, shadow] })).toThrow(
      "[features] Route '/stock-report' is mounted by both 'inventory' and 'shadow'",
    );
  });

  test('throws on a route whose path is the path of a resource', () => {
    const shadow = Features.define({
      name: 'shadow',
      routes: [{ path: '/orders', element: null }],
    });

    expect(() => Features.mount({ features: [commerce, shadow] })).toThrow(
      "[features] Route '/orders' is mounted by both 'commerce' (resource 'orders') and 'shadow'",
    );
  });

  test('throws on a route with neither an id nor a path', () => {
    const pathless = Features.define({ name: 'pathless', routes: [{ element: null }] });

    expect(() => Features.mount({ features: [pathless] })).toThrow(
      "[features] A route of 'pathless' has neither an id nor a path",
    );
  });

  test('accepts a pathless route that has an id', () => {
    const shell = Features.define({
      name: 'shell',
      routes: [{ id: 'shell-layout', element: null }],
    });

    expect(Features.mount({ features: [shell] }).routes).toHaveLength(1);
  });
});

describe('useFeatures', () => {
  test("returns the application's features, typed with the shell's extension", () => {
    const container = containerWith({ features: [inventory, commerce] });
    const wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        ApplicationContext.Provider,
        {
          value: { container, logger: new BaseHelper({ scope: 'test' }).logger },
        },
        children,
      );

    const { result } = renderHook(() => useFeatures<TFeature<IIndustryExtension>>(), { wrapper });

    expect(result.current.map((feature) => feature.industries)).toEqual([
      ['retail'],
      ['retail', 'food'],
    ]);
  });
});
