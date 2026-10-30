/**
 * @module testing
 *
 * Properties that must hold for every reachable game state. Tests call {@link findInvariantViolations} after any
 * sequence of commands and ticks. Not part of the shipped game. The checks live by area in `testing/invariantChecks/`; this file keeps the
 * import path stable.
 */
import type { GameStateView } from '../core';
import { checkAutomation } from './invariantChecks/automation';
import { checkItems } from './invariantChecks/items';
import { checkScalars } from './invariantChecks/scalars';
import type { InvariantConfig } from './invariantChecks/shared';
import { checkSleeve } from './invariantChecks/sleeve';
import { checkWallet } from './invariantChecks/wallet';

/**
 * Lists every broken invariant of a state.
 *
 * - every amount is finite, not NaN and not negative (a `BigNum` scalar, XP, sleeve XP);
 * - plain-number scalars are finite and >= 0;
 * - network nodes are whole (to within the precision of the number type) and the carried fraction is below 1;
 * - times are finite and >= 0 (a run may exceed a duration that just got shorter, so no upper bound);
 * - owned copies are whole numbers within the buyable's limit, and a buyable is owned only with everything it `requires` and every
 *   skill-tree parent it has;
 * - the run counter towards sleeve XP is whole and below `runsPerSleeveXp`;
 * - every inventory stack is a whole number >= 0;
 * - every held item and rarity is in the seen set (and the seen set holds only `true` flags);
 * - Overclock and Focus are switched on only for actions whose unlock is owned (Overclock also needs an Overclock rule), and no
 *   more actions are focused than there are Focus slots (the base slots plus the bought ones); the toggles name known actions only;
 * - banked critical successes are whole counts of known actions;
 * - the Zero-day and Admin key toggles are on only while the game has the rule and at least one of the item is held;
 * - every recorded sleeve-run has a valid income and a whole total of action levels; every synthetic sleeve points at a recorded run, no run has
 *   two of them, and they exist only while the skill that gives them is owned;
 * - every corporation action of the content has a state, the progress of each is in [0, 1) and 0 while it is idle;
 * - Counted critical successes (`hardeningCrits`, one count per buyable) are whole numbers > 0, only for owned `hardenedPayloadFromCrits` buyables.
 * - Skill shard counts are whole numbers, and an Overclock chain is a whole count within the most links of the chain buyable, for an action that owns one.
 *
 * Called by: tests. Calls: the checks of `testing/invariantChecks/` (scalars, sleeve, items, automation, wallet).
 *
 * @param state the state to check
 * @param config content (decides the ids and limits)
 * @returns a message per violation; empty when the state is sound
 */
export function findInvariantViolations(state: GameStateView, config: InvariantConfig): string[] {
  const problems: string[] = [];
  for (const check of [checkScalars, checkAutomation, checkSleeve, checkItems, checkWallet]) check(state, config, problems);
  return problems;
}
