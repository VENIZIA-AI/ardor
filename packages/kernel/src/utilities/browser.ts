/**
 * Checks of the runtime.
 *
 * @useWhen you check what runtime the code runs in (browser or server)
 * @insteadOf `typeof window` checks
 */
export class BrowserUtility {
  /** Whether a global `window` exists. */
  static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }
}
