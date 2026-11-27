import { HTTP } from '@venizia/ignis-helpers/common';
import {
  api,
  BaseService,
  CoreBindings,
  type IDataProvider,
  inject,
  type IResponseSchema,
  type ISendParams,
  service,
} from '@venizia/ardor';
import { getError } from '@venizia/ignis-inversion';

import { VertPaths } from '@/constants/vert-paths';

export interface IWhoAmI {
  userId: number;
  roles: string[];
}

const isWhoAmI = (value: unknown): value is IWhoAmI =>
  typeof value === 'object' &&
  value !== null &&
  'userId' in value &&
  typeof value.userId === 'number' &&
  'roles' in value &&
  Array.isArray(value.roles) &&
  value.roles.every((role) => typeof role === 'string');

// What `send` checks the answer against; a zod schema would do the same.
const WHO_AM_I: IResponseSchema<IWhoAmI> = {
  parse: (data) => {
    if (!isWhoAmI(data)) {
      throw getError({ message: '[whoAmI] the answer is not an identity' });
    }

    return data;
  },
};

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
    const params: ISendParams = { method: HTTP.Methods.GET };
    const response = await this.dataProvider.send({
      resource: VertPaths.WHO_AM_I,
      params,
      schema: WHO_AM_I,
    });

    return response.data;
  }
}
