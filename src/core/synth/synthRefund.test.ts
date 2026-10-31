/**
 * Context: synth. Dormant records survive refund and resume without duplicates.
 * Called by: vitest. Calls: shared refund kit, createGame, migrateSave.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { findInvariantViolations } from '../../testing/invariants';
import { numberFactory } from '../../numbers';
import { refundConfig, refundState, sleeveSkillIds } from '../../testing/saveRefundKit';
import { deserializeState, serializeState } from '../save/serialization';
import { migrateSave } from '../save/migrate';

describe('synthetic sleeve refund', () => {
  it('gives no new sleeves on re-sleeve while the skill is unowned', () => {
    const state = refundState();
    state.sleeve.purchased = {};
    const saved = [...state.wallet.synths];
    const game = createGame({ config: refundConfig, state });
    expect(game.resleeve()).toBe(true);
    expect(game.getState().wallet.synths).toEqual(saved);
    expect(findInvariantViolations(game.getState(), refundConfig)).toEqual([]);
    expect(game.synthCount()).toBe(0);
  });

  it('restores saved count and income on re-buy without granting an extra sleeve', () => {
    const original = refundState();
    const before = createGame({ config: refundConfig, state: original });
    const count = before.synthCount();
    const income = before.synthCreditsPerSecond();
    const raw = JSON.parse(serializeState(original));
    raw.version = 9;
    const state = deserializeState(migrateSave(JSON.stringify(raw), [...sleeveSkillIds, 'cap']), refundConfig, numberFactory)!;
    expect(deserializeState(serializeState(state), refundConfig, numberFactory)!.wallet.synths).toEqual(original.wallet.synths);
    const game = createGame({ config: refundConfig, state });
    expect(game.synthCount()).toBe(0);
    expect(game.synthCreditsPerSecond().toNumber()).toBe(0);
    expect(game.synthIncomeCeiling().toNumber()).toBe(0);
    expect(state.wallet.synths).toEqual(original.wallet.synths);
    expect(game.resleevePoints()).toBe(state.wallet.runs.length * refundConfig.resleeve.pointsPerResleeve);
    game.buy('eu');
    game.buy('syn');
    expect(game.synthCount()).toBe(count);
    expect(game.synthCreditsPerSecond().eq(income)).toBe(true);
    expect(state.wallet.synths).toEqual(original.wallet.synths);
  });
});
