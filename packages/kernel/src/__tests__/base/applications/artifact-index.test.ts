import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { BaseArdorApplication } from '@/base/applications/abstract';
import { component, configuration, service } from '@/base/metadata';
import { type IApplicationInfo, type IArtifactIndex } from '@/common';
import { rejectionOf } from '@/__tests__/rejection';

@service()
class IndexedService {}

@component()
class IndexedComponent {}

@configuration()
class IndexedConfiguration {}

// Never decorated: an index that lists it names a class discovery never saw.
class ForgottenService {}
class ForgottenConfiguration {}

// The exact shape `ignis-artifacts generate` emits, empty kinds included.
const generated: IArtifactIndex = {
  configurations: [IndexedConfiguration],
  dataSources: [],
  components: [IndexedComponent],
  repositories: [],
  services: [IndexedService],
  controllers: [],
};

const createApplication = (opts: { artifacts: Array<IArtifactIndex> }) => {
  class IndexedApplication extends BaseArdorApplication {
    getAppInfo(): IApplicationInfo {
      return { name: 'artifact-index', version: '1.0.0', description: 'generated artifact index' };
    }

    override artifacts(): Array<IArtifactIndex> {
      return opts.artifacts;
    }

    bindContext(): void {}
  }

  return new IndexedApplication();
};

describe('AbstractArdorApplication.artifacts', () => {
  test('starts with a generated index whose every class was discovered, and binds them', async () => {
    const application = createApplication({ artifacts: [generated] });
    await application.start();

    expect(application.get({ key: 'services.IndexedService' })).toBeInstanceOf(IndexedService);
    expect(application.get({ key: 'components.IndexedComponent' })).toBeInstanceOf(
      IndexedComponent,
    );
  });

  test('throws when an index lists a class that was never discovered', async () => {
    const application = createApplication({
      artifacts: [{ ...generated, services: [IndexedService, ForgottenService] }],
    });

    expect(await rejectionOf(application.start())).toMatchObject({
      message: expect.stringMatching(
        /\[artifacts\] 'services' lists ForgottenService, which was never discovered/,
      ),
    });
  });

  /**
   * The positive control for the check above: it reads every kind of every index, not only the
   * first index or the `services` field.
   */
  test('checks every kind of every index', async () => {
    const application = createApplication({
      artifacts: [generated, { configurations: [ForgottenConfiguration] }],
    });

    expect(await rejectionOf(application.start())).toMatchObject({
      message: expect.stringMatching(
        /\[artifacts\] 'configurations' lists ForgottenConfiguration, which was never discovered/,
      ),
    });
  });
});
