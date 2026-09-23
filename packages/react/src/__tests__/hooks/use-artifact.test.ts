import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderHook } from '@testing-library/react';

import { BindingScopes, Container } from '@venizia/ignis-inversion';
// From ARDOR's own surface, not `@venizia/ignis-kernel/metadata` directly: this is the import a
// consumer writes, so the test fails if the re-export ever stops carrying the stereotypes.
import { component, datasource, repository, service } from '@venizia/ardor-kernel';
import { HttpDataSource, HttpRepository } from '@venizia/ardor-kernel/repository';

import { ApplicationContext } from '@/contexts/application';
import { useComponent, useProvider, useRepository, useService } from '@/hooks/use-artifact';

@service()
class AuditService {
  readonly label = 'AuditService';
}

@datasource()
class TicketDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'http://127.0.0.1:1' });
  }
}

// `model` is unused over HTTP; switch to `type: RepositoryTypes.REMOTE` once IGNIS ships it.
@repository({ model: { name: 'tickets' } as never, dataSource: TicketDataSource })
class TicketRepository extends HttpRepository<{ id: string }> {
  constructor(dataSource: TicketDataSource) {
    super({ dataSource, resource: 'tickets' });
  }
}

@component()
class MailComponent {
  readonly label = 'MailComponent';
}

const createContainer = (): Container => {
  const container = new Container();

  container
    .bind({ key: 'services.AuditService' })
    .toClass(AuditService)
    .setScope(BindingScopes.SINGLETON);
  container
    .bind({ key: 'datasources.TicketDataSource' })
    .toClass(TicketDataSource)
    .setScope(BindingScopes.SINGLETON);
  container
    .bind({ key: 'repositories.TicketRepository' })
    .toClass(TicketRepository)
    .setScope(BindingScopes.SINGLETON);
  container
    .bind({ key: 'components.MailComponent' })
    .toClass(MailComponent)
    .setScope(BindingScopes.SINGLETON);

  return container;
};

const createWrapper = ({ container }: { container: Container }) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      ApplicationContext.Provider,
      { value: { container, registry: null, logger: null } },
      children,
    );
};

describe('the per-stereotype hooks', () => {
  /**
   * A witness at the TYPE level as much as the runtime one. `useService({ target: AuditService })`
   * must return an `AuditService` with no generic written down - the target already carries the
   * type, and a hook that made the caller repeat it would be a second place to get it wrong.
   *
   * The assertion is the `@ts-expect-error`, NOT an annotation. `AnyType` is `any`, so
   * `const x: AuditService = result.current` compiles just as happily when inference has collapsed
   * to `any` - it would witness nothing. A deliberately wrong assignment only errors while the type
   * is real; the moment it degrades, the error disappears, the directive becomes unused, and
   * `make typecheck-all` fails on that.
   */
  test('infers the artifact type from target, with no generic written down', () => {
    const wrapper = createWrapper({ container: createContainer() });
    const { result } = renderHook(() => useService({ target: AuditService }), { wrapper });

    // @ts-expect-error `AuditService` is not assignable to `number` - and if this stops erroring,
    // inference has collapsed to `any` and the hook no longer types anything.
    const collapsed: number = result.current;

    expect(collapsed).toBeInstanceOf(AuditService);
    expect(result.current.label).toBe('AuditService');
  });

  test('useService resolves a @service class by target', () => {
    const wrapper = createWrapper({ container: createContainer() });
    const { result } = renderHook(() => useService({ target: AuditService }), { wrapper });

    expect(result.current).toBeInstanceOf(AuditService);
    expect(result.current.label).toBe('AuditService');
  });

  test('useComponent resolves a @component class by target', () => {
    const wrapper = createWrapper({ container: createContainer() });
    const { result } = renderHook(() => useComponent({ target: MailComponent }), {
      wrapper,
    });

    expect(result.current).toBeInstanceOf(MailComponent);
  });

  /**
   * The reason these hooks are not aliases. Without the namespace assertion this call would return a
   * `MailComponent` and the caller would find out when a method it expected was missing.
   */
  test('useService refuses a class bound under another namespace, naming both', () => {
    const wrapper = createWrapper({ container: createContainer() });

    expect(() => renderHook(() => useService({ target: MailComponent }), { wrapper })).toThrow(
      /components\.MailComponent.*services/s,
    );
  });

  test('useProvider refuses a @service class the same way', () => {
    const wrapper = createWrapper({ container: createContainer() });

    expect(() => renderHook(() => useProvider({ target: AuditService }), { wrapper })).toThrow(
      /services\.AuditService.*providers/s,
    );
  });

  test('a key is the caller to be wrong about, and is passed through unchecked', () => {
    const wrapper = createWrapper({ container: createContainer() });
    const { result } = renderHook(
      () => useService<MailComponent>({ key: 'components.MailComponent' as never }),
      { wrapper },
    );

    expect(result.current).toBeInstanceOf(MailComponent);
  });

  test('useRepository resolves a @repository class by target', () => {
    const wrapper = createWrapper({ container: createContainer() });
    const { result } = renderHook(() => useRepository({ target: TicketRepository }), { wrapper });

    expect(result.current).toBeInstanceOf(TicketRepository);
    expect(result.current.dataSource).toBeInstanceOf(TicketDataSource);
  });

  test('useRepository refuses a @service class, naming both namespaces', () => {
    const wrapper = createWrapper({ container: createContainer() });

    expect(() => renderHook(() => useRepository({ target: AuditService }), { wrapper })).toThrow(
      /services\.AuditService.*repositories/s,
    );
  });
});
