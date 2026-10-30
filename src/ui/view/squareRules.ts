/**
 * @module ui
 *
 * Which cells of an action's square are on offer. The one owner of "is the Overclock unlock shown yet", read by the square itself
 * and by the stat reveal rules (heat exists once an Overclock that makes heat is on offer).
 *
 * @remarks
 * Called by: `squareView.ts`, `statReveal.ts`. Calls: nothing outside `core` types. Pure: no DOM, no state of its own.
 */
import type { BuyableDefinition, GameConfig } from '../../core';

/**
 * Whether the square of an action is still locked: it has an Auto-run unlock that is not owned yet.
 *
 * Called by: `squareView`, {@link overclockOnOffer}. Calls: nothing.
 *
 * @param config game configuration
 * @param actionId the action
 * @param owned copies owned of a buyable
 */
export function squareLocked(config: GameConfig, actionId: string, owned: (buyableId: string) => number): boolean {
  const auto = config.buyables.find((b) => b.actionId === actionId && b.effect.kind === 'autoRun');
  return auto !== undefined && owned(auto.id) <= 0;
}

/**
 * The Overclock unlock buyable of an action while its cell is shown in the square (Auto-run owned, the unlock exists).
 *
 * Called by: `statReveal.ts`. Calls: {@link squareLocked}.
 *
 * @param config game configuration
 * @param actionId the action
 * @param owned copies owned of a buyable
 * @returns the unlock, or `undefined` when the cell is not shown
 */
export function overclockOnOffer(config: GameConfig, actionId: string, owned: (buyableId: string) => number): BuyableDefinition | undefined {
  if (squareLocked(config, actionId, owned)) return undefined;
  return config.buyables.find((b) => b.actionId === actionId && b.effect.kind === 'overclockUnlock');
}
