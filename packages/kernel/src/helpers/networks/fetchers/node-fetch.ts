import { stringify } from '@/utilities/url';
import { AbstractNetworkFetchableHelper, type IRequestOptions } from './abstract';

export interface INodeFetchRequestOptions extends RequestInit, IRequestOptions {
  url: string;
  params?: Record<string | symbol, any>;
}

// -------------------------------------------------------------
export class NodeFetcher extends AbstractNetworkFetchableHelper<
  'node-fetch',
  INodeFetchRequestOptions,
  Awaited<ReturnType<typeof fetch>>
> {
  private defaultConfigs: RequestInit;

  constructor(opts: { name: string; defaultConfigs: RequestInit; logger?: any }) {
    super({ name: opts.name, variant: 'node-fetch', worker: fetch });
    const { name, defaultConfigs } = opts;
    this.name = name;
    opts?.logger?.info('Creating new network request worker instance! Name: %s', this.name);

    this.defaultConfigs = defaultConfigs;
  }

  // -------------------------------------------------------------
  // SEND REQUEST
  // -------------------------------------------------------------
  override async send(opts: INodeFetchRequestOptions, logger?: any) {
    const { url, method = 'get', params, body, headers, timeout, signal, ...rest } = opts;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;

    if (timeout) {
      abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController?.abort();
      }, timeout);
    }

    const requestConfigs: RequestInit = {
      ...this.defaultConfigs,
      ...rest,
      method,
      body:
        body instanceof FormData || body instanceof URLSearchParams ? body : JSON.stringify(body),
      headers,
      signal: abortController?.signal ?? signal,
    };

    let requestUrl = url;
    if (params) {
      requestUrl = `${url}?${stringify(params)}`;
    }

    logger?.info('[send] URL: %s | Props: %o | Timeout: %s', url, requestConfigs, timeout);

    try {
      const rs = await fetch(requestUrl, requestConfigs);
      return rs;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
