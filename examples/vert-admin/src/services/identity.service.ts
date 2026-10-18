import {
  api,
  BaseService,
  CoreBindings,
  type IDataProvider,
  inject,
  type ISendParams,
  RequestMethods,
  service,
} from '@venizia/ardor';

import { VertPaths } from '@/constants/vert-paths';

export interface IWhoAmI {
  userId: number;
  roles: string[];
}

@service()
export class IdentityService extends BaseService {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    protected dataProvider: IDataProvider,
  ) {
    super({ scope: IdentityService.name });
  }

  @api()
  async whoAmI(): Promise<IWhoAmI> {
    const params: ISendParams = { method: RequestMethods.GET };
    const response = await this.dataProvider.send<IWhoAmI>({
      resource: VertPaths.WHO_AM_I,
      params,
    });
    return response.data;
  }
}
