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

/** Asks whether the action's Auto-run is owned (the core's `ownsAutoRun`, the one owner of that answer). */
export type OwnsAutoRun = (actionId: string) => boolean;

/**
 * Whether the square of an action is still locked: the action has an Auto-run to buy and it is not owned yet (the owned/not
 * decision is the core's `ownsAutoRun`; an action with no Auto-run on sale has nothing to wait for).
 *
 * Called by: `squareView`, {@link overclockOnOffer}. Calls: `ownsAuto`.
 *
 * @param config game configuration (is there an Auto-run for the action?)
 * @param ownsAuto whether an action's Auto-run is owned
 * @param actionId the action
 */
export function squareLocked(config: GameConfig, ownsAuto: OwnsAutoRun, actionId: string): boolean {
  const hasAuto = config.buyables.some((b) => b.actionId === actionId && b.effect.kind === 'autoRun');
  return hasAuto && !ownsAuto(actionId);
}

/**
 * The Overclock unlock buyable of an action while its cell is shown in the square (Auto-run owned, the unlock exists).
 *
 * Called by: `statReveal.ts`. Calls: {@link squareLocked}.
 *
 * @param config game configuration
 * @param actionId the action
 * @param ownsAuto whether an action's Auto-run is owned
 * @returns the unlock, or `undefined` when the cell is not shown
 */
export function overclockOnOffer(config: GameConfig, actionId: string, ownsAuto: OwnsAutoRun): BuyableDefinition | undefined {
  if (squareLocked(config, ownsAuto, actionId)) return undefined;
  return config.buyables.find((b) => b.actionId === actionId && b.effect.kind === 'overclockUnlock');
}
