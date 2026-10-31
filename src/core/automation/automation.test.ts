import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { automationLaneBuyables, laneSkillId } from '../../testing/automationKit';
import { findInvariantViolations } from '../../testing/invariants';
import { setCredits, testConfig } from '../../testing/testConfig';
import {
  AUTOMATION_FEATURES,
  createConfig,
  deserializeState,
  isFeatureUnlocked,
  serializeState,
  validateConfig,
  type GameConfig,
} from '..';
import { flat } from '../../testing/flatState';
import { asSave, flatSave } from '../../testing/saveKit';

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
    { id: 'auto-b', name: 'Auto B', description: '', actionId: 'b', cost: num(10), effect: { kind: 'autoRun' } },
    ...automationLaneBuyables(),
  ],
  automation: { autoBurnCeiling: 10, autoBurnUpper: 50 },
});

type Loose = {
  heat: number;
  inventory: Record<string, Record<string, number>>;
  actions: Record<string, { xp: unknown; augments: Record<string, number> }>;
};
const loose = (g: { getState(): unknown }): Loose => flat<Loose>(g);

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
    expect(g.getState().wallet.credits.eq(num(3 * 10))).toBe(true);
  });

  it('rare needs its own skill, and a switched-off rarity is kept', () => {
    const g = game(2);
    g.automation().unlock('autosale');
    g.buy(laneSkillId('autosale', 2));
    loose(g).inventory['file'] = { common: 3, rare: 2 };
    setCredits(g, num(0));
    g.automation().setAutosale('common', true);
    g.automation().setAutosale('rare', true);
    g.automation().setAutosale('common', false);
    g.tick(1);
    expect(loose(g).inventory['file']!['common']).toBe(3);
    expect(g.getState().wallet.credits.eq(num(2 * 100))).toBe(true);
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

describe('automation is saved and keeps every invariant', () => {
  const setup = () => {
    const g = game(5);
    g.automation().unlock('autoBurn');
    g.buy(laneSkillId('autoBurn', 2));
    g.automation().unlock('autosale');
    g.buy(laneSkillId('autosale', 2));
    g.automation().unlock('dispersal');
    g.automation().autoBurn().setSwitch('hold', true);
    g.toggleBurnLead();
    g.automation().setAutosale('rare', true);
    g.automation().setDispersalTarget('b', true);
    return g;
  };

  it('a save restores the unlocks and every setting', () => {
    const restored = deserializeState(serializeState(setup().getState()), config, numberFactory)!;
    expect(AUTOMATION_FEATURES.every((f) => isFeatureUnlocked(config.buyables, restored.sleeve.purchased, f))).toBe(true);
    expect(restored.sleeve.autoBurn.on).toBe(true);
    expect(restored.wallet.automation.autoBurn.switches.hold).toBe(true);
    expect(restored.wallet.automation.autosale).toEqual({ rare: true });
    expect(restored.wallet.automation.dispersalTargets).toEqual(['b']);
    expect(findInvariantViolations(restored, config)).toEqual([]);
  });

  it('saving, loading and saving again gives the same text', () => {
    const saved = serializeState(setup().getState());
    expect(serializeState(deserializeState(saved, config, numberFactory)!)).toBe(saved);
  });

  it('a save cannot set what is not unlocked', () => {
    const data = flatSave(serializeState(setup().getState()));
    data.purchased = { core: 1, [laneSkillId('autoBurn', 1)]: 1 }; // only Auto Burn is unlocked
    data.automation.autoBurn = { lower: -5, switches: { hold: true } };
    data.automation.dispersalTargets = ['b', 'nope'];
    const restored = deserializeState(asSave(data), config, numberFactory)!;
    expect(AUTOMATION_FEATURES.filter((f) => isFeatureUnlocked(config.buyables, restored.sleeve.purchased, f))).toEqual(['autoBurn']);
    expect(restored.wallet.automation.autoBurn.lower).toBe(10); // the bad value is ignored: the default stays
    expect(restored.wallet.automation.autosale).toEqual({});
    expect(restored.wallet.automation.dispersalTargets).toEqual([]);
    expect(findInvariantViolations(restored, config)).toEqual([]);
  });

  it('an old save without the entry loads with nothing unlocked', () => {
    const data = flatSave(serializeState(game(0).getState()));
    delete data.automation;
    const restored = deserializeState(asSave(data), config, numberFactory)!;
    expect(AUTOMATION_FEATURES.some((f) => isFeatureUnlocked(config.buyables, restored.sleeve.purchased, f))).toBe(false);
    expect(restored.sleeve.autoBurn.on).toBe(false);
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
        ...automationLaneBuyables(),
        { id: 'core', name: 'Core', description: '', cost: num(1), effect: { kind: 'automationPoints', perCopy: 0.5 } },
      ],
    });
    expect(validateConfig(bad).join()).toContain('automationPoints perCopy');
  });
});
