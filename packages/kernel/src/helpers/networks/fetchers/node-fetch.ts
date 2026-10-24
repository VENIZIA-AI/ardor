import { toQueryString } from '@/utilities/url';
import { redactSecrets } from '@venizia/ignis-helpers/common';
import { AbstractNetworkFetchableHelper, type IRequestOptions } from './abstract';

export interface INodeFetchRequestOptions extends RequestInit, IRequestOptions {
  url: string;
  params?: Record<string | symbol, any>;
}

/** What `fetch` takes as a body as it is: encoding any of these again would change the bytes sent. */
const isRawBody = (body: unknown): boolean => {
  return (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  );
};

export class NodeFetcher extends AbstractNetworkFetchableHelper<
  'node-fetch',
  INodeFetchRequestOptions,
  Awaited<ReturnType<typeof fetch>>
> {
  private defaultConfigs: RequestInit;

  constructor(opts: { name: string; defaultConfigs: RequestInit }) {
    super({ name: opts.name, variant: 'node-fetch', worker: fetch });
    this.logger.debug('Creating new network request worker instance! Name: %s', this.name);

    this.defaultConfigs = opts.defaultConfigs;
  }

  /** Raw bodies pass through; a plain object or array is JSON-encoded; no body stays no body. */
  protected serializeBody(opts: { body: unknown }): BodyInit | undefined {
    const { body } = opts;

    if (body === undefined || body === null) {
      return undefined;
    }

    return isRawBody(body) ? (body as BodyInit) : JSON.stringify(body);
  }

  /** `?` only when the url carries no query of its own: a second `?` would end up in the last value. */
  protected buildUrl(opts: { url: string; params?: Record<string | symbol, any> }): string {
    const { url, params } = opts;
    const serialized = params ? toQueryString({ params }) : '';

    return serialized ? `${url}${url.includes('?') ? '&' : '?'}${serialized}` : url;
  }

  override async send(opts: INodeFetchRequestOptions) {
    const { url, method = 'get', params, body, headers, timeout, signal, ...rest } = opts;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let effectiveSignal = signal;

    if (timeout) {
      const timeoutController = new AbortController();
      timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, timeout);

      // Combined, never replaced: a timeout must not swallow the caller's own signal, or the caller
      // would think it cancelled a request that is still running. Either source aborts the request.
      effectiveSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;
    }

    const requestConfigs: RequestInit = {
      ...this.defaultConfigs,
      ...rest,
      method,
      body: this.serializeBody({ body }),
      headers,
      signal: effectiveSignal,
    };

    // The body is never logged, only its presence, and the headers go through `Headers` first so
    // that every spelling of their names reaches the redactor (an Authorization value is a secret).
    const loggable = {
      ...requestConfigs,
      body: requestConfigs.body === undefined ? undefined : '[body]',
      headers: headers ? Object.fromEntries(new Headers(headers)) : undefined,
    };
    this.logger.debug(
      '[send] URL: %s | Props: %j | Timeout: %s',
      url,
      redactSecrets(loggable),
      timeout,
    );

    try {
      return await fetch(this.buildUrl({ url, params }), requestConfigs);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
