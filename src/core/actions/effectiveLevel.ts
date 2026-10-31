/** Actions context: effective levels. Called by: ToggleStats. Calls: nothing. */

/**
 * The ONE owner of real action level plus the level bonus, for every derived calculation (speed, rewards, ICE, growth, start cost).
 * The bonus itself comes from `ToggleStats.levelBonus` (one `resolveLevelBonus` call), so the tip and the calculations cannot differ.
 * Actions context. Called by: ToggleStats.effectiveActionLevel. Calls: nothing; no mutation.
 *
 * @param actionLevel the real action level (stored XP and leveling are untouched)
 * @param levelBonus levels added by buyables (>= 0)
 * @returns the effective level, never below the real level
 */
export function effectiveActionLevel(actionLevel: number, levelBonus: number): number {
  return actionLevel + Math.max(0, levelBonus || 0);
}
