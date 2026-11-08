import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GatesRefreshed } from '../gates-refreshed';

const ROOT = resolve(import.meta.dir, '..', '..', '..');
const workflow = readFileSync(resolve(ROOT, GatesRefreshed.WORKFLOW), 'utf8');

const REFRESH = ['bun scripts/build/refresh-catalog.ts "$CATALOG_TAG"'];

describe('make gates-refreshed replays the refresh of the Test job of package-release.yml', () => {
  test('it runs the line of the workflow step, as it is written there', () => {
    expect(GatesRefreshed.refreshCommands({ workflow })).toEqual(REFRESH);
    expect(workflow).toContain(`        run: |\n          ${REFRESH.join('\n          ')}\n`);
  });

  test('it takes the VULCAN of the Gates step', () => {
    expect(GatesRefreshed.vulcanCmd({ workflow })).toMatch(/^bun x @venizia\/vulcan@\d+\.\d+\.\d+/);
  });

  test('refresh runs before install, install before gates, and the clean install last', () => {
    const steps = GatesRefreshed.steps({ workflow });

    expect(steps.map((step) => step.label)).toEqual([
      GatesRefreshed.REFRESH_STEP,
      'Install',
      GatesRefreshed.GATES_STEP,
      GatesRefreshed.CLEAN_INSTALL_STEP,
    ]);
    expect(steps.map((step) => step.script)).toEqual([
      REFRESH.join('\n'),
      'bun install',
      'make gates',
      'make clean-install',
    ]);
  });

  test('the workflow orders the same steps the same way', () => {
    const at = (name: string) => workflow.indexOf(`- name: ${name}\n`);

    expect(at(GatesRefreshed.REFRESH_STEP)).toBeGreaterThan(-1);
    expect(at(GatesRefreshed.REFRESH_STEP)).toBeLessThan(at('Install'));
    expect(at('Install')).toBeLessThan(at(GatesRefreshed.GATES_STEP));
  });

  describe('a drifted workflow fails the parser instead of running something else', () => {
    const inTestJob = (mutate: (job: string) => string): string => {
      const job = GatesRefreshed.testJobOf({ workflow });

      return workflow.replace(job, mutate(job));
    };

    test('the refresh step is renamed', () => {
      const drifted = inTestJob((job) =>
        job.replace(`- name: ${GatesRefreshed.REFRESH_STEP}`, '- name: Update the catalog'),
      );

      expect(() => GatesRefreshed.refreshCommands({ workflow: drifted })).toThrow(
        /no step 'Refresh the catalog'/,
      );
    });

    test('the line of the refresh block changes', () => {
      const drifted = inTestJob((job) =>
        job.replace('refresh-catalog.ts "$CATALOG_TAG"', 'refresh-catalog.ts highest'),
      );

      expect(() => GatesRefreshed.refreshCommands({ workflow: drifted })).toThrow(
        /not the refresh command/,
      );
    });

    test('a line is added to the refresh block', () => {
      const drifted = inTestJob((job) =>
        job.replace(
          '          bun scripts/build/refresh-catalog.ts "$CATALOG_TAG"\n',
          '          bun scripts/build/refresh-catalog.ts "$CATALOG_TAG"\n          bun scripts/other.ts\n',
        ),
      );

      expect(() => GatesRefreshed.refreshCommands({ workflow: drifted })).toThrow(
        /not the refresh command/,
      );
    });

    test('the Gates step sets no VULCAN_CMD', () => {
      const drifted = inTestJob((job) => job.replace('VULCAN_CMD:', 'OTHER_CMD:'));

      expect(() => GatesRefreshed.vulcanCmd({ workflow: drifted })).toThrow(/sets no VULCAN_CMD/);
    });

    test('there is no test job', () => {
      const drifted = workflow.replace('\n  test:\n', '\n  checks:\n');

      expect(() => GatesRefreshed.steps({ workflow: drifted })).toThrow(/no 'test' job/);
    });
  });
});
