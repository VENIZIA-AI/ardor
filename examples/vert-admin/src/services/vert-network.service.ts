import {
  DefaultNetworkRequestService,
  LocalStorageKeys,
  RequestMethods,
  RequestTypes,
} from '@venizia/ardor';

import { VertPaths } from '@/constants/vert-paths';

// The refresh is a hook of the network service, so a 401 is recovered where it is seen. The refresh
// endpoint is excluded from recovery by `refreshTokenPath`, so a 401 from it surfaces and
// `onAuthFailure` runs.
export class VertNetworkService extends DefaultNetworkRequestService {
  protected override async refreshToken(): Promise<boolean> {
    const { data } = await this.doRequest<{ token: string }>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: [VertPaths.REFRESH_TOKEN],
      headers: this.getRequestHeader({ resource: VertPaths.REFRESH_TOKEN }),
    });

    // IGNIS re-issues the token from the caller's valid one; the next request reads this one.
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: data.token, type: 'Bearer' }),
    );
    return true;
  }
}
