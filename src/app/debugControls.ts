/**
 * @module app
 *
 * Decides whether the test aids (Reset save, fast-forward) are shown.
 */

/**
 * The test aids are shown in development builds and, in any build, when the address contains `?debug`.
 *
 * Called by: `main.ts`.
 *
 * @param dev true for a development build (`import.meta.env.DEV`)
 * @param search the query string of the page address (`location.search`)
 */
export function debugControlsEnabled(dev: boolean, search: string): boolean {
  return dev || new URLSearchParams(search).has('debug');
}
