import { DefaultRestDataProvider } from '@venizia/ardor';

import { VertNetworkService } from '@/services/vert-network.service';

// `createNetworkService` is the one place the data provider's service is built.
export class VertRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new VertNetworkService({
      name: 'vert-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      authRecovery: this.restDataProviderOptions.authRecovery,
    });
  }
}
