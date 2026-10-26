import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { setCredits, testConfig } from '../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type GameConfig } from './index';

/**
 * Test content: `file` is sold (Common 10, Rare 100 credits), `schem` is the Augment schematic, `lead` the Burn lead (5% of the heat).
 * The buyable `core` gives one automation point per copy (price 1, x10 per copy).
 */
const config: GameConfig = createConfig(testConfig, {
  actions: [...testConfig.actions, { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0), xpPerRun: num(1) }],
  items: {
    rarities: testConfig.items.rarities,
    definitions: [
      { id: 'file', name: 'File' },
      { id: 'schem', name: 'Schematic', sellable: false },
      { id: 'lead', name: 'Lead', sellable: false, hasRarity: false },
    ],
    augment: { itemId: 'schem', xpBonusPerItem: 0.01 },
    burnLead: { itemId: 'lead', heatFraction: 0.05 },
  },
  buyables: [
    ...testConfig.buyables,
    {
      id: 'core',
      name: 'Core',
      description: '',
      cost: num(1),
      costGrowth: 10,
      maxPurchases: Infinity,
      effect: { kind: 'automationPoints', perCopy: 1 },
    },
  ],
  automation: { autoBurnCeiling: 10 },
});

type Loose = {
  heat: number;
  inventory: Record<string, Record<string, number>>;
  actions: Record<string, { xp: unknown; augments: Record<string, number> }>;
};
const loose = (g: { getState(): unknown }): Loose => g.getState() as unknown as Loose;

/** A game that owns `points` automation points. */
const game = (points = 3, c: GameConfig = config) => {
  const g = createGame({ config: c });
  setCredits(g, num(1_000_000));
  for (let i = 0; i < points; i++) expect(g.buy('core')).toBe('purchased');
  return g;
};

describe('automation points', () => {
  it('there are none until the buyable is owned, and each copy gives one', () => {
    const g = createGame({ config });
    expect(g.automation().available()).toBe(true);
    expect(g.automation().pointsEarned()).toBe(0);
    setCredits(g, num(1_000));
    g.buy('core');
    g.buy('core');
    expect(g.automation().pointsEarned()).toBe(2);
    expect(g.automation().pointsAvailable()).toBe(2);
  });

  it('unlocking a feature spends one point; with none left nothing unlocks', () => {
    const g = game(1);
    expect(g.automation().unlock('autoBurn')).toBe(true);
    expect(g.automation().pointsAvailable()).toBe(0);
    expect(g.automation().unlock('autosale')).toBe(false);
    expect(g.automation().isUnlocked('autosale')).toBe(false);
  });

  it('a feature cannot be unlocked twice', () => {
    const g = game(3);
    expect(g.automation().unlock('autosale')).toBe(true);
    expect(g.automation().unlock('autosale')).toBe(false);
    expect(g.automation().pointsAvailable()).toBe(2);
  });

  it('a game without an automation section has no automation at all', () => {
    const g = createGame({ config: createConfig(testConfig, {}) });
    expect(g.automation().available()).toBe(false);
    expect(g.automation().pointsEarned()).toBe(0);
    expect(g.automation().unlock('autoBurn')).toBe(false);
    expect(() => g.tick(1_000)).not.toThrow();
  });

  it('is reset by re-sleeving: the points go with the purchases', () => {
    const g = game(2);
    g.automation().unlock('autosale');
    g.resleeve();
    expect(g.automation().pointsEarned()).toBe(0);
    expect(g.automation().isUnlocked('autosale')).toBe(false);
  });
});

describe('Auto Burn', () => {
  const burnGame = (heat: number, leads: number) => {
    const g = game(1);
    g.automation().unlock('autoBurn');
    loose(g).heat = heat;
    loose(g).inventory['lead'] = { common: leads };
    return g;
  };

  it('settings only work once unlocked', () => {
    const g = game(1);
    expect(g.automation().setAutoBurn(true)).toBe(false);
    expect(g.automation().setAutoBurnCeiling(5)).toBe(false);
    expect(g.automation().autoBurnCeiling()).toBe(10);
  });

  it('does nothing while it is off', () => {
    const g = burnGame(100, 50);
    g.tick(1);
    expect(loose(g).heat).toBeGreaterThan(99);
    expect(loose(g).inventory['lead']!['common']).toBe(50);
  });

  it('uses just enough leads to bring heat down to the ceiling: 100 heat to 10 takes 45 leads at 5% each', () => {
    const g = burnGame(100, 100);
    g.automation().setAutoBurn(true);
    g.tick(1);
    // outcome: the fewest leads that leave at most the ceiling: 100 x 0.95^45 = 9.9, while 44 leads leave 10.46
    expect(loose(g).inventory['lead']!['common']).toBe(55);
    expect(loose(g).heat).toBeLessThanOrEqual(10);
    expect(loose(g).heat).toBeGreaterThan(10 * 0.95);
  });

  it('uses every lead there is when they cannot reach the ceiling, and leaves heat below the ceiling alone', () => {
    const few = burnGame(100, 3);
    few.automation().setAutoBurn(true);
    few.tick(1);
    expect(loose(few).inventory['lead']?.['common'] ?? 0).toBe(0);
    expect(loose(few).heat).toBeCloseTo(100 * 0.95 ** 3, 1);
    const cool = burnGame(5, 10);
    cool.automation().setAutoBurn(true);
    cool.tick(1);
    expect(loose(cool).inventory['lead']!['common']).toBe(10);
  });

  it('keeps heat at the ceiling the player sets', () => {
    const g = burnGame(100, 1_000);
    g.automation().setAutoBurn(true);
    g.automation().setAutoBurnCeiling(50);
    g.tick(1);
    expect(loose(g).heat).toBeLessThanOrEqual(50);
    expect(loose(g).heat).toBeGreaterThan(50 * 0.95);
  });

  it('rejects a ceiling that is negative or not a number', () => {
    const g = burnGame(1, 1);
    expect(g.automation().setAutoBurnCeiling(-1)).toBe(false);
    expect(g.automation().setAutoBurnCeiling(Number.NaN)).toBe(false);
    expect(g.automation().autoBurnCeiling()).toBe(10);
  });
});

describe('Kompromat autosale', () => {
  const saleGame = () => {
    const g = game(1);
    g.automation().unlock('autosale');
    loose(g).inventory['file'] = { common: 3, rare: 2 };
    setCredits(g, num(0));
    return g;
  };

  it('sells only the rarities that are switched on, for the normal price', () => {
    const g = saleGame();
    g.automation().setAutosale('common', true);
    g.tick(1);
    expect(loose(g).inventory['file']!['common'] ?? 0).toBe(0);
    expect(loose(g).inventory['file']!['rare']).toBe(2);
    expect(g.getState().credits.eq(num(3 * 10))).toBe(true);
  });

  it('one unlock covers every rarity, and a switched-off rarity is kept', () => {
    const g = saleGame();
    g.automation().setAutosale('common', true);
    g.automation().setAutosale('rare', true);
    g.automation().setAutosale('common', false);
    g.tick(1);
    expect(loose(g).inventory['file']!['common']).toBe(3);
    expect(g.getState().credits.eq(num(2 * 100))).toBe(true);
  });

  it('never sells items that cannot be sold (schematics, leads)', () => {
    const g = saleGame();
    loose(g).inventory['schem'] = { common: 4 };
    loose(g).inventory['lead'] = { common: 4 };
    g.automation().setAutosale('common', true);
    g.tick(1);
    expect(loose(g).inventory['schem']!['common']).toBe(4);
    expect(loose(g).inventory['lead']!['common']).toBe(4);
  });

  it('cannot be switched on before it is unlocked, or for an unknown rarity', () => {
    const g = game(1);
    expect(g.automation().setAutosale('common', true)).toBe(false);
    g.automation().unlock('autosale');
    expect(g.automation().setAutosale('mythic', true)).toBe(false);
  });
});

describe('Augment dispersal', () => {
  const dispersalGame = (held: Record<string, number>) => {
    const g = game(1);
    g.automation().unlock('dispersal');
    loose(g).inventory['schem'] = { ...held };
    return g;
  };
  const applied = (g: ReturnType<typeof game>, id: string): number =>
    Object.values(loose(g).actions[id]!.augments).reduce((n, c) => n + c, 0);

  it('splits the schematics held by the shares: 75/25 of 8 is 6 and 2', () => {
    const g = dispersalGame({ common: 8 });
    g.automation().setDispersal('a', 75);
    g.automation().setDispersal('b', 25);
    g.tick(1);
    expect(applied(g, 'a')).toBe(6);
    expect(applied(g, 'b')).toBe(2);
    expect(loose(g).inventory['schem']!['common'] ?? 0).toBe(0);
  });

  it('shares are relative: 1 and 1 is the same as 50 and 50, and none is lost to rounding', () => {
    const g = dispersalGame({ common: 5 });
    g.automation().setDispersal('a', 1);
    g.automation().setDispersal('b', 1);
    g.tick(1);
    expect(applied(g, 'a') + applied(g, 'b')).toBe(5);
    expect(Math.abs(applied(g, 'a') - applied(g, 'b'))).toBe(1);
  });

  it('uses the most common rarity first and keeps rarities apart on the action', () => {
    const g = dispersalGame({ common: 2, rare: 1 });
    g.automation().setDispersal('a', 100);
    g.tick(1);
    expect(loose(g).actions['a']!.augments).toEqual({ common: 2, rare: 1 });
  });

  it('an action with 0% gets nothing, and with every share at 0 the schematics are kept for the Augment button', () => {
    const g = dispersalGame({ common: 4 });
    g.tick(1);
    expect(loose(g).inventory['schem']!['common']).toBe(4);
    g.automation().setDispersal('a', 100);
    g.automation().setDispersal('a', 0);
    g.tick(1);
    expect(loose(g).inventory['schem']!['common']).toBe(4);
    expect(g.automation().dispersal('a')).toBe(0);
  });

  it('clamps a share to 0..100 and needs the unlock', () => {
    const g = game(1);
    expect(g.automation().setDispersal('a', 50)).toBe(false);
    g.automation().unlock('dispersal');
    g.automation().setDispersal('a', 500);
    expect(g.automation().dispersal('a')).toBe(100);
    expect(g.automation().setDispersal('nope', 10)).toBe(false);
    expect(g.automation().setDispersal('a', Number.NaN)).toBe(false);
  });
});

describe('automation is saved and keeps every invariant', () => {
  const setup = () => {
    const g = game(3);
    g.automation().unlock('autoBurn');
    g.automation().unlock('autosale');
    g.automation().unlock('dispersal');
    g.automation().setAutoBurn(true);
    g.automation().setAutoBurnCeiling(42);
    g.automation().setAutosale('rare', true);
    g.automation().setDispersal('b', 30);
    return g;
  };

  it('a save restores the unlocks and every setting', () => {
    const restored = deserializeState(serializeState(setup().getState()), config, numberFactory)!;
    expect(restored.automation.unlocked).toEqual({ autoBurn: true, autosale: true, dispersal: true });
    expect(restored.automation.autoBurnOn).toBe(true);
    expect(restored.automation.autoBurnCeiling).toBe(42);
    expect(restored.automation.autosale).toEqual({ rare: true });
    expect(restored.automation.dispersal).toEqual({ b: 30 });
    expect(findInvariantViolations(restored, config)).toEqual([]);
  });

  it('saving, loading and saving again gives the same text', () => {
    const saved = serializeState(setup().getState());
    expect(serializeState(deserializeState(saved, config, numberFactory)!)).toBe(saved);
  });

  it('a save cannot unlock more than the points owned, or set what is not unlocked', () => {
    const data = JSON.parse(serializeState(setup().getState()));
    data.purchased = { core: 1 }; // one point only
    data.automation.unlocked = { autoBurn: true, autosale: true, dispersal: true };
    data.automation.autoBurnCeiling = -5;
    data.automation.dispersal = { b: 30, nope: 10 };
    const restored = deserializeState(JSON.stringify(data), config, numberFactory)!;
    expect(restored.automation.unlocked).toEqual({ autoBurn: true });
    expect(restored.automation.autoBurnCeiling).toBe(10); // the bad value is ignored: the default stays
    expect(restored.automation.autosale).toEqual({});
    expect(restored.automation.dispersal).toEqual({});
    expect(findInvariantViolations(restored, config)).toEqual([]);
  });

  it('an old save without the entry loads with nothing unlocked', () => {
    const data = JSON.parse(serializeState(game(0).getState()));
    delete data.automation;
    const restored = deserializeState(JSON.stringify(data), config, numberFactory)!;
    expect(restored.automation.unlocked).toEqual({});
    expect(restored.automation.autoBurnOn).toBe(false);
  });

  it('one long tick and many short ones sell and burn the same', () => {
    const run = (ticks: number) => {
      const g = setup();
      loose(g).heat = 100;
      loose(g).inventory['lead'] = { common: 100 };
      loose(g).inventory['file'] = { rare: 4 };
      for (let i = 0; i < ticks; i++) g.tick(60_000 / ticks);
      return { heat: loose(g).heat <= 42, rare: loose(g).inventory['file']?.['rare'] ?? 0 };
    };
    expect(run(1)).toEqual(run(60));
  });
});

describe('automation configuration is validated', () => {
  it('accepts the test content', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('rejects a negative default ceiling and a point buyable that gives no whole number of points', () => {
    expect(validateConfig(createConfig(config, { automation: { autoBurnCeiling: -1 } })).join()).toContain('automation.autoBurnCeiling');
    const bad = createConfig(config, {
      buyables: [
        ...testConfig.buyables,
        { id: 'core', name: 'Core', description: '', cost: num(1), effect: { kind: 'automationPoints', perCopy: 0.5 } },
      ],
    });
    expect(validateConfig(bad).join()).toContain('automationPoints perCopy');
  });
});
