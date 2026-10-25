/**
 * @module core
 *
 * Converts {@link GameState} to and from a JSON string.
 *
 * @remarks
 * The save format is plain data (numbers as strings) with a `version` field so
 * migrations can be added. Parsing is defensive: unknown ids are ignored,
 * missing parts fall back to a fresh game, corrupt input yields `null`.
 *
 * Loaded values are sanitised, not trusted: negative amounts become 0, non-finite times are dropped, the run counter is
 * kept below `runsPerSleeveXp`, copy counts are capped, and a buyable whose `requires` are not owned is discarded.
 *
 * Only the current version is read (the game has not been released). A scalar that a save lacks (a field added later) keeps its fresh-game value, so adding a scalar needs no new
 * version; changing the meaning of an existing field does, together with a migration.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { traitsOf } from './effectTraits';
import { SCALAR_FIELDS, readScalar, writeScalars } from './fields';
import { createInitialState } from './state';
import type { GameConfig, GameState, GameStateView } from './types';

/** Current save format version. */
export const SAVE_VERSION = 4;

/**
 * Shape of the stored JSON (current version): `version`, one entry per scalar field of `fields.ts` (amounts as strings, plain
 * numbers as numbers), the per-action progress, the flag maps and the owned copies.
 */
interface SaveData {
  version: number;
  [scalar: string]: unknown;
  autoRunOff: Record<string, boolean>;
  overclocked: Record<string, boolean>;
  focused: Record<string, boolean>;
  zeroDaysOn: boolean;
  adminKeysOn: boolean;
  chains: Record<string, number>;
  bankedCriticals: Record<string, number>;
  actions: Record<
    string,
    {
      xp: string;
      sleeveXp: string;
      runsTowardSleeveXp: number;
      augments: Record<string, number>;
      skillShards: number;
      running: boolean;
      progress: number;
    }
  >;
  purchased: Record<string, number>;
  inventory: Record<string, Record<string, number>>;
}

/**
 * Serialises the state.
 *
 * Called by: `app/persistence.ts`.
 *
 * @param state state to save
 * @returns a JSON string
 */
export function serializeState(state: GameStateView): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    autoRunOff: { ...state.autoRunOff },
    overclocked: { ...state.overclocked },
    focused: { ...state.focused },
    zeroDaysOn: state.zeroDaysOn,
    adminKeysOn: state.adminKeysOn,
    chains: { ...state.chains },
    bankedCriticals: { ...state.bankedCriticals },
    actions: Object.fromEntries(
      Object.entries(state.actions).map(([id, a]) => [
        id,
        {
          xp: a.xp.toString(),
          sleeveXp: a.sleeveXp.toString(),
          runsTowardSleeveXp: a.runsTowardSleeveXp,
          augments: { ...a.augments },
          skillShards: a.skillShards,
          running: a.running,
          progress: a.progress,
        },
      ]),
    ),
    purchased: { ...state.purchased },
    inventory: writeInventory(state.inventory),
  };
  writeScalars(state, data);
  return JSON.stringify(data);
}

/**
 * Restores a state from JSON (the current format version).
 *
 * Called by: `app/persistence.ts`.
 *
 * @param json text produced by {@link serializeState}
 * @param config game content (decides which ids are valid and the cap on copies owned)
 * @param factory number factory
 * @returns the restored state, or `null` if `json` is not a valid save
 */
export function deserializeState(
  json: string,
  config: Pick<GameConfig, 'actions' | 'buyables' | 'focus' | 'items' | 'progression' | 'sleeve'>,
  factory: NumberFactory,
): GameState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const version = raw['version'];
  if (version !== SAVE_VERSION) return null;

  try {
    const state = createInitialState(config, factory);
    // Scalars (credits, network, heat, ...): an optional entry that is missing or unusable keeps its fresh-game value.
    const target = state as unknown as Record<string, unknown>;
    for (const field of SCALAR_FIELDS) target[field.key] = readScalar(field, raw[field.key], config, factory);
    const savedOff = isRecord(raw['autoRunOff']) ? raw['autoRunOff'] : {};
    for (const b of config.buyables) if (traitsOf(b).toggleable && savedOff[b.id] === true) state.autoRunOff[b.id] = true;

    const runsPerSleeveXp = config.progression.runsPerSleeveXp;
    const savedActions = isRecord(raw['actions']) ? raw['actions'] : {};
    for (const def of config.actions) {
      const saved = savedActions[def.id];
      if (!isRecord(saved)) continue;
      state.actions[def.id] = {
        xp: readAmount(saved['xp'], factory),
        sleeveXp: readAmount(saved['sleeveXp'], factory),
        runsTowardSleeveXp: readCount(saved['runsTowardSleeveXp']) % runsPerSleeveXp,
        augments: readAugments(saved['augments'], config.items),
        skillShards: Math.min(readCount(saved['skillShards']), Number.MAX_SAFE_INTEGER),
        running: saved['running'] === true,
        progress: readProgress(saved['progress']),
      };
    }

    const owned = readPurchased(raw['purchased']);
    for (const b of config.buyables) {
      const count = Math.min(owned[b.id] ?? 0, b.maxPurchases ?? 1, Number.MAX_SAFE_INTEGER);
      if (count > 0) state.purchased[b.id] = count;
    }
    dropUnmetRequirements(state, config.buyables);
    readToggles(state, raw, config);
    state.inventory = readInventory(raw['inventory'], config.items);
    const savedBank = isRecord(raw['bankedCriticals']) ? raw['bankedCriticals'] : {};
    for (const def of config.actions) {
      const count = Math.min(readCount(savedBank[def.id]), Number.MAX_SAFE_INTEGER);
      if (count > 0) state.bankedCriticals[def.id] = count;
    }
    // The Zero-day and Admin key toggles stay on only while one is held (they switch themselves off at 0).
    const stack = config.items.rarities[0];
    const heldKey = (rule: { itemId: string } | undefined): boolean =>
      rule !== undefined && stack !== undefined && (state.inventory[rule.itemId]?.[stack.id] ?? 0) > 0;
    state.zeroDaysOn = raw['zeroDaysOn'] === true && heldKey(config.items.zeroDay);
    state.adminKeysOn = raw['adminKeysOn'] === true && heldKey(config.items.adminKey);
    // A chain is kept only for an action that owns a chain buyable, and never longer than its rule allows.
    const savedChains = isRecord(raw['chains']) ? raw['chains'] : {};
    for (const def of config.actions) {
      const rule = config.buyables.find(
        (b) => b.effect.kind === 'overclockChain' && b.actionId === def.id && (state.purchased[b.id] ?? 0) > 0,
      );
      const links = Math.min(readCount(savedChains[def.id]), rule?.effect.kind === 'overclockChain' ? rule.effect.chain.maxLinks : 0);
      if (links > 0) state.chains[def.id] = links;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * The inventory as it is saved: stacks that are used up (count 0) and items with no stack left are left out, the way
 * {@link readInventory} reads them back, so that saving, loading and saving again gives the same text.
 */
function writeInventory(inventory: GameStateView['inventory']): GameState['inventory'] {
  const out: GameState['inventory'] = {};
  for (const [item, stacks] of Object.entries(inventory)) {
    for (const [rarity, count] of Object.entries(stacks)) if (count > 0) (out[item] ??= {})[rarity] = count;
  }
  return out;
}

/**
 * Reads the Overclock and Focus toggles: only known actions that are saved as `true`. A toggle is kept only for an action whose
 * unlock is owned (Overclock also needs the action to have an Overclock rule), and Focus only up to the number of Focus slots
 * (`focus.baseSlots` plus the bought ones, in configuration order), so a save cannot switch on more than the player has bought.
 */
function readToggles(state: GameState, raw: Record<string, unknown>, config: Pick<GameConfig, 'actions' | 'buyables' | 'focus'>): void {
  const savedOverclock = isRecord(raw['overclocked']) ? raw['overclocked'] : {};
  const savedFocus = isRecord(raw['focused']) ? raw['focused'] : {};
  const unlocked = (kind: string, actionId: string): boolean =>
    config.buyables.some((b) => b.effect.kind === kind && b.actionId === actionId && (state.purchased[b.id] ?? 0) > 0);
  let slots =
    config.focus.baseSlots +
    config.buyables.reduce((n, b) => (b.effect.kind === 'focusSlots' ? n + b.effect.perCopy * (state.purchased[b.id] ?? 0) : n), 0);
  for (const def of config.actions) {
    if (def.overclock && unlocked('overclockUnlock', def.id) && savedOverclock[def.id] === true) state.overclocked[def.id] = true;
    if (slots > 0 && unlocked('focusUnlock', def.id) && savedFocus[def.id] === true) {
      state.focused[def.id] = true;
      slots--;
    }
  }
}

/** Reads `purchased` as a count per id (anything that is not a whole number >= 0 counts as 0). */
function readPurchased(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isRecord(v)) for (const [id, n] of Object.entries(v)) out[id] = readCount(n);
  return out;
}

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

/** Reads the inventory: only known items and rarities, whole counts above 0 (a save without one is an empty inventory). */
function readInventory(v: unknown, items: GameConfig['items']): GameState['inventory'] {
  const out: GameState['inventory'] = {};
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Removes owned buyables whose requirements are not owned, until the state is consistent (a save cannot skip a gate). */
function dropUnmetRequirements(state: GameState, buyables: GameConfig['buyables']): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of buyables) {
      if ((state.purchased[b.id] ?? 0) > 0 && !(b.requires ?? []).every((r) => (state.purchased[r] ?? 0) > 0)) {
        delete state.purchased[b.id];
        changed = true;
      }
    }
  }
}

/** Reads a finite amount; negative amounts become 0. @throws Error if the value is not a numeric string or not finite */
function readAmount(v: unknown, factory: NumberFactory): BigNum {
  const n = readNum(v, factory);
  return n.isNegative() ? factory.fromNumber(0) : n;
}

/** Reads the progress of a run: a share of the run, finite and from 0 up to (not including) 1, otherwise 0. */
function readProgress(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0;
}

function readNum(v: unknown, factory: NumberFactory): BigNum {
  if (typeof v !== 'string') throw new Error('expected numeric string');
  const n = factory.fromString(v);
  if (!n.isFinite()) throw new Error('non-finite number');
  return n;
}

function readCount(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}
