import { GlobalRegistrator } from '@happy-dom/global-registrator';

// happy-dom gives React a document, but it also replaces Bun's network primitives with its own,
// and `Bun.serve` rejects a happy-dom `Response`. Keep the DOM, restore the runtime's networking.
const native = {
  fetch: globalThis.fetch,
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  FormData: globalThis.FormData,
  Blob: globalThis.Blob,
  File: globalThis.File,
  AbortController: globalThis.AbortController,
  URL: globalThis.URL,
  URLSearchParams: globalThis.URLSearchParams,
};

GlobalRegistrator.register();

for (const [name, value] of Object.entries(native)) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

// Decorators resolve constructor parameter types through reflect-metadata; import it once, before
// any class under test is defined.
import 'reflect-metadata';

export {};
