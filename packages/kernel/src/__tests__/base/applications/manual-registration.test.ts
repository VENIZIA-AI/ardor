import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';
import { BindingScopes, inject } from '@venizia/ignis-inversion';

import { BaseArdorApplication } from '@/base/applications/abstract';
import { type IApplicationInfo } from '@/common';

class ApiClient {
  readonly baseUrl = 'https://api.example.com';
}

class OrderRepository {
  constructor(@inject({ target: ApiClient }) readonly client: ApiClient) {}
}

class AuditService {}

class ManualApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'manual', version: '1.0.0', description: 'registration by hand' };
  }

  bindContext(): void {
    this.dataSource(ApiClient);
    this.repository(OrderRepository);
    this.service(AuditService, { binding: { namespace: 'services', key: 'audit' } });
  }
}

const started = async () => {
  const application = new ManualApplication();
  await application.start();
  return application;
};

describe('registration by hand', () => {
  test('each kind binds under its namespace and the class name', async () => {
    const application = await started();

    expect(application.get({ key: 'datasources.ApiClient' })).toBeInstanceOf(ApiClient);
    expect(application.get({ key: 'repositories.OrderRepository' })).toBeInstanceOf(
      OrderRepository,
    );
  });

  // The key is recorded on the class, so `@inject({ target })` resolves a class registered by hand.
  test('@inject({ target }) resolves a class registered by hand', async () => {
    const repository = (await started()).get<OrderRepository>({
      key: 'repositories.OrderRepository',
    });

    expect(repository.client).toBeInstanceOf(ApiClient);
  });

  test('the key recorded on the class is the one it was bound under', async () => {
    const application = await started();

    expect(application.getMetadataRegistry().getBindingKey({ target: AuditService })).toBe(
      'services.audit',
    );
    expect(application.get({ key: 'services.audit' })).toBeInstanceOf(AuditService);
  });

  test('singleton by default, since a hook resolves on every render', async () => {
    const application = await started();

    expect(application.get({ key: 'repositories.OrderRepository' })).toBe(
      application.get({ key: 'repositories.OrderRepository' }),
    );
  });

  test('scope is the caller to choose', async () => {
    const application = await started();
    application.repository(OrderRepository, { scope: BindingScopes.TRANSIENT });

    expect(application.get({ key: 'repositories.OrderRepository' })).not.toBe(
      application.get({ key: 'repositories.OrderRepository' }),
    );
  });

  test('allowOverride: false refuses to replace an existing binding', async () => {
    const application = await started();

    expect(() => application.repository(OrderRepository, { allowOverride: false })).toThrow(
      /repositories\.OrderRepository.*already bound/,
    );
  });
});
