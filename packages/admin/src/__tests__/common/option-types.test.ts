import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { CoreBindings, provideOption } from '@venizia/ardor-kernel';
import { MetadataRegistry } from '@venizia/ignis-kernel/metadata';
import type { II18nProviderOptions } from '@/common';

class I18nOptions {
  @provideOption({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  options(): II18nProviderOptions {
    return { languages: [{ locale: 'en', name: 'English' }] };
  }
}

class RefusedI18nOptions {
  // @ts-expect-error the i18n options are not a number
  @provideOption({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  wrongReturnType() {
    return 42;
  }

  // @ts-expect-error languages is a list of locales
  @provideOption({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  wrongField() {
    return { languages: 5 };
  }
}

describe('ICoreOptionTypes, as the admin package extends it', () => {
  test('the i18n options key takes II18nProviderOptions', () => {
    expect(MetadataRegistry.getInstance().getProvideMetadata({ target: I18nOptions })).toEqual([
      { methodName: 'options', key: CoreBindings.I18N_PROVIDER_OPTIONS },
    ]);
    expect(new RefusedI18nOptions().wrongReturnType()).toBe(42);
  });
});
