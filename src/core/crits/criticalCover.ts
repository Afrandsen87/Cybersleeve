/**
 * @module core
 *
 * Whether a run of an action is "covered": something other than chance makes one of its completed runs critical.
 *
 * @remarks
 * Three sources cover a run, each worth +100% critical chance to one run: a Zero-day switched on for the action, an Admin key switched
 * on for the action, and a banked success (from a critical link). They are claimed in that order when runs complete
 * (banked -> Zero-day -> Admin key, see `ActionRunner.completeRuns`); this module only answers the yes/no question the stats and the
 * interface ask, in one place, so `criticalPossible` and `maxCritsPerRun` cannot disagree.
 * Called by: `engine/stats.ts` (`DerivedStats.criticalPossible`, `DerivedStats.maxCritsPerRun`). Calls: nothing (pure).
 */
import type { ActionId, GameConfig, GameState } from '../types';

/**
 * True when a Zero-day, an Admin key or a banked success can make a completed run of the action critical right now.
 *
 * @param state reads `zeroDaysOn`, `adminKeysOn` and `bankedCriticals`
 * @param items reads which action the Zero-day and the Admin key are for
 * @param actionId the action asked about
 * @returns whether the action's next run is covered
 */
export function criticalCover(
  state: Pick<GameState, 'zeroDaysOn' | 'adminKeysOn' | 'bankedCriticals'>,
  items: Pick<GameConfig['items'], 'zeroDay' | 'adminKey'>,
  actionId: ActionId,
): boolean {
  return (
    (state.zeroDaysOn && items.zeroDay?.actionId === actionId) ||
    (state.adminKeysOn && items.adminKey?.actionId === actionId) ||
    (state.bankedCriticals[actionId] ?? 0) > 0
  );
}
