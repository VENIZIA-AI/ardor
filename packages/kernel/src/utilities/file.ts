import { getError } from '@venizia/ignis-inversion';

/**
 * Helpers over `Blob` and file data.
 */
export class FileUtility {
  /** How long a saved file's object URL lives, in milliseconds: a browser that starts the download later (Safari) still finds it. */
  static readonly REVOKE_DELAY_MS = 30_000;

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

  /**
   * Saves `blob` as a file: the browser downloads it under `filename`, or `download` when none is given. Browser
   * only; it throws without a `document`.
   *
   * @example
   * ```ts
   * const { data, filename } = await NetworkResponseReader.read({ response, type });
   *
   * if (data instanceof Blob) {
   *   FileUtility.save({ blob: data, filename });
   * }
   * ```
   */
  static save(opts: { blob: Blob; filename?: string }): void {
    if (typeof document === 'undefined') {
      throw getError({
        message:
          '[FileUtility.save] There is no document to save a file from | Call it in a browser',
      });
    }

    const url = URL.createObjectURL(opts.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = opts.filename || 'download';

    // Attached while it is clicked: Firefox ignores the click of a detached anchor.
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    // Revoked well after the click: Safari can lose the download when the URL is revoked at once.
    setTimeout(() => URL.revokeObjectURL(url), FileUtility.REVOKE_DELAY_MS);
  }
}
