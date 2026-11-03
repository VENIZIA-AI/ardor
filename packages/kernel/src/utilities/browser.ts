export class BrowserUtility {
  static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }
}
