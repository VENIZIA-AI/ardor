import {
  Ardor,
  BindingKeys,
  useInjectable,
  useTranslate,
  type TUseTranslateFn,
} from '@venizia/ardor';

// A type-level check, never imported or run: `tsc` (the `typecheck` script) is the test. The
// translation keys are declared by the application's augmentation of `@venizia/ardor`, and an
// injectable key carries the type of its value. If either stops holding, a `@ts-expect-error` below
// becomes an unused directive, or a declared key is rejected, and the typecheck fails.
const PROBE = BindingKeys.build<{ ok: true }>({ key: 'services.AugmentationProbe' });

export const checkAugmentation = () => {
  // Declared in `admin.configuration.ts`, through the umbrella.
  const translate: TUseTranslateFn = useTranslate();
  translate('quickstart.title');

  // @ts-expect-error - 'quickstart.missing' is not a declared translation key
  translate('quickstart.missing');

  // The key carries the type of its value, so the hook answers it with no generic.
  const probe: { ok: true } = useInjectable({ key: PROBE });
  const viaNamespace: { ok: true } = Ardor.useInjectable({ key: PROBE });

  // @ts-expect-error - a plain string is not a binding key: make it with BindingKeys.build<T>
  useInjectable<unknown>({ key: 'services.Missing' });

  // @ts-expect-error - the same through the `Ardor` namespace
  Ardor.useInjectable<unknown>({ key: 'services.Missing' });

  return { probe, viaNamespace };
};
