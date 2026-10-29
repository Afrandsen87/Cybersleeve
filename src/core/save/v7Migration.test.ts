/**
 * The v6 -> v7 migration against two real v6 saves (written by the game before the wallet/sleeve split).
 *
 * Purpose: before the reshape, `v6Format.test.ts` proved that the old loader gave both fixtures back unchanged (load, then save, equals the file).
 * So "migrate, load and save, flattened, equals the fixture" proves the migration plus the new loader lose and invent nothing.
 * Called by: vitest. Calls: `migrateSave`, `deserializeState`, `serializeState`, real content (`gameConfig`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../content/gameConfig';
import { numberFactory } from '../../numbers';
import { type FlatSave, asSave, flatSave } from '../../testing/saveKit';
import { SAVE_VERSION, deserializeState, serializeState } from '..';
import { migrateSave } from './migrate';

const read = (name: string): string => readFileSync(new URL(`../../testing/fixtures/saves/${name}`, import.meta.url), 'utf8');
const FIXTURES = ['v6-early-before-resleeve.json', 'v6-after-three-resleeves.json'];
const load = (text: string) => deserializeState(text, gameConfig, numberFactory);

describe.each(FIXTURES)('v6 fixture %s', (name) => {
  const text = read(name);
  const raw = JSON.parse(text) as FlatSave;
  const migrated = migrateSave(text);

  it('migrates to the current version and loads', () => {
    expect(JSON.parse(migrated).version).toBe(SAVE_VERSION);
    expect(load(migrated)).not.toBeNull();
  });

  it('is not read as it is: only the current version is read', () => {
    expect(load(text)).toBeNull();
  });

  it('migrate, load and save gives back every value of the old save (field by field)', () => {
    expect(flatSave(serializeState(load(migrated)!))).toEqual(raw);
  });

  it('starts the all-time peaks at the peak of the life being lived', () => {
    const wallet = load(migrated)!.wallet;
    expect(wallet.allTimePeakCredits.eq(numberFactory.fromString(raw['peakCredits']))).toBe(true);
    expect(wallet.allTimePeakNetwork.eq(numberFactory.fromString(raw['peakNetwork']))).toBe(true);
  });

  it('puts one sleeve and one corporation under the default id, and keeps the shared parts in the wallet', () => {
    const data = JSON.parse(migrated);
    expect(Object.keys(data.sleeves)).toEqual(['main']);
    expect(Object.keys(data.wallet.corporations)).toEqual(['main']);
    expect(data.wallet.runs).toEqual(raw['runs']);
    expect(data.wallet.inventory).toEqual(raw['inventory']);
    expect(data.sleeves.main.purchased).toEqual(raw['purchased']);
    expect(data.sleeves.main.actions).toEqual(raw['actions']);
  });

  it('does not change its input and migrating the result again changes nothing', () => {
    expect(JSON.parse(text)).toEqual(raw);
    expect(migrateSave(migrated)).toBe(migrated);
  });

  it('a missing optional scalar takes the fresh-game value', () => {
    const { heat: _heat, moles: _moles, peakCredits: _peak, ...rest } = raw;
    const state = load(asSave(rest))!;
    expect(state.sleeve.moles).toBe(0);
    expect(state.sleeve.heat).toBe(gameConfig.sleeve.baseHeat);
    expect(state.wallet.allTimePeakCredits.toNumber()).toBe(gameConfig.progression.startingCredits);
  });

  it('rejects a save whose required amounts are missing or garbage', () => {
    for (const key of ['credits', 'network']) {
      expect(load(asSave({ ...raw, [key]: undefined }))).toBeNull();
      expect(load(asSave({ ...raw, [key]: 'banana' }))).toBeNull();
    }
  });

  it.each(['NaN', 'Infinity', '-Infinity'])('rejects the non-finite amount "%s" as the old loader did', (bad) => {
    expect(load(asSave({ ...raw, credits: bad }))).toBeNull();
    expect(load(asSave({ ...raw, peakCredits: bad }))).toBeNull();
  });

  it('ignores unknown keys and unknown ids', () => {
    const extra = { ...raw, mystery: 1, purchased: { ...raw['purchased'], 'no-such-buyable': 3 } };
    expect(flatSave(serializeState(load(asSave(extra))!))).toEqual(raw);
  });

  it('repairs garbage in plain-number fields to the fresh value', () => {
    const state = load(asSave({ ...raw, heatCooldownMs: 'x', legend: -5 }))!;
    expect(state.sleeve.heatCooldownMs).toBe(0);
    expect(state.sleeve.legend).toBe(0);
  });
});

describe('migrateSave on input that is not a v6 save', () => {
  it.each([['not json'], ['[]'], ['null'], ['{"version":5}'], ['{"version":"6"}'], ['{"version":999}']])('leaves %s as it is', (text) => {
    expect(migrateSave(text)).toBe(text);
    expect(load(migrateSave(text))).toBeNull();
  });

  it('turns the two key toggles into the keyed collection, keeping only the ones that are on', () => {
    const raw = JSON.parse(read(FIXTURES[0]!)) as FlatSave;
    const data = JSON.parse(migrateSave(JSON.stringify({ ...raw, zeroDaysOn: true, adminKeysOn: false })));
    expect(data.sleeves.main.keyToggles).toEqual({ zeroDay: true });
  });
});
