/**
 * @module core
 *
 * Defensive readers for the pieces of one sleeve in a save (see `saveReaders.ts` for the shared helpers and the wallet's pieces).
 *
 * @remarks
 * Called by: `serialization.ts` (`deserializeState`), in the order it lists them: several pieces are only valid given an earlier one
 * (a toggle needs its unlock, a key toggle needs the key held).
 */
import type { NumberFactory } from '../../numbers';
import { BuyableCaps } from '../effects/buyableCaps';
import { traitsOf } from '../effects/effectTraits';
import { isActionCardPurchase } from '../resleeve/resleeveCarry';
import type { GameConfig, GameState, SleeveState } from '../types';
import { isRecord, readAmount, readCount, readProgress } from './saveReaders';

/** Reads the augments applied to an action: only known rarities, whole counts above 0 (anything else is an empty record). */
function readAugments(v: unknown, items: GameConfig['items']): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const rarity of items.rarities) {
    const count = Math.min(readCount(v[rarity.id]), Number.MAX_SAFE_INTEGER);
    if (count > 0) out[rarity.id] = count;
  }
  return out;
}

/** Reads the per-action progress: only known actions; the run counter is kept below `runsPerSleeveXp`. */
export function readActions(
  state: GameState,
  raw: unknown,
  config: Pick<GameConfig, 'actions' | 'items' | 'progression'>,
  factory: NumberFactory,
): void {
  const saved = isRecord(raw) ? raw : {};
  for (const def of config.actions) {
    const entry = saved[def.id];
    if (!isRecord(entry)) continue;
    state.sleeve.actions[def.id] = {
      xp: readAmount(entry['xp'], factory),
      sleeveXp: readAmount(entry['sleeveXp'], factory),
      runsTowardSleeveXp: readCount(entry['runsTowardSleeveXp']) % config.progression.runsPerSleeveXp,
      augments: readAugments(entry['augments'], config.items),
      skillShards: Math.min(readCount(entry['skillShards']), Number.MAX_SAFE_INTEGER),
      running: entry['running'] === true,
      progress: readProgress(entry['progress']),
    };
  }
}

/** Removes owned buyables whose requirements are not owned, until the state is consistent (a save cannot skip a gate). */
function dropUnmetRequirements(purchased: SleeveState['purchased'], buyables: GameConfig['buyables']): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of buyables) {
      if ((purchased[b.id] ?? 0) > 0 && ![...(b.requires ?? []), ...(b.parents ?? [])].every((r) => (purchased[r] ?? 0) > 0)) {
        delete purchased[b.id];
        changed = true;
      }
    }
  }
}

/**
 * Reads the owned buyables and last life's purchases (a wallet field that is judged against them): copy counts are capped, a buyable whose
 * `requires` or `parents` are not owned is dropped, and only action-card purchases that exist are kept for Reflex Archive.
 */
export function readPurchases(state: GameState, rawPurchased: unknown, rawLastLife: unknown, buyables: GameConfig['buyables']): void {
  const owned: Record<string, number> = {};
  if (isRecord(rawPurchased)) for (const [id, n] of Object.entries(rawPurchased)) owned[id] = readCount(n);
  const purchased = state.sleeve.purchased;
  const caps = new BuyableCaps(buyables);
  for (const b of buyables) {
    const count = Math.min(owned[b.id] ?? 0, caps.maxCopies(b, owned), Number.MAX_SAFE_INTEGER);
    if (count > 0) purchased[b.id] = count;
  }
  dropUnmetRequirements(purchased, buyables);
  // last life's purchases: only action-card purchases that exist, whole counts, never above what could have been owned
  const savedLastLife = isRecord(rawLastLife) ? rawLastLife : {};
  for (const b of buyables) {
    const count = Math.min(readCount(savedLastLife[b.id]), caps.maxCopies(b, purchased), Number.MAX_SAFE_INTEGER);
    if (count > 0 && isActionCardPurchase(b)) state.wallet.lastLifePurchases[b.id] = count;
  }
  // a skill dropped above may have been the one that allowed the extra copies of another buyable
  for (const b of buyables) {
    const count = purchased[b.id] ?? 0;
    if (count > caps.maxCopies(b, purchased)) purchased[b.id] = caps.maxCopies(b, purchased);
  }
}

/** Reads the auto-run switches: only toggleable buyables that are saved as off. */
export function readAutoRunOff(state: GameState, raw: unknown, buyables: GameConfig['buyables']): void {
  const savedOff = isRecord(raw) ? raw : {};
  for (const b of buyables) if (traitsOf(b).toggleable && savedOff[b.id] === true) state.sleeve.autoRunOff[b.id] = true;
}

/**
 * Reads the Overclock and Focus toggles: only known actions that are saved as `true`. A toggle is kept only for an action whose
 * unlock is owned (Overclock also needs the action to have an Overclock rule), and Focus only up to the number of Focus slots
 * (`focus.baseSlots` plus the bought ones, in configuration order), so a save cannot switch on more than the player has bought.
 */
export function readToggles(
  state: GameState,
  raw: Record<string, unknown>,
  config: Pick<GameConfig, 'actions' | 'buyables' | 'focus'>,
): void {
  const sleeve = state.sleeve;
  const savedOverclock = isRecord(raw['overclocked']) ? raw['overclocked'] : {};
  const savedFocus = isRecord(raw['focused']) ? raw['focused'] : {};
  const unlocked = (kind: string, actionId: string): boolean =>
    config.buyables.some((b) => b.effect.kind === kind && b.actionId === actionId && (sleeve.purchased[b.id] ?? 0) > 0);
  const savedStacks = isRecord(raw['focusStacks']) ? raw['focusStacks'] : {};
  const stacking = config.buyables.some((b) => b.effect.kind === 'focusStacking' && (sleeve.purchased[b.id] ?? 0) > 0);
  let slots =
    config.focus.baseSlots +
    config.buyables.reduce((n, b) => (b.effect.kind === 'focusSlots' ? n + b.effect.perCopy * (sleeve.purchased[b.id] ?? 0) : n), 0);
  for (const def of config.actions) {
    if (def.overclock && unlocked('overclockUnlock', def.id) && savedOverclock[def.id] === true) sleeve.overclocked[def.id] = true;
    if (slots > 0 && unlocked('focusUnlock', def.id) && savedFocus[def.id] === true) {
      sleeve.focused[def.id] = true;
      slots--;
      // extra slots on the same action only with the stacking skill, and never more than the slots that are left
      const stacks = stacking ? Math.min(readCount(savedStacks[def.id]), slots) : 0;
      if (stacks > 0) sleeve.focusStacks[def.id] = stacks;
      slots -= stacks;
    }
  }
}

/**
 * Reads the banked critical successes, the key toggles and the Overclock chains. A key toggle stays on only while the key is held (it
 * switches itself off at 0); a chain is kept only for an action that owns a chain buyable, never longer than its rule allows. Runs after the
 * purchases and the inventory.
 */
export function readCriticalsAndChains(
  state: GameState,
  raw: Record<string, unknown>,
  config: Pick<GameConfig, 'actions' | 'buyables' | 'items'>,
): void {
  const sleeve = state.sleeve;
  const savedBank = isRecord(raw['bankedCriticals']) ? raw['bankedCriticals'] : {};
  for (const def of config.actions) {
    const count = Math.min(readCount(savedBank[def.id]), Number.MAX_SAFE_INTEGER);
    if (count > 0) sleeve.bankedCriticals[def.id] = count;
  }
  const stack = config.items.rarities[0];
  const heldKey = (rule: { itemId: string } | undefined): boolean =>
    rule !== undefined && stack !== undefined && (state.wallet.inventory[rule.itemId]?.[stack.id] ?? 0) > 0;
  const savedKeys = isRecord(raw['keyToggles']) ? raw['keyToggles'] : {};
  if (savedKeys['zeroDay'] === true && heldKey(config.items.zeroDay)) sleeve.keyToggles['zeroDay'] = true;
  if (savedKeys['adminKey'] === true && heldKey(config.items.adminKey)) sleeve.keyToggles['adminKey'] = true;
  const savedChains = isRecord(raw['chains']) ? raw['chains'] : {};
  for (const def of config.actions) {
    const rule = config.buyables.find(
      (b) => b.effect.kind === 'overclockChain' && b.actionId === def.id && (sleeve.purchased[b.id] ?? 0) > 0,
    );
    const links = Math.min(readCount(savedChains[def.id]), rule?.effect.kind === 'overclockChain' ? rule.effect.chain.maxLinks : 0);
    if (links > 0) sleeve.chains[def.id] = links;
  }
}
