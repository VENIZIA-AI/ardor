export type TFetcherVariant = 'node-fetch';

export type TFetcherResponse<T extends TFetcherVariant> = T extends 'node-fetch' ? Response : never;

export type TFetcherWorker<T extends TFetcherVariant> = T extends 'node-fetch'
  ? typeof fetch
  : never;
