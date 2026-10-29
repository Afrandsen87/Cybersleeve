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
 */

/** The version the migration writes (the current save version). */
export const MIGRATED_VERSION = 7;

/** Id of the only sleeve (and the only corporation) in a save: the migration of a v6 save writes everything under it. */
export const DEFAULT_SLEEVE_ID = 'main';

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
 * Turns a flat v6 save object into the nested v7 one.
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
  if ('corporation' in flat) wallet['corporations'] = { [DEFAULT_SLEEVE_ID]: flat['corporation'] };
  const sleeve = pick(flat, SLEEVE_KEYS);
  sleeve['keyToggles'] = {
    ...(flat['zeroDaysOn'] === true ? { zeroDay: true } : {}),
    ...(flat['adminKeysOn'] === true ? { adminKey: true } : {}),
  };
  return { version: MIGRATED_VERSION, wallet, sleeves: { [DEFAULT_SLEEVE_ID]: sleeve } };
}

/**
 * Brings saved text to the current format.
 *
 * Called by: `app/persistence.ts` (before every read of a stored or pasted save).
 * Calls: {@link migrateV6}.
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
  return flat['version'] === 6 ? JSON.stringify(migrateV6(flat)) : json;
}
