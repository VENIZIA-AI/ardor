import { repository, RepositoryTypes } from '@venizia/ardor';
import { HttpRepository } from '@venizia/ardor/repository';

import { CatalogAccess, type IProduct } from '../constants';
import { CatalogDataSource } from '../datasources/catalog.datasource';

@repository({ type: RepositoryTypes.REMOTE, dataSource: CatalogDataSource })
export class ProductRepository extends HttpRepository<IProduct> {
  constructor(dataSource: CatalogDataSource) {
    super({ dataSource, resource: CatalogAccess.RESOURCE });
  }
}
