import { datasource, DefaultNetworkRequestService } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

import { CatalogFeature } from '../constants';

@datasource()
export class CatalogDataSource extends HttpDataSource {
  constructor() {
    super({
      baseUrl: CatalogFeature.API_URL,
      authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
    });
  }
}
