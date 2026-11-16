import 'reflect-metadata';

import { describe, test } from 'bun:test';

import { assertArdorApplicationBoots } from '@venizia/ardor/testing';

import { Application } from '@/application';

describe('Application', () => {
  test('boots with both features, every binding and the messages of both locales', async () => {
    await assertArdorApplicationBoots(() => new Application());
  });
});
