import { describe, expect, it } from 'vitest';
import { seededGame } from '../../testing/gameKit';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { seededRandom } from '../../testing/random';
import { testConfig } from '../../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type GameConfig } from '..';

/**
 * The test item `zd`: not sellable, without rarity (one stack), dropped by the test action `a`, which a Zero-day makes critical.
 * The test action pays 0.5 credits and 1 XP per 10 s run; a critical run pays 3x and gives 2x XP. Levels are pushed out of reach so
 * the speed stays put, and the chance of a critical success is 0 unless a test buys it.
 */
function configWith(over: { chance?: number; critChance?: number } = {}): GameConfig {
  const base = createConfig(testConfig, {
    items: {
      rarities: testConfig.items.rarities,
      definitions: [...testConfig.items.definitions, { id: 'zd', name: 'Zero-day', sellable: false, hasRarity: false }],
      zeroDay: { itemId: 'zd', actionId: 'a' },
    },
    buyables: [
      ...testConfig.buyables,
      {
        id: 'drops',
        name: 'Drops',
        description: '',
        actionId: 'a',
        cost: num(1),
        effect: { kind: 'itemDrop', drop: { itemId: 'zd', chance: over.chance ?? 0.05 } },
      },
      {
        id: 'crit',
        name: 'Crit',
        description: '',
        cost: num(1),
        maxPurchases: Infinity,
        effect: { kind: 'criticalChance', chance: over.critChance ?? 0.05 },
      },
    ],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
  return base;
}

function game(config = configWith(), seed = 1) {
  return seededGame(config, seed, ['auto']);
}

type Game = ReturnType<typeof game>;
const give = (g: Game, n: number): void => {
  (g.getState() as { inventory: Record<string, Record<string, number>> }).inventory['zd'] = { common: n };
};
const held = (g: Game): number => g.getState().inventory['zd']?.['common'] ?? 0;
const credits = (g: Game): number => g.getState().credits.toNumber();
const xp = (g: Game): number => g.getState().actions['a']!.xp.toNumber();

/** Runs `runs` completed runs of the auto-running test action. */
function run(g: Game, runs: number): void {
  g.startAction('a');
  g.tick(10_000 * runs + 1);
}

describe('Zero-days: dropping', () => {
  it('with chance 1 every completed run drops one Zero-day, in the single stack', () => {
    const g = game(configWith({ chance: 1 }));
    g.buy('drops');
    run(g, 5);
    expect(held(g)).toBe(5);
    expect(g.getState().inventory['zd']?.['rare']).toBeUndefined();
  });
});

describe('Zero-days: the toggle', () => {
  it('cannot be switched on with none held', () => {
    const g = game();
    expect(g.canToggleZeroDays()).toBe(false);
    expect(g.toggleZeroDays()).toBe(false);
    expect(g.getState().zeroDaysOn).toBe(false);
  });

  it('switches on with one held, and off again', () => {
    const g = game();
    give(g, 3);
    expect(g.canToggleZeroDays()).toBe(true);
    expect(g.toggleZeroDays()).toBe(true);
    expect(g.getState().zeroDaysOn).toBe(true);
    expect(g.toggleZeroDays()).toBe(false);
    expect(g.getState().zeroDaysOn).toBe(false);
    expect(held(g)).toBe(3); // switching does not use any up
  });

  it('starts off in a new game and after re-sleeving', () => {
    const g = game();
    expect(g.getState().zeroDaysOn).toBe(false);
    give(g, 2);
    g.toggleZeroDays();
    g.newGame();
    expect(g.getState().zeroDaysOn).toBe(false);
    expect(held(g)).toBe(0);
  });
});

describe('Zero-days: guaranteed critical runs', () => {
  it('while off nothing is used and no run is critical: 0.5 credits and 1 XP per run', () => {
    const g = game();
    give(g, 5);
    const before = credits(g);
    run(g, 4);
    expect(credits(g) - before).toBeCloseTo(2, 9);
    expect(xp(g)).toBe(4);
    expect(held(g)).toBe(5);
  });

  it('while on, each completed run uses one up and is critical: 3x the reward and 2x the XP', () => {
    const g = game();
    give(g, 10);
    g.toggleZeroDays();
    const before = credits(g);
    run(g, 4);
    expect(held(g)).toBe(6);
    expect(credits(g) - before).toBeCloseTo(4 * 0.5 * 3, 9);
    expect(xp(g)).toBe(4 * 2);
    expect(g.getState().zeroDaysOn).toBe(true);
  });

  it('keeps going as long as any are held, and switches itself off when the last one is used', () => {
    const g = game();
    give(g, 2);
    g.toggleZeroDays();
    const before = credits(g);
    run(g, 5); // 2 critical runs (3x), then 3 ordinary runs
    expect(held(g)).toBe(0);
    expect(g.getState().zeroDaysOn).toBe(false);
    expect(credits(g) - before).toBeCloseTo(2 * 0.5 * 3 + 3 * 0.5, 9);
    expect(xp(g)).toBe(2 * 2 + 3);
  });

  it('a batch larger than the stock uses all of it and rolls the rest as usual (chance 0 here: ordinary)', () => {
    const g = game();
    give(g, 3);
    g.toggleZeroDays();
    g.startAction('a');
    g.tick(10_000 * 20 + 1); // one long tick: the runs complete in batches, the 3 Zero-days cover the first runs
    expect(held(g)).toBe(0);
    expect(g.getState().zeroDaysOn).toBe(false);
  });

  it('a Zero-day adds +100% on top of the normal chance: with chance 100% four runs and one Zero-day are five critical successes', () => {
    const g = game(configWith({ critChance: 1 }));
    g.buy('crit');
    give(g, 1);
    g.toggleZeroDays();
    const before = credits(g);
    run(g, 4);
    expect(credits(g) - before).toBeCloseTo(5 * 0.5 * 3, 9); // one run has two critical successes: 2 x 3 x 0.5, the other three 3 x 0.5
    expect(held(g)).toBe(0);
  });

  it('does not touch the runs of other actions', () => {
    const base = configWith();
    const config = createConfig(base, {
      actions: [...base.actions, { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0.5), xpPerRun: num(1) }],
    });
    const g = createGame({ config, random: seededRandom(1) });
    give(g, 5);
    g.toggleZeroDays();
    g.startAction('b');
    g.tick(10_001);
    expect(held(g)).toBe(5);
    expect(g.getState().actions['b']!.xp.toNumber()).toBe(1);
  });

  it('one long tick and many short ones use the same Zero-days and pay the same', () => {
    const long = game();
    const short = game();
    for (const g of [long, short]) {
      give(g, 7);
      g.toggleZeroDays();
      g.startAction('a');
    }
    const startCredits = credits(long);
    long.tick(10_000 * 12);
    for (let i = 0; i < 120; i++) short.tick(1_000);
    expect(held(short)).toBe(held(long));
    expect(held(long)).toBe(0);
    expect(credits(short) - startCredits).toBeCloseTo(credits(long) - startCredits, 6);
  });
});

describe('Zero-days: saving', () => {
  it('keeps the toggle on while a Zero-day is held', () => {
    const g = game();
    give(g, 2);
    g.toggleZeroDays();
    const back = deserializeState(serializeState(g.getState()), g.getConfig(), numberFactory)!;
    expect(back.zeroDaysOn).toBe(true);
    expect(back.inventory['zd']?.['common']).toBe(2);
  });

  it('switches the toggle off when the save holds none, so a doctored save cannot arm an empty stack', () => {
    const g = game();
    give(g, 2);
    g.toggleZeroDays();
    const data = JSON.parse(serializeState(g.getState())) as Record<string, unknown>;
    data['inventory'] = {};
    const back = deserializeState(JSON.stringify(data), g.getConfig(), numberFactory)!;
    expect(back.zeroDaysOn).toBe(false);
  });

  it('reads a save without the field as off', () => {
    const g = game();
    give(g, 2);
    const data = JSON.parse(serializeState(g.getState())) as Record<string, unknown>;
    delete data['zeroDaysOn'];
    expect(deserializeState(JSON.stringify(data), g.getConfig(), numberFactory)!.zeroDaysOn).toBe(false);
  });
});

describe('Zero-days: configuration', () => {
  it('rejects an unknown item or action', () => {
    const base = configWith();
    const badItem = createConfig(base, { items: { ...base.items, zeroDay: { itemId: 'ghost', actionId: 'a' } } });
    expect(validateConfig(badItem).join('|')).toContain('items.zeroDay refers to unknown item "ghost"');
    const badAction = createConfig(base, { items: { ...base.items, zeroDay: { itemId: 'zd', actionId: 'ghost' } } });
    expect(validateConfig(badAction).join('|')).toContain('items.zeroDay refers to unknown action "ghost"');
  });

  it('a game without the rule has no toggle', () => {
    const g = createGame({ config: testConfig });
    expect(g.canToggleZeroDays()).toBe(false);
    expect(g.toggleZeroDays()).toBe(false);
  });
});
