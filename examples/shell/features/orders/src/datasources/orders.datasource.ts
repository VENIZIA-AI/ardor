import { CoreBindings, datasource, type IDataProvider, inject } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

import { OrdersFeature } from '../constants';

@datasource()
export class OrdersDataSource extends HttpDataSource {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) dataProvider: IDataProvider,
  ) {
    super({ baseUrl: OrdersFeature.API_URL, ...dataProvider.getDataSourceAuth() });
  }
}
