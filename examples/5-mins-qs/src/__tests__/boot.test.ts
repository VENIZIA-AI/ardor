import 'reflect-metadata';

import { describe, test } from 'bun:test';

import { assertArdorApplicationBoots } from '@venizia/ardor/testing';

import { Application } from '@/application';

describe('Application', () => {
  test('boots, with every binding and the messages of its locales', async () => {
    await assertArdorApplicationBoots(() => new Application());
  });
});
