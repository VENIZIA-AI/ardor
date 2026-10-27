import 'reflect-metadata';

import { describe, test } from 'bun:test';

import { assertArdorApplicationBoots } from '@venizia/ardor/testing';

import { Application } from '#src/application';

// Fails the way opening the app would: a service whose injection nobody registered, a missing
// provider, a lazy locale that cannot load. No browser and no request: `fetch` is blocked for the run.
describe('Application', () => {
  test('boots', async () => {
    await assertArdorApplicationBoots(() => new Application());
  });
});
