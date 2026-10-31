/**
 * Context: save. Refund migration and defensive reader ordering.
 * Called by: vitest. Calls: migrateSave, migrateV9, SaveGame, shared refund kit.
 */
import { describe, expect, it } from 'vitest';
import { SaveGame, MemoryStore, SAVE_KEY, PRE_MIGRATION_KEY } from '../../app/persistence';
import { numberFactory } from '../../numbers';
import { refundConfig, refundState, sleeveSkillIds } from '../../testing/saveRefundKit';
import { flatSave } from '../../testing/saveKit';
import { deserializeState, serializeState } from './serialization';
import { migrateSave, needsProgressionBackfill } from './migrate';
import { migrateV9 } from './migrateV10';

const ids = [...sleeveSkillIds, 'cap'];
describe('v10 sleeve-skill refund', () => {
  it.each([6, 7, 8, 9])('refunds version %s without losing run or synth records', (version) => {
    const state = refundState();
    const raw = JSON.parse(serializeState(state));
    const input = version === 6 ? { ...flatSave(serializeState(state)), version } : { ...raw, version };
    const migrated = migrateSave(JSON.stringify(input), ids);
    const out = JSON.parse(migrated);
    expect(out.version).toBe(10);
    expect(out.wallet.runs).toEqual(raw.wallet.runs);
    expect(out.wallet.synths).toEqual(raw.wallet.synths);
    const loaded = deserializeState(migrated, refundConfig, numberFactory)!;
    expect(loaded.sleeve.purchased).toEqual({ access: 4, auto: 1 });
    expect(loaded.wallet.synths).toEqual(state.wallet.synths);
    expect(loaded.wallet.lastLifePurchases).toEqual(state.wallet.lastLifePurchases);
    expect(loaded.wallet.revealed).not.toContain('skill:syn');
    if (version === 9) expect(loaded.wallet.revealed).toEqual(['buyable:auto', 'tab:stats', 'skill:auto', 'buyable:syn']);
    const store = new MemoryStore();
    const saves = new SaveGame(store, refundConfig, numberFactory);
    store.setItem(SAVE_KEY, JSON.stringify(input));
    expect(saves.load()!.sleeve.purchased['access']).toBe(4);
    expect(store.getItem(PRE_MIGRATION_KEY)).toBe(JSON.stringify(input));
    expect(saves.importText(JSON.stringify(input))).toBe(true);
    expect(saves.load()!.sleeve.purchased['access']).toBe(4);
  });

  it('is pure, handles every sleeve and preserves unrelated fields', () => {
    const raw = JSON.parse(serializeState(refundState()));
    raw.version = 9;
    raw.sleeves.second = raw.sleeves.main;
    const before = JSON.stringify(raw);
    const out = migrateV9(raw, ids);
    expect(JSON.stringify(raw)).toBe(before);
    expect(out).toMatchObject({ version: 10, sleeves: { main: { purchased: { auto: 1 } }, second: { purchased: { auto: 1 } } } });
    expect((out['wallet'] as typeof raw.wallet).runs).toBe(raw.wallet.runs);
    expect((out['wallet'] as typeof raw.wallet).synths).toBe(raw.wallet.synths);
  });

  it.each(['garbage', 'null', '[]', '{"version":10,"extra":true}'])('returns %s byte for byte', (input) => {
    expect(migrateSave(input, ids)).toBe(input);
    expect(needsProgressionBackfill(input)).toBe(false);
  });
});
