export class FileUtility {
  /** The blob as a `data:` URL. */
  static toDataUrl(opts: { blob: Blob }): Promise<string> {
    // `new Promise`, not `Promise.withResolvers` (ES2024, Chrome 119): a WebView on an older Chrome lacks it.
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(opts.blob);
    });
  }
}

/** @deprecated Use `FileUtility.toDataUrl`. Removed in 0.5. */
export const toDataUrl = FileUtility.toDataUrl;
