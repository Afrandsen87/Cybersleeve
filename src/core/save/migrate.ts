/**
 * @module core
 *
 * Migration of an older save to the current format (the only place that knows an old shape).
 *
 * @remarks
 * v6 was one flat object. v7 keeps the shared part in `wallet` and one sleeve under `sleeves.main`. The mapping is 1-to-1: no value
 * changes, except that the two all-time peak statistics are new and start at the peak of the current life, and the two key toggles
 * (`zeroDaysOn`, `adminKeysOn`) become the keyed `keyToggles`. Keys v6 never wrote are not invented, so the reader's defaults apply.
 * Unknown keys are dropped, as the reader always ignored them.
 *
 * v8 split the old "Unlock resleeving" purchase in two: Sleeve levels (id `sleeve-levels`, the old purchase kept under its id) and the
 * new Unlock resleeving (`resleeve-unlock`). A v7 save that owns the first bought the old 100e9 unlock, so it also gets the second.
 * v9 (one bump for the change batch) adds the reveal ledger, the Auto Burn resume lists (and drops the removed Pick Targets skill), and the
 * sleeve-level total on run records. The last needs the game config, so it is a post-load step ({@link needsProgressionBackfill}).
 * The migrations chain: a v6 save goes through {@link migrateV6}, {@link migrateV7} and {@link migrateV8}.
 */

/** The version the migration writes (the current save version). */
export const MIGRATED_VERSION = 9;

/** The version {@link migrateV7} writes. */
const V8 = 8;

/** The version {@link migrateV6} writes. */
const V7 = 7;

/** Content id of the old unlock that v7 saves own (now Sleeve levels). Written here because only the migration knows the v7 meaning. */
const V7_UNLOCK_ID = 'sleeve-levels';

/** Content id of the purchase v8 added (Unlock resleeving); a content test checks it still matches `RESLEEVE_UNLOCK`. */
const V8_RESLEEVE_UNLOCK_ID = 'resleeve-unlock';

// The ids of the only sleeve and the only corporation live in the kernel, where the contexts' save parts can read them; the migration writes under them.
export { DEFAULT_SLEEVE_ID } from '../kernel/savePart';
import { migrateAutoBurnResume } from '../automation/autoBurnMigration';
import { addRevealedLedger } from '../economy/revealLedgerSave';
import { DEFAULT_CORPORATION_ID, DEFAULT_SLEEVE_ID } from '../kernel/savePart';
import { isRecord } from '../kernel/readValues';

const WALLET_KEYS = ['credits', 'inventory', 'runs', 'lastLifePurchases', 'synths', 'automation'] as const;
const SLEEVE_KEYS = [
  'purchased',
  'actions',
  'peakCredits',
  'peakNetwork',
  'network',
  'heat',
  'heatCooldownMs',
  'iceRating',
  'legend',
  'legendCooldownMs',
  'resleeveLockoutMs',
  'moles',
  'networkRemainder',
  'nodePayoutBonus',
  'hackingProficiency',
  'autoRunOff',
  'overclocked',
  'focused',
  'focusStacks',
  'bankedCriticals',
  'chains',
] as const;

/** Copies the listed keys that `from` has (a key it lacks stays absent). */
function pick(from: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in from) out[key] = from[key];
  return out;
}

/**
 * Turns a flat v6 save object into the nested v7 one (then {@link migrateV7} brings it to the current version).
 *
 * Called by: {@link migrateSave}.
 *
 * @param flat the parsed v6 save
 * @returns the v7 save object (a new object; `flat` is not changed)
 */
export function migrateV6(flat: Record<string, unknown>): Record<string, unknown> {
  const wallet = pick(flat, WALLET_KEYS);
  // all-time peaks are new: they start at the peak of the life being lived (absent in the save: the reader's fresh value applies)
  if ('peakCredits' in flat) wallet['allTimePeakCredits'] = flat['peakCredits'];
  if ('peakNetwork' in flat) wallet['allTimePeakNetwork'] = flat['peakNetwork'];
  if ('corporation' in flat) wallet['corporations'] = { [DEFAULT_CORPORATION_ID]: flat['corporation'] };
  const sleeve = pick(flat, SLEEVE_KEYS);
  sleeve['keyToggles'] = {
    ...(flat['zeroDaysOn'] === true ? { zeroDay: true } : {}),
    ...(flat['adminKeysOn'] === true ? { adminKey: true } : {}),
  };
  return { version: V7, wallet, sleeves: { [DEFAULT_SLEEVE_ID]: sleeve } };
}

/**
 * Turns a v7 save object into the v8 one: a sleeve that owns Sleeve levels (the old Unlock resleeving) also owns the new Unlock resleeving.
 *
 * Called by: {@link migrateSave}.
 *
 * @param save the parsed v7 save (also what {@link migrateV6} returns)
 * @returns the v8 save object (a new object; `save` is not changed)
 */
export function migrateV7(save: Record<string, unknown>): Record<string, unknown> {
  const sleeves = save['sleeves'];
  if (typeof sleeves !== 'object' || sleeves === null || Array.isArray(sleeves)) return { ...save, version: V8 };
  const migrated: Record<string, unknown> = {};
  for (const [id, sleeve] of Object.entries(sleeves)) {
    const purchased = (sleeve as Record<string, unknown> | null)?.['purchased'];
    const owned = typeof purchased === 'object' && purchased !== null ? (purchased as Record<string, unknown>) : null;
    const ownsOld = owned !== null && Number(owned[V7_UNLOCK_ID]) > 0;
    migrated[id] = ownsOld ? { ...(sleeve as object), purchased: { ...owned, [V8_RESLEEVE_UNLOCK_ID]: 1 } } : sleeve;
  }
  return { ...save, version: V8, sleeves: migrated };
}

/**
 * Turns a v8 save object into the v9 one: adds the reveal ledger (`wallet.revealed`), the Auto Burn resume lists (pre-ticked from what
 * the life had switched off) and drops the owned Pick Targets skill. The sleeve-level total of run records is added after loading.
 *
 * Called by: {@link migrateSave}. Calls: `addRevealedLedger`, `migrateAutoBurnResume`.
 *
 * @param save the parsed v8 save
 * @returns the v9 save object (a new object; `save` is not changed)
 */
export function migrateV8(save: Record<string, unknown>): Record<string, unknown> {
  const withLedger = addRevealedLedger(save) as Record<string, unknown>;
  const sleeves = withLedger['sleeves'];
  const wallet = withLedger['wallet'];
  if (!isRecord(sleeves) || !isRecord(wallet)) return { ...withLedger, version: MIGRATED_VERSION };
  const main = sleeves[DEFAULT_SLEEVE_ID];
  if (!isRecord(main)) return { ...withLedger, version: MIGRATED_VERSION };
  const migrated = migrateAutoBurnResume({ wallet, sleeve: main });
  return {
    ...withLedger,
    version: MIGRATED_VERSION,
    wallet: migrated.wallet,
    sleeves: { ...sleeves, [DEFAULT_SLEEVE_ID]: migrated.sleeve },
  };
}

/**
 * Whether a stored save predates v9, so its newest run record still needs its sleeve-level total (`migrateProgressionSave`, run by the loader
 * once the config is at hand).
 *
 * Called by: `app/persistence.ts`. Calls: nothing.
 *
 * @param json saved text of any version
 * @returns true for a parsable save of version 6, 7 or 8
 */
export function needsProgressionBackfill(json: string): boolean {
  try {
    const version = (JSON.parse(json) as { version?: unknown } | null)?.version;
    return version === 6 || version === V7 || version === V8;
  } catch {
    return false;
  }
}

/**
 * Brings saved text to the current format.
 *
 * Called by: `app/persistence.ts` (before every read of a stored or pasted save).
 * Calls: {@link migrateV6}, {@link migrateV7}, {@link migrateV8}.
 *
 * @param json saved text, of any version
 * @returns the text unchanged when it is already the current version or not a save this code understands (the reader then rejects it as it always did),
 *   otherwise the migrated text
 */
export function migrateSave(json: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return json;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return json;
  const flat = parsed as Record<string, unknown>;
  if (flat['version'] === 6) return JSON.stringify(migrateV8(migrateV7(migrateV6(flat))));
  if (flat['version'] === V7) return JSON.stringify(migrateV8(migrateV7(flat)));
  return flat['version'] === V8 ? JSON.stringify(migrateV8(flat)) : json;
}
