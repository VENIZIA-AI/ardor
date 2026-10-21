import 'reflect-metadata';

import AutoArtifacts from '@venizia/ignis-boot/auto';

import { BaseArdorApplication, type IApplicationInfo, type IArtifactIndex } from '@venizia/ardor';

// The decorated classes live in their own files and this module imports none of them: the build lists
// every one under src/ in `AutoArtifacts`.
export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: '{{app}}', version: '0.0.0', description: 'The {{app}} admin of {{project}}' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [AutoArtifacts];
  }

  bindContext(): void {}
}
