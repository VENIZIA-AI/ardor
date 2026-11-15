import { datasource, DefaultNetworkRequestService } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

@datasource()
export class CatalogDataSource extends HttpDataSource {
  constructor() {
    super({
      baseUrl: '/api',
      authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
    });
  }
}
