import { datasource, DefaultNetworkRequestService } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

import { OrdersFeature } from '../constants';

@datasource()
export class OrdersDataSource extends HttpDataSource {
  constructor() {
    super({
      baseUrl: OrdersFeature.API_URL,
      authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
    });
  }
}
