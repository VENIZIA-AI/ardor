import { RequestMethods } from '@/common/constants';
import { BaseHelper } from '../../base-helper';
import type { TFetcherResponse, TFetcherVariant, TFetcherWorker } from '../common/types';

const HTTP = 'http';
const HTTPS = 'https';

export interface IRequestOptions {
  url: string;
  params?: Record<string | symbol, any>;
  method?: string;
  timeout?: number;
  [extra: symbol | string]: any;
}

export interface IFetchable<
  TVariant extends TFetcherVariant,
  TRequest extends IRequestOptions,
  TResponse extends TFetcherResponse<TVariant>,
> {
  send(opts: TRequest): Promise<TResponse>;
  get(opts: TRequest): Promise<TResponse>;
  post(opts: TRequest): Promise<TResponse>;
  put(opts: TRequest): Promise<TResponse>;
  patch(opts: TRequest): Promise<TResponse>;
  delete(opts: TRequest): Promise<TResponse>;

  getWorker(): TFetcherWorker<TVariant>;
}

/** The helper owns its logger (`this.logger`, scoped by `name`): a call carries none. */
export abstract class AbstractNetworkFetchableHelper<
  TVariant extends TFetcherVariant,
  TRequest extends IRequestOptions,
  TResponse extends TFetcherResponse<TVariant>,
>
  extends BaseHelper
  implements IFetchable<TVariant, TRequest, TResponse>
{
  protected name: string;
  protected variant: TVariant;
  protected worker: TFetcherWorker<TVariant>;

  constructor(opts: { name: string; variant: TVariant; worker: TFetcherWorker<TVariant> }) {
    super({ scope: opts.name });
    this.name = opts.name;
    this.variant = opts.variant;
    this.worker = opts.worker;
  }

  abstract send(opts: TRequest): Promise<TResponse>;

  getProtocol(opts: { url: string }) {
    return opts.url.startsWith('http:') ? HTTP : HTTPS;
  }

  getWorker() {
    return this.worker;
  }

  get(opts: TRequest) {
    return this.send({ ...opts, method: RequestMethods.GET });
  }

  post(opts: TRequest) {
    return this.send({ ...opts, method: RequestMethods.POST });
  }

  put(opts: TRequest) {
    return this.send({ ...opts, method: RequestMethods.PUT });
  }

  patch(opts: TRequest) {
    return this.send({ ...opts, method: RequestMethods.PATCH });
  }

  delete(opts: TRequest) {
    return this.send({ ...opts, method: RequestMethods.DELETE });
  }
}
