import { type AnyType } from '@/common';
import { type Logger } from '@/helpers';
import { type BaseService } from '../services';

/** Logs a failing method with its name, and its `resource` when the class has one, then rethrows. */
export function api() {
  return function (_target: BaseService, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { logger: Logger; resource?: string },
      ...args: AnyType[]
    ) {
      try {
        return await Reflect.apply(originalMethod, this, args);
      } catch (error) {
        this.logger.error(
          '[%s] resource: %s | error: %o',
          propertyKey,
          this.resource ?? '-',
          error,
        );

        throw error;
      }
    };

    return descriptor;
  };
}
