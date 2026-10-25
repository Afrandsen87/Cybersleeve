/**
 * @module testing
 *
 * Properties that must hold for every reachable game state. Tests call {@link findInvariantViolations} after any
 * sequence of commands and ticks. Not part of the shipped game.
 */
import type { BigNum } from '../numbers';
import type { GameConfig, GameStateView } from '../core';
import { SCALAR_FIELDS } from '../core';

/** Config sections the checks read. */
type InvariantConfig = Pick<GameConfig, 'actions' | 'buyables' | 'progression'>;

const validAmount = (n: BigNum): boolean => n.isFinite() && !n.isNegative() && !n.isNaN();
const validCount = (n: number): boolean => Number.isInteger(n) && n >= 0;

/**
 * Lists every broken invariant of a state.
 *
 * - every amount is finite, not NaN and not negative (a `BigNum` scalar, XP, sleeve XP);
 * - plain-number scalars are finite and >= 0;
 * - network nodes are whole and the carried fraction is below 1;
 * - times are finite and >= 0 (a run may exceed a duration that just got shorter, so no upper bound);
 * - owned copies are whole numbers within the buyable's limit;
 * - the run counter towards sleeve XP is whole and below `runsPerSleeveXp`;
 * - every inventory stack is a whole number >= 0.
 *
 * @param state the state to check
 * @param config content (decides the ids and limits)
 * @returns a message per violation; empty when the state is sound
 */
export function findInvariantViolations(state: GameStateView, config: InvariantConfig): string[] {
  const problems: string[] = [];
  const bag = state as unknown as Record<string, BigNum | number>;
  for (const field of SCALAR_FIELDS) {
    const value = bag[field.key];
    if (field.kind === 'big') {
      if (!validAmount(value as BigNum)) problems.push(`${field.key} is not a valid amount: ${String(value)}`);
    } else if (!Number.isFinite(value as number) || (value as number) < 0) {
      problems.push(`${field.key} is not a finite number >= 0: ${String(value)}`);
    }
  }
  if (!state.network.floor().eq(state.network)) problems.push(`network is not whole: ${state.network.toString()}`);
  if (!(state.networkRemainder >= 0 && state.networkRemainder < 1))
    problems.push(`networkRemainder is outside [0, 1): ${state.networkRemainder}`);

  for (const def of config.actions) {
    const action = state.actions[def.id];
    if (!action) {
      problems.push(`action ${def.id} has no state`);
      continue;
    }
    if (!validAmount(action.xp)) problems.push(`${def.id}.xp is not a valid amount: ${action.xp.toString()}`);
    if (!validAmount(action.sleeveXp)) problems.push(`${def.id}.sleeveXp is not a valid amount: ${action.sleeveXp.toString()}`);
    if (!Number.isFinite(action.progress) || action.progress < 0 || action.progress >= 1)
      problems.push(`${def.id}.progress is invalid: ${action.progress}`);
    for (const [rarity, count] of Object.entries(action.augments)) {
      if (!validCount(count)) problems.push(`${def.id}.augments.${rarity} is invalid: ${count}`);
    }
    if (!validCount(action.runsTowardSleeveXp) || action.runsTowardSleeveXp >= config.progression.runsPerSleeveXp) {
      problems.push(`${def.id}.runsTowardSleeveXp is invalid: ${action.runsTowardSleeveXp}`);
    }
  }
  for (const b of config.buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (!validCount(owned) || owned > (b.maxPurchases ?? 1)) problems.push(`${b.id} owned count is invalid: ${owned}`);
  }
  for (const [itemId, stacks] of Object.entries(state.inventory)) {
    for (const [rarityId, count] of Object.entries(stacks)) {
      if (!validCount(count) || count > Number.MAX_SAFE_INTEGER)
        problems.push(`inventory ${itemId}/${rarityId} count is invalid: ${count}`);
    }
  }
  return problems;
}
