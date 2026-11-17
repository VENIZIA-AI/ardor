/** Checks of the runtime. */
export class BrowserUtility {
  /** Whether a global `window` exists. */
  static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }
}
