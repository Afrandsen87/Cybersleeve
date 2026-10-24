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
 * Versions: 1 stored `purchased` as a list of ids (one copy each); 2 stores copy counts; 3 moves sleeve XP and
 * its run counter from the top level into each action and adds the network. Version 1 and 2 saves are still
 * readable: their global sleeve XP is given to the first action in the configuration.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { SCALAR_FIELDS, readScalar, writeScalars } from './fields';
import { createInitialState } from './state';
import type { GameConfig, GameState, GameStateView } from './types';

/** Current save format version. */
export const SAVE_VERSION = 3;

/**
 * Shape of the stored JSON (version 3): `version`, one entry per scalar field of `fields.ts` (amounts as strings, plain
 * numbers as numbers), the per-action progress, the flag maps and the owned copies.
 */
interface SaveData {
  version: number;
  [scalar: string]: unknown;
  unlockedActions: Record<string, boolean>;
  autoRunOff: Record<string, boolean>;
  actions: Record<string, { xp: string; sleeveXp: string; runsTowardSleeveXp: number; running: boolean; progressMs: number }>;
  purchased: Record<string, number>;
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
    unlockedActions: { ...state.unlockedActions },
    autoRunOff: { ...state.autoRunOff },
    actions: Object.fromEntries(
      Object.entries(state.actions).map(([id, a]) => [
        id,
        {
          xp: a.xp.toString(),
          sleeveXp: a.sleeveXp.toString(),
          runsTowardSleeveXp: a.runsTowardSleeveXp,
          running: a.running,
          progressMs: a.progressMs,
        },
      ]),
    ),
    purchased: { ...state.purchased },
  };
  writeScalars(state, data);
  return JSON.stringify(data);
}

/**
 * Restores a state from JSON (format versions 1 to 3).
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
  config: Pick<GameConfig, 'actions' | 'buyables' | 'progression' | 'sleeve'>,
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
  if (version !== 1 && version !== 2 && version !== SAVE_VERSION) return null;

  try {
    const state = createInitialState(config, factory);
    // Scalars (credits, network, heat, ...): credits are read from every version, the rest only from the current one;
    // an entry that is missing or unusable keeps its fresh-game value.
    const target = state as unknown as Record<string, unknown>;
    for (const field of SCALAR_FIELDS) {
      if (version === SAVE_VERSION || field.key === 'credits') target[field.key] = readScalar(field, raw[field.key], config, factory);
    }
    if (version === SAVE_VERSION) {
      const savedUnlocked = isRecord(raw['unlockedActions']) ? raw['unlockedActions'] : {};
      for (const a of config.actions) if (a.unlock?.kind === 'nodes' && savedUnlocked[a.id] === true) state.unlockedActions[a.id] = true;
      const savedOff = isRecord(raw['autoRunOff']) ? raw['autoRunOff'] : {};
      for (const b of config.buyables) if (b.effect.kind === 'autoRun' && savedOff[b.id] === true) state.autoRunOff[b.id] = true;
    }

    const runsPerSleeveXp = config.progression.runsPerSleeveXp;
    const savedActions = isRecord(raw['actions']) ? raw['actions'] : {};
    for (const def of config.actions) {
      const saved = savedActions[def.id];
      if (!isRecord(saved)) continue;
      state.actions[def.id] = {
        xp: readAmount(saved['xp'], factory),
        sleeveXp: version === SAVE_VERSION ? readAmount(saved['sleeveXp'], factory) : factory.fromNumber(0),
        runsTowardSleeveXp: version === SAVE_VERSION ? readCount(saved['runsTowardSleeveXp']) % runsPerSleeveXp : 0,
        running: saved['running'] === true,
        progressMs: readTime(saved['progressMs']),
      };
    }

    // Before version 3 sleeve XP was global; it moves to the first action.
    const first = config.actions[0];
    const firstState = first ? state.actions[first.id] : undefined;
    if (version !== SAVE_VERSION && firstState) {
      firstState.sleeveXp = readAmount(raw['sleeveXp'], factory);
      firstState.runsTowardSleeveXp = readCount(raw['runsTowardSleeveXp']) % runsPerSleeveXp;
    }

    const owned = readPurchased(raw['purchased'], version);
    for (const b of config.buyables) {
      const count = Math.min(owned[b.id] ?? 0, b.maxPurchases ?? 1, Number.MAX_SAFE_INTEGER);
      if (count > 0) state.purchased[b.id] = count;
    }
    dropUnmetRequirements(state, config.buyables);
    return state;
  } catch {
    return null;
  }
}

/** Normalises `purchased` of either format to a count per id. */
function readPurchased(v: unknown, version: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (version === 1) {
    if (Array.isArray(v)) for (const id of v) if (typeof id === 'string') out[id] = 1;
  } else if (isRecord(v)) {
    for (const [id, n] of Object.entries(v)) out[id] = readCount(n);
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

/** Reads a time in ms: finite and >= 0, otherwise 0. */
function readTime(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
