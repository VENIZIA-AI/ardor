import { BaseHelper } from '@venizia/ignis-helpers/core';

/**
 * Base of the services of an application; a `BaseHelper` with a scoped logger.
 *
 * @useWhen you write a service of the application and want a scoped logger
 * @insteadOf a service class that creates its own logger
 */
export class BaseService extends BaseHelper {}
