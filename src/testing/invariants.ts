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
type InvariantConfig = Pick<GameConfig, 'actions' | 'buyables' | 'focus' | 'progression'>;

const validAmount = (n: BigNum): boolean => n.isFinite() && !n.isNegative() && !n.isNaN();
const validCount = (n: number): boolean => Number.isInteger(n) && n >= 0;

/**
 * Whole, to within the precision of the number type. The big-number type keeps a mantissa and an exponent, so above about 1e8 it
 * cannot hold every integer exactly (200003671 reads back as 200003670.99999997). A real fraction of a node is still caught wherever
 * a fraction can be told apart from rounding noise.
 */
const isWhole = (n: BigNum): boolean => {
  if (n.floor().eq(n)) return true;
  const v = n.toNumber();
  return Number.isFinite(v) && Math.abs(v - Math.round(v)) <= Math.abs(v) * 1e-12;
};

/**
 * Lists every broken invariant of a state.
 *
 * - every amount is finite, not NaN and not negative (a `BigNum` scalar, XP, sleeve XP);
 * - plain-number scalars are finite and >= 0;
 * - network nodes are whole (to within the precision of the number type) and the carried fraction is below 1;
 * - times are finite and >= 0 (a run may exceed a duration that just got shorter, so no upper bound);
 * - owned copies are whole numbers within the buyable's limit;
 * - the run counter towards sleeve XP is whole and below `runsPerSleeveXp`;
 * - every inventory stack is a whole number >= 0;
 * - Overclock and Focus are switched on only for actions whose unlock is owned (Overclock also needs an Overclock rule), and no
 *   more actions are focused than there are Focus slots (the base slots plus the bought ones); the toggles name known actions only.
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
  if (!isWhole(state.network)) problems.push(`network is not whole: ${state.network.toString()}`);
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
  const unlocked = (kind: string, actionId: string): boolean =>
    config.buyables.some((b) => b.effect.kind === kind && b.actionId === actionId && (state.purchased[b.id] ?? 0) > 0);
  const slots =
    config.focus.baseSlots +
    config.buyables.reduce((n, b) => (b.effect.kind === 'focusSlots' ? n + b.effect.perCopy * (state.purchased[b.id] ?? 0) : n), 0);
  const known = new Set(config.actions.map((a) => a.id));
  for (const id of Object.keys(state.overclocked)) {
    const def = config.actions.find((a) => a.id === id);
    if (!known.has(id) || !def?.overclock || !unlocked('overclockUnlock', id))
      problems.push(`overclocked.${id} is switched on without its unlock`);
  }
  for (const id of Object.keys(state.focused)) {
    if (!known.has(id) || !unlocked('focusUnlock', id)) problems.push(`focused.${id} is switched on without its unlock`);
  }
  if (Object.keys(state.focused).length > slots)
    problems.push(`${Object.keys(state.focused).length} actions are focused with ${slots} Focus slots`);
  for (const [itemId, stacks] of Object.entries(state.inventory)) {
    for (const [rarityId, count] of Object.entries(stacks)) {
      if (!validCount(count) || count > Number.MAX_SAFE_INTEGER)
        problems.push(`inventory ${itemId}/${rarityId} count is invalid: ${count}`);
    }
  }
  return problems;
}
