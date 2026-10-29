/**
 * Test aid: edit a save as one flat object, the way the v6 format was shaped.
 *
 * Purpose: many tests save a game, change one thing in the saved data (a bad count, a missing key, a tampered value) and load it again. The v7 save is
 * nested (`wallet`, `sleeves.main`), so `flatSave` merges the parts back into the flat shape and `asSave` turns a flat object into saved text through the real
 * migration. A test therefore names fields, not their place; the nested shape itself is tested in `save/v7Format.test.ts` and `save/v7Migration.test.ts`.
 * Called by: tests. Calls: `migrateSave`.
 */
import { DEFAULT_SLEEVE_ID, migrateSave } from '../core/save/migrate';

/** A save as one flat, loosely typed object (the shape version 6 had). */
// biome-ignore lint/suspicious/noExplicitAny: tests edit saved data in place, field by field, without typing every shape
export type FlatSave = Record<string, any>;

/**
 * Saved text as a flat object: the wallet and the one sleeve merged, the corporation and the key toggles under their v6 names, `version` 6.
 * The all-time peak statistics are left out (v6 had none).
 *
 * @param text saved text of the current version (from `serializeState`)
 * @returns an object that `asSave` turns back into saved text
 */
export function flatSave(text: string): FlatSave {
  const data = JSON.parse(text) as FlatSave;
  const { corporations, allTimePeakCredits: _c, allTimePeakNetwork: _n, ...wallet } = data['wallet'];
  const { keyToggles, ...sleeve } = data['sleeves'][DEFAULT_SLEEVE_ID];
  return {
    version: 6,
    ...wallet,
    ...sleeve,
    corporation: corporations?.[DEFAULT_SLEEVE_ID],
    zeroDaysOn: keyToggles?.['zeroDay'] === true,
    adminKeysOn: keyToggles?.['adminKey'] === true,
  };
}

/**
 * Saved text from a flat object, through the real migration (an object whose `version` is not 6 comes out unchanged, so version checks can be tested).
 *
 * @param flat the object (as from `flatSave`, edited)
 * @returns text `deserializeState` reads
 */
export function asSave(flat: unknown): string {
  return migrateSave(JSON.stringify(flat));
}
