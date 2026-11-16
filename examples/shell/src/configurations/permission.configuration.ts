import { CatalogPermissions } from '@shell-example/catalog';
import { OrdersPermissions } from '@shell-example/orders';
import {
  configuration,
  CoreBindings,
  type IRolePermissionProviderOptions,
  provide,
} from '@venizia/ardor';

import { Roles } from '@/constants/shell';

@configuration()
export class PermissionConfiguration {
  @provide({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })
  permissionOptions(): IRolePermissionProviderOptions {
    return {
      grants: {
        [Roles.ADMIN]: ['*'],
        [Roles.VIEWER]: [OrdersPermissions.LIST, CatalogPermissions.LIST],
      },
    };
  }
}
