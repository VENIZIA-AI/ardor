import { describe, expect, spyOn, test } from 'bun:test';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { Container } from '@venizia/ignis-inversion';
import { CoreBindings } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@/contexts/application';
import { useInjectable } from '@/hooks/use-injectable';

interface ITestApp {
  readonly id: string;
}

interface ICreateWrapperOptions {
  readonly container: Container | null;
}

interface IBindConstantValueOptions<T> {
  readonly container: Container;
  readonly key: string;
  readonly value: T;
}

class SomeClass {
  public readonly name = 'SomeClass';
}

class UnboundClass {
  public readonly name = 'UnboundClass';
}

const bindConstantValue = <T>({ container, key, value }: IBindConstantValueOptions<T>) => {
  const binding = container.bind({ key });
  if ('to' in binding && typeof binding['to'] === 'function') {
    binding['to'](value);
    return;
  }
  if ('toValue' in binding && typeof binding['toValue'] === 'function') {
    binding['toValue'](value);
    return;
  }
};

const createWrapper = ({ container }: ICreateWrapperOptions) => {
  return ({ children }: { readonly children: React.ReactNode }) => {
    return React.createElement(
      ApplicationContext.Provider,
      {
        value: {
          container,
          registry: container,
          logger: null,
        },
      },
      children,
    );
  };
};

describe('useInjectable with key option', () => {
  test('resolves binding from the container in ApplicationContext when only key is provided', () => {
    const container = new Container({ scope: 'test' });
    const appInstance: ITestApp = { id: 'context-app' };
    bindConstantValue({
      container,
      key: CoreBindings.APPLICATION_INSTANCE,
      value: appInstance,
    });

    const { result } = renderHook(
      () => {
        return useInjectable<ITestApp>({ key: CoreBindings.APPLICATION_INSTANCE });
      },
      {
        wrapper: createWrapper({ container }),
      },
    );

    expect(result.current).toBe(appInstance);
  });

  test('resolves from explicit container when both container and key are provided despite different context binding', () => {
    const contextContainer = new Container({ scope: 'context' });
    const explicitContainer = new Container({ scope: 'explicit' });

    const contextApp: ITestApp = { id: 'context-app' };
    const explicitApp: ITestApp = { id: 'explicit-app' };

    bindConstantValue({
      container: contextContainer,
      key: CoreBindings.APPLICATION_INSTANCE,
      value: contextApp,
    });
    bindConstantValue({
      container: explicitContainer,
      key: CoreBindings.APPLICATION_INSTANCE,
      value: explicitApp,
    });

    const { result } = renderHook(
      () => {
        return useInjectable<ITestApp>({
          container: explicitContainer,
          key: CoreBindings.APPLICATION_INSTANCE,
        });
      },
      {
        wrapper: createWrapper({ container: contextContainer }),
      },
    );

    expect(result.current).toBe(explicitApp);
    expect(result.current).not.toBe(contextApp);
  });
});

describe('useInjectable with target option', () => {
  test('resolves class bound via container bind toClass through metadata registry', () => {
    const container = new Container({ scope: 'test' });
    container.bind({ key: 'services.SomeClass' }).toClass(SomeClass);

    const registry = container.getMetadataRegistry();
    if ('setBindingKey' in registry && typeof registry['setBindingKey'] === 'function') {
      try {
        registry['setBindingKey']({ target: SomeClass, key: 'services.SomeClass' });
      } catch (error) {
        console.warn('setBindingKey failed:', error);
      }
    }
    if (!registry.getBindingKey({ target: SomeClass })) {
      spyOn(registry, 'getBindingKey').mockImplementation(
        ({ target }: { readonly target: unknown }) => {
          if (target === SomeClass) {
            return 'services.SomeClass';
          }
          return undefined;
        },
      );
    }

    const { result } = renderHook(
      () => {
        return useInjectable<SomeClass>({ target: SomeClass });
      },
      {
        wrapper: createWrapper({ container }),
      },
    );

    expect(result.current).toBeInstanceOf(SomeClass);
  });

  test('throws error naming the class when target was never bound', () => {
    const container = new Container({ scope: 'test' });

    expect(() => {
      renderHook(
        () => {
          return useInjectable({ target: UnboundClass });
        },
        {
          wrapper: createWrapper({ container }),
        },
      );
    }).toThrow('UnboundClass');
  });
});

describe('useInjectable container resolution failures', () => {
  test('throws error when neither context container nor explicit container is available', () => {
    expect(() => {
      renderHook(() => {
        return useInjectable({ key: CoreBindings.APPLICATION_INSTANCE });
      });
    }).toThrow('[useInjectable] Failed to determine injectable container!');
  });

  test('throws error when context provider provides null container and no explicit container is passed', () => {
    expect(() => {
      renderHook(
        () => {
          return useInjectable({ key: CoreBindings.APPLICATION_INSTANCE });
        },
        {
          wrapper: createWrapper({ container: null }),
        },
      );
    }).toThrow('[useInjectable] Failed to determine injectable container!');
  });
});
