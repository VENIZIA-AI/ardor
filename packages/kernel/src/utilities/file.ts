/** The blob as a `data:` URL. */
export const toDataUrl = (opts: { blob: Blob }): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();

  reader.onloadend = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(opts.blob);

  return promise;
};
