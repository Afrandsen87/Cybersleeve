/**
 * @module testing
 *
 * Properties that must hold for every reachable game state. Tests call {@link findInvariantViolations} after any
 * sequence of commands and ticks. Not part of the shipped game.
 */
import type { BigNum } from '../numbers';
import type { GameConfig, GameStateView } from '../core';
import { AUTOMATION_FEATURES, SCALAR_FIELDS } from '../core';

/** Config sections the checks read. */
type InvariantConfig = Pick<GameConfig, 'actions' | 'buyables' | 'corporation' | 'focus' | 'items' | 'progression'>;

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
 * - owned copies are whole numbers within the buyable's limit, and a buyable is owned only with everything it `requires` and every
 *   skill-tree parent it has;
 * - the run counter towards sleeve XP is whole and below `runsPerSleeveXp`;
 * - every inventory stack is a whole number >= 0;
 * - Overclock and Focus are switched on only for actions whose unlock is owned (Overclock also needs an Overclock rule), and no
 *   more actions are focused than there are Focus slots (the base slots plus the bought ones); the toggles name known actions only;
 * - banked critical successes are whole counts of known actions;
 * - the Zero-day and Admin key toggles are on only while the game has the rule and at least one of the item is held;
 * - every recorded sleeve-run has a valid income and a whole total of action levels; every synthetic sleeve points at a recorded run, no run has
 *   two of them, and they exist only while the skill that gives them is owned;
 * - every corporation action of the content has a state, the progress of each is in [0, 1) and 0 while it is idle;
 * - Skill shard counts are whole numbers, and an Overclock chain is a whole count within the most links of the chain buyable, for an action that owns one.
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
  const auto = state.automation;
  const earned = config.buyables.reduce(
    (n, b) => (b.effect.kind === 'automationPoints' ? n + b.effect.perCopy * (state.purchased[b.id] ?? 0) : n),
    0,
  );
  const unlockedCount = AUTOMATION_FEATURES.filter((f) => auto.unlocked[f]).length;
  if (unlockedCount > earned) problems.push(`more automation features unlocked (${unlockedCount}) than points earned (${earned})`);
  if (!(Number.isFinite(auto.autoBurnCeiling) && auto.autoBurnCeiling >= 0))
    problems.push(`autoBurnCeiling is not valid: ${auto.autoBurnCeiling}`);
  if (auto.autoBurnOn && !auto.unlocked.autoBurn) problems.push('Auto Burn is on but not unlocked');
  if (Object.keys(auto.autosale).length > 0 && !auto.unlocked.autosale) problems.push('autosale is set but not unlocked');
  if (Object.keys(auto.dispersal).length > 0 && !auto.unlocked.dispersal) problems.push('augment dispersal is set but not unlocked');
  const shareTotal = Object.values(auto.dispersal).reduce((n, s) => n + s, 0);
  if (shareTotal > 100 + 1e-9) problems.push(`dispersal shares add up to more than 100: ${shareTotal}`);
  for (const [id, share] of Object.entries(auto.dispersal)) {
    if (!(Number.isFinite(share) && share > 0 && share <= 100)) problems.push(`dispersal of ${id} is not a share in (0, 100]: ${share}`);
    if (!config.actions.some((a) => a.id === id)) problems.push(`dispersal names unknown action ${id}`);
  }
  for (const id of Object.keys(auto.autosale)) {
    if (!config.items.rarities.some((r) => r.id === id)) problems.push(`autosale names unknown rarity ${id}`);
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
    if (!validCount(action.skillShards)) problems.push(`${def.id}.skillShards is invalid: ${action.skillShards}`);
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
    for (const need of [...(b.requires ?? []), ...(b.parents ?? [])]) {
      if (owned > 0 && (state.purchased[need] ?? 0) <= 0) problems.push(`${b.id} is owned without ${need}, which it needs`);
    }
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
  for (const [id, count] of Object.entries(state.bankedCriticals)) {
    if (!known.has(id) || !validCount(count)) problems.push(`bankedCriticals.${id} is invalid: ${count}`);
  }
  if (state.zeroDaysOn) {
    const rule = config.items.zeroDay;
    const stack = config.items.rarities[0];
    if (!rule || !stack || (state.inventory[rule.itemId]?.[stack.id] ?? 0) <= 0)
      problems.push('zeroDaysOn is switched on without a Zero-day held');
  }
  if (state.adminKeysOn) {
    const rule = config.items.adminKey;
    const stack = config.items.rarities[0];
    if (!rule || !stack || (state.inventory[rule.itemId]?.[stack.id] ?? 0) <= 0)
      problems.push('adminKeysOn is switched on without an Admin key held');
  }
  for (const [id, links] of Object.entries(state.chains)) {
    const owned = config.buyables.find((b) => b.effect.kind === 'overclockChain' && b.actionId === id && (state.purchased[b.id] ?? 0) > 0);
    const max = owned?.effect.kind === 'overclockChain' ? owned.effect.chain.maxLinks : undefined;
    if (max === undefined || !validCount(links) || links > max) problems.push(`chains.${id} is invalid: ${links}`);
  }
  for (const [itemId, stacks] of Object.entries(state.inventory)) {
    for (const [rarityId, count] of Object.entries(stacks)) {
      if (!validCount(count) || count > Number.MAX_SAFE_INTEGER)
        problems.push(`inventory ${itemId}/${rarityId} count is invalid: ${count}`);
    }
  }
  state.runs.forEach((run, i) => {
    if (!validAmount(run.creditsPerSecond)) problems.push(`run ${i} has an invalid income: ${run.creditsPerSecond.toString()}`);
    if (!validCount(run.actionLevelsTotal)) problems.push(`run ${i} has an invalid level total: ${run.actionLevelsTotal}`);
  });
  const seen = new Set<number>();
  for (const synth of state.synths) {
    if (!(Number.isInteger(synth.runIndex) && synth.runIndex >= 0 && synth.runIndex < state.runs.length))
      problems.push(`a synthetic sleeve points at a run that does not exist: ${synth.runIndex}`);
    if (seen.has(synth.runIndex)) problems.push(`two synthetic sleeves copy run ${synth.runIndex}`);
    seen.add(synth.runIndex);
  }
  if (state.synths.length > 0 && !config.buyables.some((b) => b.effect.kind === 'synthSleeves' && (state.purchased[b.id] ?? 0) > 0))
    problems.push('synthetic sleeves exist without the skill that gives them');
  for (const def of config.corporation?.actions ?? []) {
    const action = state.corporation.actions[def.id];
    if (!action) problems.push(`corporation action ${def.id} has no state`);
    else if (!(Number.isFinite(action.progress) && action.progress >= 0 && action.progress < 1))
      problems.push(`corporation action ${def.id} has progress outside [0, 1): ${action.progress}`);
    else if (!action.running && action.progress !== 0)
      problems.push(`corporation action ${def.id} is idle but has progress ${action.progress}`);
  }
  return problems;
}
