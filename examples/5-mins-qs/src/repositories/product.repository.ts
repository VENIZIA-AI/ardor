import { repository, RepositoryTypes } from '@venizia/ardor';
import { HttpRepository } from '@venizia/ardor/repository';

import { ApiDataSource } from '@/datasources/api.datasource';

export interface IProduct {
  id: number;
  name: string;
  price: number;
}

// One class per resource, in the IGNIS filter vocabulary. `@repository` injects the datasource, and
// `count` reads the total from `Content-Range`.
@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class ProductRepository extends HttpRepository<IProduct> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }

  countExpensive(opts: { minimumPrice: number }) {
    return this.count({ where: { price: { gte: opts.minimumPrice } } });
  }
}
