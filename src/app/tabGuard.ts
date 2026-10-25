/**
 * @module app
 *
 * Detects a second tab playing the same save, so two tabs cannot overwrite each other's progress.
 */

/** The part of `window` the guard listens on. */
export interface StorageEventSource {
  addEventListener(type: 'storage', listener: (event: { readonly key: string | null }) => void): void;
}

/**
 * Calls `onOtherTab` when another tab writes, removes or clears the save.
 *
 * @remarks
 * The browser fires `storage` events only in the OTHER tabs of the same origin, never in the tab that wrote, so any
 * event for the save key means a second copy of the game is saving. The older tab should then stop saving (and
 * playing) rather than race the newer one.
 *
 * Called by: `main.ts`.
 *
 * @param source `window`
 * @param saveKey the storage key of the save (`SAVE_KEY`)
 * @param onOtherTab called every time another tab touches the save
 */
export function watchForOtherTab(source: StorageEventSource, saveKey: string, onOtherTab: () => void): void {
  source.addEventListener('storage', (event) => {
    // `key` is null when the whole storage was cleared.
    if (event.key === null || event.key === saveKey) onOtherTab();
  });
}
