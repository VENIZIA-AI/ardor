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

// What IGNIS's `ArtifactGroup` looks like to a reader: a brand, the folder and module it came from,
// and a flat index as `content` when a bundler plugin inlined it. Its kind fields are getters that
// throw, so a check that reads `group.services` fails the boot.
class FakeArtifactGroup {
  readonly isArtifactGroup = true as const;
  readonly folder: string | undefined = undefined;
  readonly site: string | undefined = undefined;

  constructor(readonly content: IArtifactIndex | undefined) {}

  get services(): never {
    throw new Error('a group has no services until it is resolved');
  }
}

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

  describe('with an IGNIS artifact group', () => {
    test('starts, checking the inlined content', async () => {
      const application = createApplication({
        artifacts: [new FakeArtifactGroup({ services: [IndexedService] }) as IArtifactIndex],
      });
      await application.start();

      expect(application.get({ key: 'services.IndexedService' })).toBeInstanceOf(IndexedService);
    });

    test('starts when the group carries no content, there is nothing to check', async () => {
      const application = createApplication({
        artifacts: [new FakeArtifactGroup(undefined) as IArtifactIndex],
      });

      expect(await application.start()).toBeUndefined();
    });

    test('throws when the inlined content lists a class that was never discovered', async () => {
      const application = createApplication({
        artifacts: [new FakeArtifactGroup({ services: [ForgottenService] }) as IArtifactIndex],
      });

      expect(await rejectionOf(application.start())).toMatchObject({
        message: expect.stringMatching(
          /\[artifacts\] 'services' lists ForgottenService, which was never discovered/,
        ),
      });
    });
  });
});
