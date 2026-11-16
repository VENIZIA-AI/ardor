import { CoreBindings, datasource, type IDataProvider, inject } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

import { CatalogFeature } from '../constants';

@datasource()
export class CatalogDataSource extends HttpDataSource {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) dataProvider: IDataProvider,
  ) {
    super({ baseUrl: CatalogFeature.API_URL, ...dataProvider.getDataSourceAuth() });
  }
}
