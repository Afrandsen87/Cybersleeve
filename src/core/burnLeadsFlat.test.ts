/**
 * Scorched Earth: each Burn lead takes a flat number of heat points away after its percentage.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { BurnLeads, Inventory, createConfig, type BuyableDefinition, type GameConfig, type GameState } from './index';

const scorched: BuyableDefinition = {
  id: 'scorched',
  name: 'Scorched',
  description: '',
  cost: num(1),
  effect: { kind: 'burnLeadFlatHeat', amount: 1 },
};

/** The test content with a Burn lead item (5% of the heat per lead), and Scorched Earth when asked for. */
function config(withSkill: boolean): GameConfig {
  return createConfig(testConfig, {
    items: {
      rarities: testConfig.items.rarities,
      definitions: [...testConfig.items.definitions, { id: 'lead', name: 'Lead', sellable: false, hasRarity: false }],
      burnLead: { itemId: 'lead', heatFraction: 0.05 },
    },
    buyables: [...testConfig.buyables, ...(withSkill ? [scorched] : [])],
  });
}

function game(withSkill = true, heat = 20, leads = 10) {
  const g = createGame({ config: config(withSkill) });
  setCredits(g, num(1000));
  if (withSkill) expect(g.buy('scorched')).toBe('purchased');
  (g.getState() as { heat: number }).heat = heat;
  (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['lead'] = { common: leads };
  return g;
}

describe('Scorched Earth', () => {
  it('a lead takes its 5% and then 1 more point', () => {
    const g = game();
    expect(g.useBurnLead('common')).toBe(true);
    expect(g.getState().heat).toBeCloseTo(20 - 1 - 1, 12);
  });

  it('without the skill a lead takes only its percentage', () => {
    const g = game(false);
    g.useBurnLead('common');
    expect(g.getState().heat).toBeCloseTo(19, 12);
  });

  it('heat never goes below 0', () => {
    const g = game(true, 0.5);
    g.useBurnLead('common');
    expect(g.getState().heat).toBe(0);
  });
});

describe('Scorched Earth with many leads at once (the unit Auto Burn uses)', () => {
  /** A lead unit over a bare state: 5% per lead plus `flat` points. */
  function unit(heat: number, flat: number, leads = 100) {
    const cfg = config(false);
    const g = createGame({ config: cfg });
    const state = g.getState() as unknown as GameState & { heat: number; inventory: Record<string, Record<string, number>> };
    state.heat = heat;
    state.inventory['lead'] = { common: leads };
    const factory = numberFactory;
    return {
      state,
      burn: new BurnLeads(
        cfg,
        state,
        new Inventory(cfg, state, factory),
        () => false,
        () => flat,
      ),
    };
  }

  it('using many equals using them one by one', () => {
    const one = unit(50, 1);
    for (let i = 0; i < 7; i++) one.burn.use('common');
    const many = unit(50, 1);
    expect(many.burn.useMany('common', 7)).toBe(7);
    expect(many.state.heat).toBeCloseTo(one.state.heat, 9);
    expect(many.state.inventory['lead']!['common']).toBe(93);
  });

  it('heat stops at 0 and never goes negative', () => {
    const { state, burn } = unit(5, 1);
    burn.useMany('common', 50);
    expect(state.heat).toBe(0);
  });

  it('leadsNeeded is the fewest leads that reach the target, with and without the flat part', () => {
    for (const flat of [0, 1, 3]) {
      const { burn } = unit(100, flat);
      const needed = burn.leadsNeeded(20);
      const heatAfter = (k: number): number => {
        const probe = unit(100, flat);
        probe.burn.useMany('common', k);
        return probe.state.heat;
      };
      expect(heatAfter(needed), `flat ${flat}`).toBeLessThanOrEqual(20 + 1e-9);
      expect(heatAfter(needed - 1), `flat ${flat}, one fewer`).toBeGreaterThan(20);
    }
  });

  it('leadsNeeded is 0 at or below the target, and Infinity for a target of 0', () => {
    expect(unit(10, 1).burn.leadsNeeded(10)).toBe(0);
    expect(unit(10, 1).burn.leadsNeeded(0)).toBe(Number.POSITIVE_INFINITY);
  });
});
