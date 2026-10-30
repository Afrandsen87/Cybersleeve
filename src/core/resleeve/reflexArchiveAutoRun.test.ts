/**
 * Reflex Archive and Auto-run: a bought-back Auto-run is on when it was on as the last life ended, otherwise off (no flipping).
 *
 * Called by: vitest. Calls: the re-sleeve skills kit, `deserializeState`, `serializeState`.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { setCredits } from '../../testing/testConfig';
import { deserializeState, serializeState } from '..';
import { newGame, plainBuyable, resleeveSkill, resleeveTimes, tryBuy, withBuyables } from '../../testing/resleeveSkillsKit';

const config = withBuyables([
  plainBuyable('reflex-auto', { kind: 'autoRun' }, { actionId: 'a', cost: num(1) }),
  plainBuyable('cheap', { kind: 'rewardMultiplier', factor: 2 }, { actionId: 'a', cost: num(1) }),
  resleeveSkill('reflex', { kind: 'autoRepurchase' }),
]);

/** A game that owned Auto-run (switched on or off as asked) and one plain purchase when its life ended; Reflex Archive is owned. */
function afterLife(autoRunOn: boolean): ReturnType<typeof newGame> {
  const g = newGame(config);
  resleeveTimes(g, 1);
  expect(tryBuy(g, 'reflex')).toBe('purchased');
  expect(tryBuy(g, 'reflex-auto')).toBe('purchased');
  expect(tryBuy(g, 'cheap')).toBe('purchased');
  if (g.toggleAutoRun('reflex-auto') !== autoRunOn) g.toggleAutoRun('reflex-auto');
  g.resleeve();
  return g;
}

describe('Reflex Archive keeps Auto-run on or off', () => {
  it('writes down only the Auto-runs that were on', () => {
    expect(afterLife(true).getState().wallet.lastLifeAutoRunOn).toEqual({ 'reflex-auto': true });
    expect(afterLife(false).getState().wallet.lastLifeAutoRunOn).toEqual({});
  });

  it('an Auto-run that was on comes back on', () => {
    const g = afterLife(true);
    setCredits(g, num(1000));
    g.tick(1000);
    expect(g.getState().sleeve.purchased['reflex-auto']).toBe(1);
    expect(g.getState().sleeve.autoRunOff['reflex-auto']).toBeUndefined();
  });

  it('an Auto-run that was off comes back off', () => {
    const g = afterLife(false);
    setCredits(g, num(1000));
    g.tick(1000);
    expect(g.getState().sleeve.purchased['reflex-auto']).toBe(1);
    expect(g.getState().sleeve.autoRunOff['reflex-auto']).toBe(true);
  });

  it('a record without the field (an older save) brings every Auto-run back off', () => {
    const g = afterLife(true);
    g.getState().wallet.lastLifeAutoRunOn = {};
    setCredits(g, num(1000));
    g.tick(1000);
    expect(g.getState().sleeve.autoRunOff['reflex-auto']).toBe(true);
  });

  it('survives a save and a load, and is left out of the text while empty', () => {
    const g = afterLife(true);
    const loaded = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(loaded.wallet.lastLifeAutoRunOn).toEqual({ 'reflex-auto': true });
    expect(findInvariantViolations(loaded, config)).toEqual([]);
    expect(serializeState(afterLife(false).getState())).not.toContain('lastLifeAutoRunOn');
  });
});

