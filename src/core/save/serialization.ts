/**
 * @module core
 *
 * Converts {@link GameState} to and from a JSON string.
 *
 * @remarks
 * The save format is plain data (numbers as strings) with a `version` field so migrations can be added. Version 7 is nested: `wallet` (what
 * is shared), `sleeves` (a map keyed by sleeve id with one entry, {@link DEFAULT_SLEEVE_ID}) and, inside the wallet, `corporations` (a map keyed by id,
 * one entry). Parsing is defensive: unknown ids are ignored, missing parts fall back to a fresh game, corrupt input yields `null`.
 *
 * Loaded values are sanitised, not trusted: negative amounts become 0, non-finite times are dropped, the run counter is
 * kept below `runsPerSleeveXp`, copy counts are capped, and a buyable whose `requires` or `parents` are not owned is discarded.
 *
 * Each context writes and reads its own part (`SavePart`, composed by `saveParts.ts`); this file knows no context's data. Only the current version is read. An older save is first brought to this version by `migrate.ts` (`app/persistence.ts` does that before
 * reading). A scalar that a save lacks (a field added later) keeps its fresh-game value, so adding a scalar needs no new
 * version; changing the meaning of an existing field does, together with a migration.
 */
import type { NumberFactory } from '../../numbers';
import { SCALAR_FIELDS, readScalar, writeScalars } from '../kernel/fields';
import { DEFAULT_SLEEVE_ID } from '../kernel/savePart';
import { isRecord } from '../kernel/readValues';
import type { GameState, GameStateView } from '../types';
import { MIGRATED_VERSION } from './migrate';
import { SAVE_PARTS, SLEEVE_KEY_ORDER, type SaveConfig, WALLET_KEY_ORDER, inKeyOrder } from './saveParts';
import { createInitialState } from './state';

/** Current save format version. */
export const SAVE_VERSION = MIGRATED_VERSION;

/**
 * Serialises the state.
 *
 * Called by: `app/persistence.ts`. Calls: every part's `write` (`SAVE_PARTS`), `writeScalars`.
 *
 * @param state state to save
 * @returns a JSON string
 */
export function serializeState(state: GameStateView): string {
  const wallet: Record<string, unknown> = {};
  const sleeve: Record<string, unknown> = {};
  for (const part of SAVE_PARTS) {
    const fragments = part.write(state);
    Object.assign(wallet, fragments.wallet);
    Object.assign(sleeve, fragments.sleeve);
  }
  const walletData = inKeyOrder(wallet, WALLET_KEY_ORDER);
  const sleeveData = inKeyOrder(sleeve, SLEEVE_KEY_ORDER);
  writeScalars(state, { wallet: walletData, sleeve: sleeveData });
  return JSON.stringify({ version: SAVE_VERSION, wallet: walletData, sleeves: { [DEFAULT_SLEEVE_ID]: sleeveData } });
}

/**
 * Restores a state from JSON (the current format version; older saves go through `migrateSave` first).
 *
 * Called by: `app/persistence.ts`. Calls: `readScalar`, every part's `read` (`SAVE_PARTS`, in that order).
 *
 * @param json text produced by {@link serializeState}
 * @param config game content (decides which ids are valid and the cap on copies owned)
 * @param factory number factory
 * @returns the restored state, or `null` if `json` is not a valid save
 */
export function deserializeState(json: string, config: SaveConfig, factory: NumberFactory): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed['version'] !== SAVE_VERSION) return null;
  const sleeves = isRecord(parsed['sleeves']) ? parsed['sleeves'] : {};
  const raw = {
    wallet: isRecord(parsed['wallet']) ? parsed['wallet'] : {},
    sleeve: isRecord(sleeves[DEFAULT_SLEEVE_ID]) ? sleeves[DEFAULT_SLEEVE_ID] : {},
  };

  try {
    const state = createInitialState(config, factory);
    // Scalars (credits, network, heat, ...): an optional entry that is missing or unusable keeps its fresh-game value.
    for (const field of SCALAR_FIELDS) {
      (state[field.owner] as unknown as Record<string, unknown>)[field.key] = readScalar(
        field,
        raw[field.owner][field.key],
        config,
        factory,
      );
    }
    for (const part of SAVE_PARTS) part.read(state, raw, config, factory);
    return state;
  } catch {
    return null;
  }
}
