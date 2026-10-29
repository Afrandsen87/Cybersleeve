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
 * Only the current version is read. An older save is first brought to this version by `migrate.ts` (`app/persistence.ts` does that before
 * reading). A scalar that a save lacks (a field added later) keeps its fresh-game value, so adding a scalar needs no new
 * version; changing the meaning of an existing field does, together with a migration.
 */
import type { NumberFactory } from '../../numbers';
import { readCorporationState, writeCorporationState } from '../corporation/corporationState';
import { SCALAR_FIELDS, readScalar, writeScalars } from '../kernel/fields';
import { INFINITY } from '../kernel/infinity';
import type { GameConfig, GameState, GameStateView } from '../types';
import { DEFAULT_SLEEVE_ID, MIGRATED_VERSION } from './migrate';
import { isRecord, readAutomation, readInventory, readRuns, readSynths, writeInventory } from './saveReaders';
import { readActions, readAutoRunOff, readCriticalsAndChains, readPurchases, readToggles } from './sleeveReaders';
import { createInitialState } from './state';

/** Current save format version. */
export const SAVE_VERSION = MIGRATED_VERSION;

/** The part of the content a save is read against. */
type SaveConfig = Pick<GameConfig, 'actions' | 'buyables' | 'corporation' | 'focus' | 'items' | 'progression' | 'sleeve' | 'automation'>;

/** The key toggles that are on, by key kind (the off ones are left out, so save, load, save gives the same text). */
function writeKeyToggles(toggles: Readonly<Record<string, boolean>>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(toggles).filter(([, on]) => on));
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
  const { wallet, sleeve } = state;
  const walletData: Record<string, unknown> = {
    lastLifePurchases: { ...wallet.lastLifePurchases },
    runs: wallet.runs.map((r) => ({
      creditsPerSecond: r.creditsPerSecond.toString(),
      actionLevelsTotal: r.actionLevelsTotal,
      ...(r.actionLevels ? { actionLevels: { ...r.actionLevels } } : {}),
    })),
    synths: wallet.synths.map((s) => ({ runIndex: s.runIndex })),
    corporations: { [DEFAULT_SLEEVE_ID]: writeCorporationState(wallet.corporation) },
    automation: {
      autoBurnOn: wallet.automation.autoBurnOn,
      autoBurnCeiling: wallet.automation.autoBurnCeiling,
      autosale: { ...wallet.automation.autosale },
      dispersal: { ...wallet.automation.dispersal },
    },
    inventory: writeInventory(wallet.inventory),
  };
  const sleeveData: Record<string, unknown> = {
    autoRunOff: { ...sleeve.autoRunOff },
    overclocked: { ...sleeve.overclocked },
    focused: { ...sleeve.focused },
    focusStacks: { ...sleeve.focusStacks },
    keyToggles: writeKeyToggles(sleeve.keyToggles),
    chains: { ...sleeve.chains },
    bankedCriticals: { ...sleeve.bankedCriticals },
    actions: Object.fromEntries(
      Object.entries(sleeve.actions).map(([id, a]) => [
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
    purchased: { ...sleeve.purchased },
  };
  writeScalars(state, { wallet: walletData, sleeve: sleeveData });
  return JSON.stringify({ version: SAVE_VERSION, wallet: walletData, sleeves: { [DEFAULT_SLEEVE_ID]: sleeveData } });
}

/**
 * Restores a state from JSON (the current format version; older saves go through `migrateSave` first).
 *
 * Called by: `app/persistence.ts`.
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
  const rawWallet = isRecord(parsed['wallet']) ? parsed['wallet'] : {};
  const rawSleeve = isRecord(sleeves[DEFAULT_SLEEVE_ID]) ? sleeves[DEFAULT_SLEEVE_ID] : {};

  try {
    const state = createInitialState(config, factory);
    // Scalars (credits, network, heat, ...): an optional entry that is missing or unusable keeps its fresh-game value.
    const raws = { wallet: rawWallet, sleeve: rawSleeve };
    for (const field of SCALAR_FIELDS) {
      (state[field.owner] as unknown as Record<string, unknown>)[field.key] = readScalar(
        field,
        raws[field.owner][field.key],
        config,
        factory,
      );
    }
    readAutoRunOff(state, rawSleeve['autoRunOff'], config.buyables);
    readActions(state, rawSleeve['actions'], config, factory);
    readPurchases(state, rawSleeve['purchased'], rawWallet['lastLifePurchases'], config.buyables);
    state.wallet.runs = readRuns(rawWallet['runs'], factory, INFINITY);
    state.wallet.synths = readSynths(rawWallet['synths'], state, config.buyables);
    const corporations = isRecord(rawWallet['corporations']) ? rawWallet['corporations'] : {};
    state.wallet.corporation = readCorporationState(corporations[DEFAULT_SLEEVE_ID], config.corporation, factory);
    readToggles(state, rawSleeve, config);
    state.wallet.inventory = readInventory(rawWallet['inventory'], config.items);
    readCriticalsAndChains(state, rawSleeve, config);
    readAutomation(state, rawWallet['automation'], config);
    return state;
  } catch {
    return null;
  }
}
