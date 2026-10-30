import type { AnyType } from '@/common';
import type { Logger } from '@/helpers';
import type { BaseService } from '../services';

/** Logs a failing method with its name, and its `resource` when the class has one, then rethrows. */
export const api = () => {
  return (_target: BaseService, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { logger: Logger; resource?: string },
      ...args: AnyType[]
    ) {
      try {
        const result = await Reflect.apply(originalMethod, this, args);
        return result;
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
};
