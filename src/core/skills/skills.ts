/**
 * @module core
 *
 * Skill points: how many the player has earned from the action levels.
 */
import type { GameConfig } from '../types';

/**
 * Skill points earned in total from the total of all action levels.
 *
 * @remarks
 * Closed form: one point for every early threshold the total has reached (`skills.earlyThresholds`, e.g. 1 and 5), plus one more for every
 * `skills.every` levels of total (`floor(total / every)`), so with `[1, 5]` and `10` the points arrive at a total of 1, 5, 10, 20, 30 and so on.
 * Only ACTION levels count, not sleeve levels. Negative, NaN and infinite levels count as 0 each.
 *
 * Called by: `app/createGame.ts` (the points `Shop` can pay with). Calls: nothing.
 *
 * @param actionLevels the level of every action
 * @param rule the content rule (`GameConfig.skills`)
 * @returns a whole number >= 0
 */
export function earnedSkillPoints(actionLevels: readonly number[], rule: GameConfig['skills']): number {
  const total = Math.min(
    actionLevels.reduce((sum, level) => sum + (Number.isFinite(level) && level > 0 ? level : 0), 0),
    Number.MAX_SAFE_INTEGER, // a sum that overflows to Infinity must not make the points infinite
  );
  if (!(total >= 1)) return 0;
  const early = rule.earlyThresholds.filter((t) => t <= total).length;
  return early + Math.floor(total / rule.every);
}
