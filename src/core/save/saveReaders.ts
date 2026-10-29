/**
 * @module core
 *
 * Defensive readers for the pieces of a save: plain values and the wallet's collections.
 *
 * @remarks
 * Nothing in a save is trusted. Every reader turns what it cannot use into the neutral value (0, empty, off). The sleeve's pieces are read by
 * `sleeveReaders.ts`.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { type AUTOMATION_FEATURES, isFeatureUnlocked } from '../automation/automation';
import type { GameConfig, GameState, Wallet } from '../types';

/** True for a plain object (not null, not an array). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads a whole number >= 0 (anything else is 0). */
export function readCount(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/** Reads a finite numeric string. @throws Error if the value is not a numeric string or not finite */
export function readNum(v: unknown, factory: NumberFactory): BigNum {
  if (typeof v !== 'string') throw new Error('expected numeric string');
  const n = factory.fromString(v);
  if (!n.isFinite()) throw new Error('non-finite number');
  return n;
}

/** Reads a finite amount; negative amounts become 0. @throws Error if the value is not a numeric string or not finite */
export function readAmount(v: unknown, factory: NumberFactory): BigNum {
  const n = readNum(v, factory);
  return n.isNegative() ? factory.fromNumber(0) : n;
}

/** Reads the progress of a run: a share of the run, finite and from 0 up to (not including) 1, otherwise 0. */
export function readProgress(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0;
}

/**
 * The inventory as it is saved: stacks that are used up (count 0) and items with no stack left are left out, the way
 * {@link readInventory} reads them back, so that saving, loading and saving again gives the same text.
 */
export function writeInventory(inventory: Readonly<Record<string, Readonly<Record<string, number>>>>): Wallet['inventory'] {
  const out: Wallet['inventory'] = {};
  for (const [item, stacks] of Object.entries(inventory)) {
    for (const [rarity, count] of Object.entries(stacks)) if (count > 0) (out[item] ??= {})[rarity] = count;
  }
  return out;
}

/** Reads the inventory: only known items and rarities, whole counts above 0 (a save without one is an empty inventory). */
export function readInventory(v: unknown, items: GameConfig['items']): Wallet['inventory'] {
  const out: Wallet['inventory'] = {};
  if (!isRecord(v)) return out;
  for (const item of items.definitions) {
    const saved = v[item.id];
    if (!isRecord(saved)) continue;
    for (const rarity of items.rarities) {
      const count = Math.min(readCount(saved[rarity.id]), Number.MAX_SAFE_INTEGER);
      if (count > 0) (out[item.id] ??= {})[rarity.id] = count;
    }
  }
  return out;
}

/**
 * Reads the record of finished runs. An entry that cannot be read becomes a run that earned nothing (rather than being dropped), so the
 * runs keep their positions and the synthetic sleeves that point at them still point at the right run.
 */
export function readRuns(v: unknown, factory: NumberFactory, infinity: number): Wallet['runs'] {
  if (!Array.isArray(v)) return [];
  return v.map((entry): Wallet['runs'][number] => {
    if (!isRecord(entry)) return { creditsPerSecond: factory.fromNumber(0), actionLevelsTotal: 0 };
    let creditsPerSecond: BigNum;
    try {
      creditsPerSecond = readAmount(entry['creditsPerSecond'], factory);
    } catch {
      creditsPerSecond = factory.fromNumber(0);
    }
    const saved = entry['actionLevels'];
    const actionLevels: Record<string, number> = {};
    if (isRecord(saved)) for (const [id, level] of Object.entries(saved)) actionLevels[id] = Math.min(readCount(level), infinity);
    return {
      creditsPerSecond,
      actionLevelsTotal: readCount(entry['actionLevelsTotal']),
      ...(isRecord(saved) ? { actionLevels } : {}),
    };
  });
}

/**
 * Reads the synthetic sleeves: only ones that point at a run that exists, and none at all unless the player owns the skill that gives them
 * (a save cannot hand out sleeves).
 */
export function readSynths(v: unknown, state: GameState, buyables: GameConfig['buyables']): Wallet['synths'] {
  const unlocked = buyables.some((b) => b.effect.kind === 'synthSleeves' && (state.sleeve.purchased[b.id] ?? 0) > 0);
  if (!unlocked || !Array.isArray(v)) return [];
  const out: Wallet['synths'] = [];
  for (const entry of v) {
    const index = isRecord(entry) ? entry['runIndex'] : undefined;
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < state.wallet.runs.length)
      out.push({ runIndex: index });
  }
  return out;
}

/**
 * Reads the automation settings (a feature is unlocked when its skill is owned, so this runs after the purchases are read): Auto Burn is on only when unlocked, the ceiling must be a finite number >= 0, and
 * autosale and dispersal keep only known rarities and actions (shares clamped to 1..100).
 */
export function readAutomation(
  state: GameState,
  raw: unknown,
  config: Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>,
): void {
  if (config.automation === undefined || !isRecord(raw)) return;
  const unlocked = (feature: (typeof AUTOMATION_FEATURES)[number]): boolean =>
    isFeatureUnlocked(config.buyables, state.sleeve.purchased, feature);
  const auto = state.wallet.automation;
  const ceiling = raw['autoBurnCeiling'];
  if (typeof ceiling === 'number' && Number.isFinite(ceiling) && ceiling >= 0) auto.autoBurnCeiling = ceiling;
  auto.autoBurnOn = raw['autoBurnOn'] === true && unlocked('autoBurn');
  const savedSale = isRecord(raw['autosale']) ? raw['autosale'] : {};
  const savedShares = isRecord(raw['dispersal']) ? raw['dispersal'] : {};
  if (unlocked('autosale')) for (const r of config.items.rarities) if (savedSale[r.id] === true) auto.autosale[r.id] = true;
  if (unlocked('dispersal')) {
    let room = 100;
    for (const a of config.actions) {
      const share = savedShares[a.id];
      if (typeof share !== 'number' || !Number.isFinite(share) || share <= 0 || room <= 0) continue;
      auto.dispersal[a.id] = Math.min(room, share);
      room -= auto.dispersal[a.id] ?? 0;
    }
  }
}
