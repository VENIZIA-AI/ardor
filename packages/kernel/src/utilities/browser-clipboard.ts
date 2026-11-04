/**
 * The clipboard of the browser, for code outside React. Nothing throws or rejects: no `navigator`
 * (a server), no `navigator.clipboard` (an insecure context, an old WebView), a denied permission,
 * a missing user gesture and an unfocused document all answer `false` or `undefined`. Nothing
 * touches `navigator` at import.
 */
export class BrowserClipboard {
  /** The one catch: every refusal the browser can make is the case this class absorbs. */
  private static async safe<TResult>(opts: {
    run: () => Promise<TResult>;
    fallback: TResult;
  }): Promise<TResult> {
    try {
      const result = await opts.run();
      return result;
      // eslint-disable-next-line venizia/no-silent-catch -- absorbing a refusing clipboard is the contract of BrowserClipboard
    } catch {
      return opts.fallback;
    }
  }

  /** `true` when the text is on the clipboard. */
  static writeText(opts: { text: string }): Promise<boolean> {
    return BrowserClipboard.safe({
      run: async () => {
        await globalThis.navigator.clipboard.writeText(opts.text);
        return true;
      },
      fallback: false,
    });
  }

  /** The text on the clipboard, or `undefined`: reading needs a permission and a gesture, and some browsers do not offer it. */
  static readText(): Promise<string | undefined> {
    return BrowserClipboard.safe<string | undefined>({
      run: () => globalThis.navigator.clipboard.readText(),
      fallback: undefined,
    });
  }
}
