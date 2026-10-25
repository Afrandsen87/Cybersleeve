/**
 * @module app
 *
 * Keeps two tabs from playing the same save, so they cannot overwrite each other's progress.
 *
 * @remarks
 * Two guards, used in this order. {@link claimGame} asks the browser for a named lock (Web Locks): the first tab gets it and keeps
 * it until it closes, any later tab is told the game is taken BEFORE it starts, so the tab that was playing is never the one that
 * stops. Where Web Locks do not exist, {@link watchForOtherTab} is the fallback: it notices another tab writing the save and
 * stops this one (there the tab that saves first wins, which is not necessarily the older one).
 */

/** Name of the lock the tab that plays holds. */
export const GAME_LOCK = 'cybersleeve.game';

/** The part of the browser's `LockManager` that {@link claimGame} uses. */
export interface LockManagerLike {
  request(name: string, options: { ifAvailable: true }, callback: (lock: unknown) => Promise<unknown>): Promise<unknown>;
}

/** What {@link claimGame} found out. */
export type GameClaim = 'owner' | 'taken' | 'unsupported';

/**
 * Tries to become the one tab that plays.
 *
 * Called by: `main.ts`.
 *
 * @param locks `navigator.locks`, or `undefined` where the browser has none
 * @returns `'owner'` when this tab now holds the lock (it keeps it until the tab closes), `'taken'` when another tab holds it,
 *   `'unsupported'` when there is no lock manager (use {@link watchForOtherTab} instead)
 */
export function claimGame(locks: LockManagerLike | undefined): Promise<GameClaim> {
  if (!locks) return Promise.resolve('unsupported');
  return new Promise<GameClaim>((resolve) => {
    locks
      .request(GAME_LOCK, { ifAvailable: true }, (lock) => {
        resolve(lock ? 'owner' : 'taken');
        // A granted lock is held for as long as this promise is pending: forever, i.e. until the tab closes.
        return lock ? new Promise<never>(() => {}) : Promise.resolve();
      })
      .catch(() => resolve('unsupported'));
  });
}

/** The part of `window` the fallback guard listens on. */
export interface StorageEventSource {
  addEventListener(type: 'storage', listener: (event: { readonly key: string | null }) => void): void;
}

/**
 * Fallback guard: calls `onOtherTab` when another tab writes, removes or clears the save.
 *
 * @remarks
 * The browser fires `storage` events only in the OTHER tabs of the same origin, never in the tab that wrote, so any event for the
 * save key means a second copy of the game is saving. The tab that sees it stops saving (and playing) rather than race the other.
 *
 * Called by: `main.ts` (only when {@link claimGame} says `'unsupported'`).
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
