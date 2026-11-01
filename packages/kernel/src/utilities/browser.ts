export class BrowserUtility {
  static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }
}

/** @deprecated Use `BrowserUtility.isBrowser`. Removed in 0.5. */
export const isBrowser = BrowserUtility.isBrowser;

/** @deprecated Nothing in ARDOR calls it: check the event target in your own code. Removed in 0.5. */
export const isEditableTarget = (opts: { target: EventTarget | null }): boolean => {
  const { target } = opts;

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
};
