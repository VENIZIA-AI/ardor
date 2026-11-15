import 'reflect-metadata';

import { catalogFeature } from '@shell-example/catalog';
import { ordersFeature } from '@shell-example/orders';
import AutoArtifacts from '@venizia/ignis-boot/auto';
import { BindingScopes } from '@venizia/ignis-inversion';

import {
  BaseArdorApplication,
  CoreBindings,
  type IApplicationInfo,
  type IArtifactIndex,
  type IFeatureBase,
  RolePermissionProvider,
} from '@venizia/ardor';

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shell', version: '0.0.0', description: 'ARDOR shell with feature packages' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [AutoArtifacts];
  }

  override features(): Array<IFeatureBase> {
    return [ordersFeature, catalogFeature];
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.PERMISSION_PROVIDER })
      .toClass(RolePermissionProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}
