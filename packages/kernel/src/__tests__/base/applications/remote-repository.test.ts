import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';
import { inject } from '@venizia/ignis-inversion';

import { BaseArdorApplication } from '@/base/applications/abstract';
import { datasource, repository, RepositoryTypes } from '@/base/metadata';
import { HttpDataSource, HttpRepository } from '@/base/repositories';
import { type IApplicationInfo } from '@/common';

@datasource()
class CatalogDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'http://127.0.0.1:1' });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: CatalogDataSource })
class ProductRepository extends HttpRepository<{ id: string }> {
  constructor(dataSource: CatalogDataSource) {
    super({ dataSource, resource: 'products' });
  }
}

class LedgerDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'http://127.0.0.1:1' });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: LedgerDataSource })
class EntryRepository extends HttpRepository<{ id: string }> {
  constructor(dataSource: LedgerDataSource) {
    super({ dataSource, resource: 'entries' });
  }
}

class ArchiveDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'http://127.0.0.1:1' });
  }
}

// Registered by hand below, so no key is recorded yet when this class is decorated.
@repository({ type: RepositoryTypes.REMOTE, dataSource: ArchiveDataSource })
class ArchiveRepository extends HttpRepository<{ id: string }> {
  constructor(@inject({ target: ArchiveDataSource }) dataSource: ArchiveDataSource) {
    super({ dataSource, resource: 'archive' });
  }
}

class RemoteApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'remote', version: '1.0.0', description: 'REMOTE repositories' };
  }

  bindContext(): void {
    this.dataSource(LedgerDataSource);
    this.dataSource(ArchiveDataSource);
  }
}

const started = async () => {
  const application = new RemoteApplication();
  await application.start();
  return application;
};

describe('a REMOTE repository', () => {
  test('is discovered with its datasource, and the datasource is injected', async () => {
    const products = (await started()).get<ProductRepository>({
      key: 'repositories.ProductRepository',
    });

    expect(products).toBeInstanceOf(ProductRepository);
    expect(products.dataSource).toBeInstanceOf(CatalogDataSource);
  });

  test('is a singleton, like every discovered artifact', async () => {
    const application = await started();

    expect(application.get({ key: 'repositories.ProductRepository' })).toBe(
      application.get({ key: 'repositories.ProductRepository' }),
    );
  });

  test('takes a datasource registered by hand when it has no @inject', async () => {
    const entries = (await started()).get<EntryRepository>({
      key: 'repositories.EntryRepository',
    });

    expect(entries.dataSource).toBeInstanceOf(LedgerDataSource);
  });

  test('accepts @inject({ target }) naming a datasource registered by hand', async () => {
    const archive = (await started()).get<ArchiveRepository>({
      key: 'repositories.ArchiveRepository',
    });

    expect(archive.dataSource).toBeInstanceOf(ArchiveDataSource);
  });
});
