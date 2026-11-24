import { BaseHelper } from '@venizia/ignis-helpers/core';
import type { Container, IProvider } from '@venizia/ignis-inversion';

/**
 * Base of a provider: `value` yields what the provider supplies, resolved through the container.
 *
 * @useWhen you write a provider that yields a value resolved through the container
 * @insteadOf a hand-built singleton that reads the container
 */
export abstract class BaseProvider<T> extends BaseHelper implements IProvider<T> {
  /** Produces the provided value. */
  abstract value(container: Container): T;
}
