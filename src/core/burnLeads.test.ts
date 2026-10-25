import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { seededRandom } from '../testing/random';
import { setCredits, testConfig } from '../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type GameConfig } from './index';

/** The test item `lead`: not sellable, without rarity (one stack), dropped by the test action 5% of the time. Using one removes 5% of the heat. */
function configWith(over: { chance?: number; heatFraction?: number } = {}): GameConfig {
  return createConfig(testConfig, {
    items: {
      rarities: testConfig.items.rarities,
      definitions: [...testConfig.items.definitions, { id: 'lead', name: 'Lead', sellable: false, hasRarity: false }],
      burnLead: { itemId: 'lead', heatFraction: over.heatFraction ?? 0.05 },
    },
    buyables: [
      ...testConfig.buyables,
      {
        id: 'leads',
        name: 'Leads',
        description: '',
        actionId: 'a',
        cost: num(1),
        effect: { kind: 'itemDrop', drop: { itemId: 'lead', chance: over.chance ?? 0.05 } },
      },
    ],
  });
}

function game(config = configWith(), seed = 1) {
  const g = createGame({ config, random: seededRandom(seed) });
  setCredits(g, num(1000));
  return g;
}

const setHeat = (g: ReturnType<typeof game>, heat: number): void => {
  (g.getState() as { heat: number }).heat = heat;
};
const give = (g: ReturnType<typeof game>, rarity: string, n: number): void => {
  (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['lead'] = { [rarity]: n };
};
const leads = (g: ReturnType<typeof game>, rarity = 'common'): number => g.getState().inventory['lead']?.[rarity] ?? 0;

describe('Burn leads: dropping', () => {
  it('Grow-network-style drop: with chance 1 every completed run drops a common lead, and only a common one', () => {
    const g = game(configWith({ chance: 1 }));
    g.buy('leads');
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 5 + 1);
    expect(leads(g)).toBe(5);
    expect(leads(g, 'rare')).toBe(0);
  });

  it('drops nothing before the buyable is owned', () => {
    const g = game(configWith({ chance: 1 }));
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().inventory).toEqual({});
  });

  it('drops at the configured rate: about 5% of the completed runs', () => {
    const g = game(configWith({ chance: 0.05 }));
    g.buy('leads');
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 2000 + 1);
    const runs = g.getState().actions['a']!.xp.toNumber(); // 1 action XP per completed run (the action speeds up as it levels)
    expect(runs).toBeGreaterThan(2000);
    expect(leads(g) / runs).toBeGreaterThan(0.04);
    expect(leads(g) / runs).toBeLessThan(0.06);
  });
});

describe('Burn leads: using one', () => {
  it('removes 5% of the current heat and uses the lead up', () => {
    const g = game();
    give(g, 'common', 3);
    setHeat(g, 10);
    expect(g.useBurnLead('common')).toBe(true);
    expect(g.getState().heat).toBeCloseTo(9.5, 12);
    expect(leads(g)).toBe(2);
  });

  it('is worth more the hotter it is: 5% of 200 heat is 10, 5% of 20 heat is 1', () => {
    const hot = game();
    give(hot, 'common', 1);
    setHeat(hot, 200);
    hot.useBurnLead('common');
    expect(hot.getState().heat).toBeCloseTo(190, 12);
    const warm = game();
    give(warm, 'common', 1);
    setHeat(warm, 20);
    warm.useBurnLead('common');
    expect(warm.getState().heat).toBeCloseTo(19, 12);
  });

  it('each lead takes 5% of what is left: three leads leave 0.95^3 of the heat', () => {
    const g = game();
    give(g, 'common', 3);
    setHeat(g, 100);
    for (let i = 0; i < 3; i++) g.useBurnLead('common');
    expect(g.getState().heat).toBeCloseTo(100 * 0.95 ** 3, 9);
  });

  it('leaves fractions of a point, which then wait for the cooldown to find a whole one', () => {
    const g = game();
    give(g, 'common', 1);
    setHeat(g, 1);
    g.useBurnLead('common');
    expect(g.getState().heat).toBeCloseTo(0.95, 12);
    g.tick(600_000);
    expect(g.getState().heat).toBeCloseTo(0.95, 12);
  });

  it('is refused, and the lead kept, when there is no heat', () => {
    const g = game();
    give(g, 'common', 1);
    expect(g.canUseBurnLead('common')).toBe(false);
    expect(g.useBurnLead('common')).toBe(false);
    expect(leads(g)).toBe(1);
  });

  it('is refused when none of that rarity is held', () => {
    const g = game();
    give(g, 'common', 1);
    setHeat(g, 10);
    expect(g.canUseBurnLead('rare')).toBe(false);
    expect(g.useBurnLead('rare')).toBe(false);
    expect(g.getState().heat).toBe(10);
  });

  it('can be used when a lead is held and there is heat', () => {
    const g = game();
    give(g, 'common', 1);
    setHeat(g, 0.01);
    expect(g.canUseBurnLead('common')).toBe(true);
  });

  it('cannot be sold', () => {
    const g = game();
    give(g, 'common', 2);
    expect(g.sellItems('lead', 'common', 'all')).toBe(0);
    expect(leads(g)).toBe(2);
    expect(g.getState().credits.toNumber()).toBe(1000);
  });

  it('does nothing in a game whose content has no Burn lead', () => {
    const g = createGame({ config: testConfig });
    setHeat(g, 10);
    expect(g.canUseBurnLead('common')).toBe(false);
    expect(g.useBurnLead('common')).toBe(false);
    expect(g.getState().heat).toBe(10);
  });

  it('leads are lost by re-sleeving, with the rest of the inventory', () => {
    const g = game();
    give(g, 'common', 4);
    g.resleeve();
    expect(g.getState().inventory).toEqual({});
  });

  it('a used-up stack is not saved, so saving, loading and saving again gives the same text', () => {
    const g = game();
    give(g, 'common', 1);
    setHeat(g, 10);
    g.useBurnLead('common');
    expect(g.getState().inventory['lead']).toEqual({ common: 0 }); // the engine keeps the empty stack in memory
    const saved = serializeState(g.getState());
    expect(JSON.parse(saved).inventory).toEqual({});
    const restored = deserializeState(saved, configWith(), numberFactory)!;
    expect(serializeState(restored)).toBe(saved);
  });

  it('leads survive a save', () => {
    const g = game();
    give(g, 'common', 4);
    const restored = deserializeState(serializeState(g.getState()), configWith(), numberFactory)!;
    expect(restored.inventory['lead']?.['common']).toBe(4);
  });
});

describe('an item without rarity', () => {
  it('drops into its single stack, whatever the rarities of the game', () => {
    const g = game(configWith({ chance: 1 }));
    g.buy('leads');
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 4 + 1);
    expect(Object.keys(g.getState().inventory['lead']!)).toEqual(['common']);
    expect(leads(g)).toBe(4);
  });

  it('a lead drop with rarity weights is refused: the item has none', () => {
    const base = configWith();
    const config = createConfig(base, {
      buyables: base.buyables.map((b) =>
        b.id === 'leads' ? { ...b, effect: { kind: 'itemDrop', drop: { itemId: 'lead', chance: 0.05, rarityWeights: { common: 1 } } } } : b,
      ),
    });
    expect(validateConfig(config).join('|')).toContain('an item without rarity takes no rarity weights');
  });

  it('a drop of an item that has rarities must say how they are drawn', () => {
    const base = configWith();
    const config = createConfig(base, {
      buyables: [
        ...base.buyables,
        {
          id: 'files',
          name: 'Files',
          description: '',
          actionId: 'a',
          cost: num(1),
          effect: { kind: 'itemDrop', drop: { itemId: 'file', chance: 0.5 } },
        },
      ],
    });
    expect(validateConfig(config).join('|')).toContain('a drop of an item with rarities needs rarity weights');
  });

  it('the drop chance multipliers still apply to it: a doubled 50% chance drops on every run', () => {
    const base = configWith({ chance: 0.5 });
    const config = createConfig(base, {
      buyables: [
        ...base.buyables,
        {
          id: 'nose',
          name: 'Nose',
          description: '',
          cost: num(1),
          effect: { kind: 'itemDropChanceMultiplier', itemId: 'lead', factor: 2 },
        },
      ],
    });
    const g = game(config);
    g.buy('leads');
    g.buy('nose');
    g.buy('auto');
    g.startAction('a');
    g.tick(10_000 * 6 + 1);
    expect(leads(g)).toBe(6);
  });
});

describe('validation of the Burn lead', () => {
  it('the test content is valid', () => {
    expect(validateConfig(configWith())).toEqual([]);
  });

  it.each([0, -0.1, 1.5, Number.NaN])('rejects a heat fraction of %s', (heatFraction) => {
    expect(validateConfig(configWith({ heatFraction })).join('|')).toContain('items.burnLead.heatFraction must be in (0, 1]');
  });

  it('rejects an unknown item', () => {
    const config = createConfig(testConfig, { items: { ...testConfig.items, burnLead: { itemId: 'ghost', heatFraction: 0.05 } } });
    expect(validateConfig(config).join('|')).toContain('items.burnLead refers to unknown item "ghost"');
  });
});
