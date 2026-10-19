import { useInjectable, useTranslate, type TUseTranslateFn } from '@venizia/ardor';

// A type-level check, never imported or run: `tsc` (the `typecheck` script) is the test. The
// application augments `@venizia/ardor`, which re-exports the two override interfaces; the claim
// is that this merges into the real interfaces. If it stops holding, a `@ts-expect-error` below
// becomes an unused directive, or a declared key is rejected, and the typecheck fails.
declare module '@venizia/ardor' {
  interface IUseInjectableKeysOverrides {
    'services.AugmentationProbe': true;
  }
}

export const checkAugmentation = () => {
  // Declared in `admin.configuration.ts`, through the umbrella.
  const translate: TUseTranslateFn = useTranslate();
  translate('quickstart.title');

  // @ts-expect-error - 'quickstart.missing' is not a declared translation key
  translate('quickstart.missing');

  // Declared above, through the umbrella.
  useInjectable<unknown>({ key: 'services.AugmentationProbe' });

  // @ts-expect-error - 'services.Missing' is not a declared injectable key
  useInjectable<unknown>({ key: 'services.Missing' });
};
