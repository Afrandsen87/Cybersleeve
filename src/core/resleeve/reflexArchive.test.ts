/**
 * Reflex Archive: after a re-sleeve, the purchases on the actions' cards that the last life owned are bought back as soon as they are
 * affordable, cheapest first. Tested on a small configuration.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { setCredits } from '../../testing/testConfig';
import { deserializeState, serializeState } from '..';
import { newGame, plainBuyable, resleeveSkill, resleeveTimes, tryBuy, withBuyables } from '../../testing/resleeveSkillsKit';

const config = withBuyables([
  plainBuyable('cheap', { kind: 'rewardMultiplier', factor: 2 }, { actionId: 'a', cost: num(1), costGrowth: 2, maxPurchases: 3 }),
  plainBuyable('mid', { kind: 'rewardMultiplier', factor: 2 }, { actionId: 'a', cost: num(50), requires: ['cheap'] }),
  plainBuyable('uplink', { kind: 'interfaceSpeed', amount: 0.05 }, { cost: num(1) }),
  plainBuyable('nodes', { kind: 'rewardMultiplier', factor: 2 }, { actionId: 'a', cost: num(1), currency: 'networkNodes' }),
  resleeveSkill('reflex', { kind: 'autoRepurchase' }),
]);

/** A game that owned 2 cheap, the mid one, the sleeve-wide uplink and nothing else when its life ended, with or without Reflex Archive. */
function afterLife(withSkill: boolean): ReturnType<typeof newGame> {
  const g = newGame(config);
  if (withSkill) {
    resleeveTimes(g, 1);
    expect(tryBuy(g, 'reflex')).toBe('purchased');
  }
  for (const id of ['cheap', 'cheap', 'mid', 'uplink']) expect(tryBuy(g, id), id).toBe('purchased');
  g.resleeve();
  return g;
}

describe('Reflex Archive', () => {
  it('writes down only the action-card purchases paid in credits, whether or not the skill is owned', () => {
    const g = afterLife(false);
    expect(g.getState().wallet.lastLifePurchases).toEqual({ cheap: 2, mid: 1 });
  });

  it('buys nothing back without the skill, however many credits there are', () => {
    const g = afterLife(false);
    setCredits(g, num(1000));
    g.tick(1000);
    expect(g.getState().sleeve.purchased).toEqual({});
  });

  it('buys nothing back while the credits do not cover the cheapest', () => {
    const g = afterLife(true);
    g.tick(1000);
    expect(g.getState().sleeve.purchased['cheap']).toBeUndefined();
  });

  it('buys back what is affordable, cheapest first, at the normal prices, and no more than last life had', () => {
    const g = afterLife(true);
    setCredits(g, num(2)); // the first cheap copy costs 1 and the second 2: only the first fits
    g.tick(1000);
    expect(g.getState().sleeve.purchased['cheap']).toBe(1);
    expect(g.getState().sleeve.purchased['mid']).toBeUndefined();
    expect(g.getState().wallet.credits.toNumber()).toBeCloseTo(1, 9);
    setCredits(g, num(1000));
    g.tick(1000);
    expect(g.getState().sleeve.purchased['cheap'], 'the 3rd copy was never owned').toBe(2);
    expect(g.getState().sleeve.purchased['mid']).toBe(1);
    expect(g.getState().sleeve.purchased['uplink'], 'a sleeve-wide purchase is not bought back').toBeUndefined();
    expect(g.getState().wallet.credits.toNumber()).toBeCloseTo(1000 - 2 - 50, 9);
  });

  it('keeps the record through a save and a load', () => {
    const g = afterLife(true);
    const loaded = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(loaded.wallet.lastLifePurchases).toEqual({ cheap: 2, mid: 1 });
    expect(findInvariantViolations(loaded, config)).toEqual([]);
  });

  it('remembers only what the life that just ended owned', () => {
    const g = afterLife(true);
    setCredits(g, num(2));
    g.tick(1000); // buys back one cheap copy only
    g.resleeve();
    expect(g.getState().wallet.lastLifePurchases).toEqual({ cheap: 1 });
  });
});
