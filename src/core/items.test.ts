import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { seededRandom } from '../testing/random';
import { setCredits, testConfig } from '../testing/testConfig';
import {
  createConfig,
  deserializeState,
  serializeState,
  validateConfig,
  type BuyableDefinition,
  type GameConfig,
  type ItemDropRule,
} from './index';
import { numberFactory } from '../numbers';

/** A drop rule for the test item: 5% of runs, 90 / 10 over the two rarities. */
const rule = (over: Partial<ItemDropRule> = {}): ItemDropRule => ({
  itemId: 'file',
  chance: 0.05,
  rarityWeights: { common: 90, rare: 10 },
  ...over,
});

const harvest = (drop: ItemDropRule = rule()): BuyableDefinition => ({
  id: 'harvest',
  name: 'Harvest',
  description: '',
  actionId: 'a',
  cost: num(5),
  effect: { kind: 'itemDrop', drop },
});

const withHarvest = (drop?: ItemDropRule): GameConfig => createConfig(testConfig, { buyables: [...testConfig.buyables, harvest(drop)] });

/** A game that owns the harvest buyable and auto-run, with a seeded source of chance. */
function farm(config: GameConfig, seed = 1) {
  const g = createGame({ config, random: seededRandom(seed) });
  setCredits(g, num(1000));
  expect(g.buy('harvest')).toBe('purchased');
  expect(g.buy('auto')).toBe('purchased');
  return g;
}

const held = (g: { getState(): unknown }, rarity: string): number =>
  (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['file']?.[rarity] ?? 0;

/** Runs completed so far (1 action XP per run). */
const runsDone = (g: { getState(): { actions: Record<string, { xp: { toNumber(): number } }> } }): number =>
  g.getState().actions['a']!.xp.toNumber();

describe('item drops', () => {
  it('drop nothing before the drop buyable is owned', () => {
    const g = createGame({ config: withHarvest(rule({ chance: 1 })), random: seededRandom(1) });
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().actions['a']!.xp.eq(num(1))).toBe(true);
    expect(g.getState().inventory).toEqual({});
  });

  it('with chance 1 every completed run drops one item of the only weighted rarity', () => {
    const g = farm(withHarvest(rule({ chance: 1, rarityWeights: { common: 1 } })));
    g.startAction('a');
    g.tick(10_000 * 3 + 1);
    expect(held(g, 'common')).toBe(3);
    expect(held(g, 'rare')).toBe(0);
  });

  it('with chance 0 nothing ever drops', () => {
    const g = farm(withHarvest(rule({ chance: 0 })));
    g.startAction('a');
    g.tick(10_000_000);
    expect(g.getState().inventory).toEqual({});
  });

  it('a rarity left out of the weights, or weighted 0, never drops', () => {
    const g = farm(withHarvest(rule({ chance: 1, rarityWeights: { common: 5, rare: 0 } })), 9);
    g.startAction('a');
    g.tick(10_000 * 500);
    expect(runsDone(g)).toBeGreaterThanOrEqual(500);
    expect(held(g, 'common')).toBe(runsDone(g));
    expect(held(g, 'rare')).toBe(0);
  });

  it('is decided by the injected randomness', () => {
    const lucky = createGame({ config: withHarvest(), random: () => 0 });
    const unlucky = createGame({ config: withHarvest(), random: () => 0.999 });
    for (const g of [lucky, unlucky]) {
      setCredits(g, num(1000));
      g.buy('harvest');
      g.buy('auto');
      g.startAction('a');
      g.tick(10_000 * 20 + 1);
    }
    expect(runsDone(lucky)).toBeGreaterThanOrEqual(20);
    expect(held(lucky, 'common') + held(lucky, 'rare')).toBe(runsDone(lucky));
    expect(held(unlucky, 'common') + held(unlucky, 'rare')).toBe(0);
  });

  it('over many runs the drop chance and the rarity shares follow the configured numbers', () => {
    const g = farm(withHarvest());
    g.startAction('a');
    g.tick(10_000 * 200_000);
    const runs = runsDone(g);
    expect(runs).toBeGreaterThan(100_000);
    const common = held(g, 'common');
    const rare = held(g, 'rare');
    const drops = common + rare;
    expect(drops / runs).toBeCloseTo(0.05, 2);
    expect(common / drops).toBeCloseTo(0.9, 2);
  });

  it('one long tick and many short ones drop at the same rate', () => {
    const dropsPerRun = (sliceMs: number): number => {
      let drops = 0;
      let runs = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const g = farm(withHarvest(), seed);
        g.startAction('a');
        for (let t = 0; t < 2_000_000 / sliceMs; t++) g.tick(sliceMs);
        drops += held(g, 'common') + held(g, 'rare');
        runs += runsDone(g);
      }
      return drops / runs;
    };
    expect(dropsPerRun(2_000_000)).toBeCloseTo(0.05, 1);
    expect(dropsPerRun(1_000)).toBeCloseTo(0.05, 1);
  });

  it('keeps the state sound', () => {
    const g = farm(withHarvest(rule({ chance: 0.5 })));
    g.startAction('a');
    g.tick(10_000 * 1000);
    expect(findInvariantViolations(g.getState(), g.getConfig())).toEqual([]);
  });

  it('only the action that owns the buyable drops', () => {
    const config = createConfig(testConfig, {
      actions: [...testConfig.actions, { id: 'b', name: 'B', baseDurationMs: 1_000, reward: num(0), xpPerRun: num(1) }],
      buyables: [...testConfig.buyables, harvest(rule({ chance: 1, rarityWeights: { common: 1 } }))],
    });
    const g = createGame({ config, random: seededRandom(2) });
    setCredits(g, num(100));
    g.buy('harvest');
    g.startAction('b');
    g.tick(5_000);
    expect(g.getState().actions['b']!.xp.gte(num(1))).toBe(true);
    expect(g.getState().inventory).toEqual({});
  });
});

describe('test drop (test aid)', () => {
  const total = (g: { getState(): unknown }): number => held(g, 'common') + held(g, 'rare');

  it('drops exactly one item whatever the chance, by the current weights', () => {
    const g = createGame({ config: withHarvest(rule({ chance: 0 })), random: seededRandom(4) });
    setCredits(g, num(100));
    g.buy('harvest');
    g.dropTestItem();
    expect(total(g)).toBe(1);
  });

  it('follows the rarity weights: a rarity weighted 0 never drops, over many presses', () => {
    const g = createGame({ config: withHarvest(rule({ rarityWeights: { common: 0, rare: 1 } })), random: seededRandom(4) });
    setCredits(g, num(100));
    g.buy('harvest');
    for (let i = 0; i < 50; i++) g.dropTestItem();
    expect(held(g, 'rare')).toBe(50);
    expect(held(g, 'common')).toBe(0);
  });

  it('over many presses the rarity shares follow the weights (90 / 10)', () => {
    const g = createGame({ config: withHarvest(), random: seededRandom(8) });
    setCredits(g, num(100));
    g.buy('harvest');
    for (let i = 0; i < 4000; i++) g.dropTestItem();
    expect(total(g)).toBe(4000);
    expect(held(g, 'common') / 4000).toBeCloseTo(0.9, 1);
  });

  it('works before the drop buyable is bought, using the configured rule', () => {
    const g = createGame({ config: withHarvest(rule({ rarityWeights: { rare: 1 } })), random: seededRandom(4) });
    g.dropTestItem();
    expect(held(g, 'rare')).toBe(1);
  });

  it('does nothing when the game has no drop rule at all', () => {
    const g = createGame({ config: testConfig });
    g.dropTestItem();
    expect(g.getState().inventory).toEqual({});
  });
});

describe('selling items', () => {
  const stocked = () => {
    const g = createGame({ config: testConfig });
    (g.getState() as { inventory: unknown }).inventory = { file: { common: 5, rare: 2 } };
    return g;
  };

  it('sells one item for its rarity value', () => {
    const g = stocked();
    expect(g.sellItems('file', 'common', 1)).toBe(1);
    expect(held(g, 'common')).toBe(4);
    expect(g.getState().credits.eq(num(10))).toBe(true);
  });

  it('sells a whole stack', () => {
    const g = stocked();
    expect(g.sellItems('file', 'rare', 'all')).toBe(2);
    expect(held(g, 'rare')).toBe(0);
    expect(g.getState().credits.eq(num(200))).toBe(true);
  });

  it('asking for more than is held sells what is held', () => {
    const g = stocked();
    expect(g.sellItems('file', 'common', 99)).toBe(5);
    expect(g.getState().credits.eq(num(50))).toBe(true);
  });

  it('sells nothing for an empty stack, an unknown stack, or a nonsense amount', () => {
    const g = stocked();
    expect(g.sellItems('file', 'common', 0)).toBe(0);
    expect(g.sellItems('file', 'common', -3)).toBe(0);
    expect(g.sellItems('file', 'common', Number.NaN)).toBe(0);
    expect(g.sellItems('file', 'nope', 'all')).toBe(0);
    expect(g.sellItems('nope', 'common', 'all')).toBe(0);
    expect(g.getState().credits.isZero()).toBe(true);
    expect(held(g, 'common')).toBe(5);
  });

  it('a sale pays in full: the heat tax and the credit lever do not touch it', () => {
    const g = createGame({ config: createConfig(testConfig, { global: { creditMultiplier: 3 } }) });
    (g.getState() as { inventory: unknown; heat: number }).inventory = { file: { common: 1 } };
    (g.getState() as { heat: number }).heat = 50;
    g.sellItems('file', 'common', 'all');
    expect(g.getState().credits.eq(num(10))).toBe(true);
  });

  it('every rarity sells for an order of magnitude more than the one before, in the real content', async () => {
    const { gameConfig } = await import('../content/gameConfig');
    const values = gameConfig.items.rarities.map((r) => r.sellValue.toNumber());
    expect(values[0]).toBe(10);
    for (let i = 1; i < values.length; i++) expect(values[i]! / values[i - 1]!).toBe(10);
  });
});

describe('inventory in saves and resets', () => {
  const stocked = () => {
    const g = createGame({ config: testConfig });
    (g.getState() as { inventory: unknown }).inventory = { file: { common: 5, rare: 2 } };
    return g;
  };

  it('survives a save and load', () => {
    const restored = deserializeState(serializeState(stocked().getState()), testConfig, numberFactory)!;
    expect(restored.inventory).toEqual({ file: { common: 5, rare: 2 } });
  });

  it('an older save without an inventory loads with an empty one', () => {
    const json = JSON.parse(serializeState(stocked().getState()));
    delete json.inventory;
    expect(deserializeState(JSON.stringify(json), testConfig, numberFactory)!.inventory).toEqual({});
  });

  it('loading drops unknown items and rarities and repairs bad counts', () => {
    const json = JSON.parse(serializeState(stocked().getState()));
    json.inventory = { file: { common: 3.5, rare: -4, epic: 9 }, ghost: { common: 1 } };
    expect(deserializeState(JSON.stringify(json), testConfig, numberFactory)!.inventory).toEqual({});
    json.inventory = { file: { common: 4, rare: 'x', epic: 9 }, ghost: { common: 1 } };
    expect(deserializeState(JSON.stringify(json), testConfig, numberFactory)!.inventory).toEqual({ file: { common: 4 } });
    json.inventory = 'junk';
    expect(deserializeState(JSON.stringify(json), testConfig, numberFactory)!.inventory).toEqual({});
  });

  it('re-sleeving and a new game empty the inventory', () => {
    const a = stocked();
    expect(a.resleeve()).toBe(true);
    expect(a.getState().inventory).toEqual({});
    const b = stocked();
    b.newGame();
    expect(b.getState().inventory).toEqual({});
  });

  it('a state with a broken stack is reported by the invariants', () => {
    const g = stocked();
    expect(findInvariantViolations(g.getState(), g.getConfig())).toEqual([]);
    (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['file']!['common'] = -1;
    expect(findInvariantViolations(g.getState(), g.getConfig()).join()).toContain('file/common');
  });
});

describe('item configuration is validated', () => {
  const problems = (config: GameConfig): string => validateConfig(config).join('\n');

  it('the test content is valid', () => {
    expect(problems(withHarvest())).toBe('');
  });

  it.each([
    [{ itemId: 'nope' }, 'unknown item'],
    [{ chance: 1.5 }, 'chance must be between 0 and 1'],
    [{ chance: -0.1 }, 'chance must be between 0 and 1'],
    [{ chance: Number.NaN }, 'chance must be between 0 and 1'],
    [{ rarityWeights: { epic: 1 } }, 'unknown rarity "epic"'],
    [{ rarityWeights: { common: -1, rare: 1 } }, 'weight of "common" must be >= 0'],
    [{ rarityWeights: { common: 0 } }, 'at least one drop weight must be > 0'],
    [{ rarityWeights: {} }, 'at least one drop weight must be > 0'],
  ] as const)('a drop rule with %j is rejected', (bad, message) => {
    expect(problems(withHarvest(rule(bad as Partial<ItemDropRule>)))).toContain(message);
  });

  it('an itemDrop buyable needs an action', () => {
    const { actionId: _actionId, ...global } = harvest();
    expect(problems(createConfig(testConfig, { buyables: [global] }))).toContain('needs an actionId');
  });

  it('rejects duplicate ids, a negative sell value and items without rarities', () => {
    const dup = createConfig(testConfig, {
      items: {
        rarities: [
          { id: 'common', name: 'C', sellValue: num(1) },
          { id: 'common', name: 'C', sellValue: num(-1) },
        ],
        definitions: [
          { id: 'file', name: 'F' },
          { id: 'file', name: 'F' },
        ],
      },
    });
    const text = problems(dup);
    expect(text).toContain('duplicate rarity id "common"');
    expect(text).toContain('sellValue must be >= 0');
    expect(text).toContain('duplicate item id "file"');
    expect(problems(createConfig(testConfig, { items: { rarities: [], definitions: [{ id: 'file', name: 'F' }] } }))).toContain(
      'at least one rarity',
    );
  });
});
