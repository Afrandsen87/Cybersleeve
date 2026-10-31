/**
 * @module ui
 *
 * Where the numbers in two Sleeve tooltips come from: the next action a higher access level opens, and the purchases behind
 * the ICE Rating level bonus.
 *
 * @remarks
 * Called by: `sleeveView.ts`. Calls: nothing (reads the configuration).
 */
import type { ActionDefinition, GameConfig } from '../../core';

/**
 * The next action that opens at a higher access level than the sleeve has: the lowest level above it, the first such action
 * in the configuration order.
 *
 * Called by: {@link sleeveRows}.
 *
 * @param config game configuration (reads the actions and their `requiredAccessLevel`)
 * @param accessLevel the sleeve's access level now
 * @returns its name and required level, or `null` when every action is open
 */
export function nextUnlock(config: GameConfig, accessLevel: number): { name: string; level: string } | null {
  let next: ActionDefinition | null = null;
  for (const a of config.actions) {
    const level = a.requiredAccessLevel ?? 1;
    if (level > accessLevel && (next === null || level < (next.requiredAccessLevel ?? 1))) next = a;
  }
  return next === null ? null : { name: next.name, level: String(next.requiredAccessLevel ?? 1) };
}

/**
 * The names of the owned purchases that add base ICE Rating per action level, joined with " + ".
 *
 * Called by: {@link sleeveRows}.
 *
 * @param config game configuration (reads the buyables)
 * @param ownedCount copies owned of a buyable id
 * @returns the names, or a generic label when none is owned
 */
export function iceBonusSource(config: GameConfig, ownedCount: (id: string) => number): string {
  const names = config.buyables.filter((b) => b.effect.kind === 'iceRatingFromActionLevel' && ownedCount(b.id) > 0).map((b) => b.name);
  return names.length > 0 ? names.join(' + ') : 'Purchase Bonus';
}
