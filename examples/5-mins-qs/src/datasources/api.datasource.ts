import { datasource, DefaultNetworkRequestService } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

// Declared, never listed: the build finds every decorated class under src/ and the application binds
// it. A relative baseUrl resolves against the page, and Vite proxies `/api` to the stub API.
@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({
      baseUrl: '/api',
      authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
    });
  }
}
