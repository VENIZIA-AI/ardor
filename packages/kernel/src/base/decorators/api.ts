import type { ILogger } from '@venizia/ignis-helpers/core';
import type { BaseService } from '../services';

/**
 * Logs a failing method with its name, and its `resource` when the class has one, then rethrows.
 *
 * @useWhen a method of a repository or service should log its failure with its name and rethrow
 * @insteadOf a try and catch that only logs
 */
export const api = () => {
  return (_target: BaseService, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { logger: ILogger; resource?: string },
      ...args: unknown[]
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
