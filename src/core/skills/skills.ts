/**
 * @module core
 *
 * Skill points: how many the player has earned from the action levels.
 */

/**
 * Skill points earned in total: the first one when an action reaches level 1, and one more for every order of magnitude of the
 * total of all action levels after that.
 *
 * @remarks
 * 0 while the total is 0 (every level is 0 in a new game); `1 + floor(log10(total))` once the total reaches 1: so 1 point at a
 * total of 1 to 9 (the first action level-up), 2 points at a total of 10, 3 at 100, 4 at 1,000 and so on. Only ACTION levels
 * count, not sleeve levels.
 *
 * Called by: `app/createGame.ts` (the points `Shop` can pay with).
 *
 * @param actionLevels the level of every action
 * @returns a whole number >= 0
 */
export function earnedSkillPoints(actionLevels: readonly number[]): number {
  const total = actionLevels.reduce((sum, level) => sum + (Number.isFinite(level) && level > 0 ? level : 0), 0);
  if (!(total >= 1)) return 0;
  // The tiny addition keeps a total that is exactly a power of ten from falling a hair short in the logarithm.
  return 1 + Math.floor(Math.log10(total) + 1e-12);
}
