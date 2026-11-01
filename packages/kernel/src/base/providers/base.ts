import { BaseHelper } from '@venizia/ignis-helpers/core';
import type { Container, IProvider } from '@venizia/ignis-inversion';

export abstract class BaseProvider<T> extends BaseHelper implements IProvider<T> {
  abstract value(container: Container): T;
}
