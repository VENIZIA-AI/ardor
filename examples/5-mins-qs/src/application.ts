import 'reflect-metadata';

import AutoArtifacts from '@venizia/ignis-boot/auto';

import { BaseArdorApplication, type IApplicationInfo, type IArtifactIndex } from '@venizia/ardor';

// The decorated classes live in their own files and this module imports none of them: the build lists
// every one under src/ in `AutoArtifacts`, and importing it here keeps the list out of any shared kit.
export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'quickstart', version: '0.0.0', description: 'ARDOR 5-minute quickstart' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [AutoArtifacts];
  }

  bindContext(): void {}
}
