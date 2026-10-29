import { describe, expect, it } from 'vitest';
import { seededGame } from '../../testing/gameKit';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { testConfig } from '../../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type GameConfig } from '..';
import { asSave, flatSave } from '../../testing/saveKit';

/**
 * The test item `ak` is an Admin key (not sellable, one stack) and `sh` the Skill shard it may drop. The test action `a` pays 0.5
 * credits and 1 XP per 10 s run; a critical run pays 3x and gives 2x XP. A second action `b` has no Admin key. Levels are pushed out of
 * reach so the speed stays put, and the chance of a critical success is 0 unless a test buys it.
 */
function configWith(shardChance = 1): GameConfig {
  return createConfig(testConfig, {
    items: {
      rarities: testConfig.items.rarities,
      definitions: [
        ...testConfig.items.definitions,
        { id: 'ak', name: 'Admin key', sellable: false, hasRarity: false },
        { id: 'sh', name: 'Skill shard', sellable: false, hasRarity: false },
        { id: 'zd', name: 'Zero-day', sellable: false, hasRarity: false },
      ],
      adminKey: { itemId: 'ak', actionId: 'a', shard: { itemId: 'sh', chance: shardChance } },
      skillShard: { itemId: 'sh', levelsDelayed: 1 },
      zeroDay: { itemId: 'zd', actionId: 'b' },
    },
    actions: [testConfig.actions[0]!, { id: 'b', name: 'B', baseDurationMs: 10_000, reward: num(0.5), xpPerRun: num(1) }],
    buyables: [
      ...testConfig.buyables,
      { id: 'auto-b', name: 'Auto B', description: '', actionId: 'b', cost: num(1), effect: { kind: 'autoRun' } },
      { id: 'crit', name: 'Crit', description: '', cost: num(1), maxPurchases: Infinity, effect: { kind: 'criticalChance', chance: 0.05 } },
    ],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
}

/** A game in which one action auto-runs (the other waits), so a test sees only the runs it asks for. */
function game(config = configWith(), seed = 1, auto = 'auto') {
  return seededGame(config, seed, [auto]);
}
type Game = ReturnType<typeof game>;

const give = (g: Game, item: string, n: number): void => {
  (g.getState() as unknown as { wallet: { inventory: Record<string, Record<string, number>> } }).wallet.inventory[item] = { common: n };
};
const held = (g: Game, item: string): number => g.getState().wallet.inventory[item]?.['common'] ?? 0;
const credits = (g: Game): number => g.getState().wallet.credits.toNumber();
const xp = (g: Game, id = 'a'): number => g.getState().sleeve.actions[id]!.xp.toNumber();
function run(g: Game, runs: number, id = 'a'): void {
  g.startAction(id);
  g.tick(10_000 * runs + 1);
}

describe('Admin keys: the toggle', () => {
  it('cannot be switched on with none held', () => {
    const g = game();
    expect(g.canToggleAdminKeys()).toBe(false);
    expect(g.toggleAdminKeys()).toBe(false);
    expect(g.getState().sleeve.keyToggles['adminKey']).not.toBe(true);
  });

  it('switches on with one held, and off again', () => {
    const g = game();
    give(g, 'ak', 3);
    expect(g.canToggleAdminKeys()).toBe(true);
    expect(g.toggleAdminKeys()).toBe(true);
    expect(g.toggleAdminKeys()).toBe(false);
  });

  it('is independent of the Zero-day toggle', () => {
    const g = game();
    give(g, 'ak', 1);
    g.toggleAdminKeys();
    expect(g.getState().sleeve.keyToggles['zeroDay']).not.toBe(true);
    expect(g.canToggleZeroDays()).toBe(false);
  });
});

describe('Admin keys: critical runs', () => {
  it('every completed run of its action uses one key and is critical: 3x the reward and 2x the XP', () => {
    const g = game();
    give(g, 'ak', 100);
    g.toggleAdminKeys();
    const before = credits(g);
    run(g, 4);
    expect(held(g, 'ak')).toBe(96);
    expect(credits(g) - before).toBeCloseTo(4 * 0.5 * 3, 9);
    expect(xp(g)).toBe(8);
  });

  it('a batch of runs is settled in one step: min(runs, held) are critical, the rest ordinary', () => {
    const g = game();
    give(g, 'ak', 3);
    g.toggleAdminKeys();
    const before = credits(g);
    run(g, 10);
    expect(held(g, 'ak')).toBe(0);
    expect(g.getState().sleeve.keyToggles['adminKey']).not.toBe(true); // the last key switched it off
    expect(credits(g) - before).toBeCloseTo(3 * 0.5 * 3 + 7 * 0.5, 9);
    expect(xp(g)).toBe(3 * 2 + 7);
  });

  it('does nothing for an action it is not for, and keeps its keys', () => {
    const g = game(configWith(), 1, 'auto-b');
    give(g, 'ak', 5);
    g.toggleAdminKeys();
    run(g, 3, 'b');
    expect(held(g, 'ak')).toBe(5);
    expect(xp(g, 'b')).toBe(3);
  });

  it('is not used while switched off', () => {
    const g = game();
    give(g, 'ak', 5);
    run(g, 3);
    expect(held(g, 'ak')).toBe(5);
    expect(xp(g)).toBe(3);
  });

  it('a run made critical by a key is critical for sure: no chance involved', () => {
    const a = game(configWith(), 1);
    const b = game(configWith(), 99);
    for (const g of [a, b]) {
      give(g, 'ak', 50);
      g.toggleAdminKeys();
      run(g, 20);
    }
    expect(credits(a)).toBeCloseTo(credits(b), 9);
  });
});

describe('Admin keys: the Skill shard', () => {
  it('with chance 1 every key-assisted critical run drops a shard, in the single stack', () => {
    const g = game(configWith(1));
    give(g, 'ak', 10);
    g.toggleAdminKeys();
    run(g, 4);
    expect(held(g, 'sh')).toBe(4);
    expect(g.getState().wallet.inventory['sh']?.['rare']).toBeUndefined();
  });

  it('with chance 0 none drops', () => {
    const g = game(configWith(0));
    give(g, 'ak', 10);
    g.toggleAdminKeys();
    run(g, 6);
    expect(held(g, 'sh')).toBe(0);
  });

  it('only runs the keys made critical can drop one: a critical success by chance never does', () => {
    const g = game(configWith(1));
    g.buy('crit'); // 5% chance of a critical success, no keys
    run(g, 200);
    expect(held(g, 'sh')).toBe(0);
  });

  it('a partial chance drops about that share of the key-assisted runs', () => {
    const g = game(configWith(0.1), 7);
    give(g, 'ak', 100_000);
    g.toggleAdminKeys();
    run(g, 5_000);
    const shards = held(g, 'sh');
    expect(shards).toBeGreaterThan(400);
    expect(shards).toBeLessThan(600);
  });

  it('one long tick and many short ones use up the same keys', () => {
    const long = game(configWith(1));
    const short = game(configWith(1));
    for (const g of [long, short]) {
      give(g, 'ak', 8);
      g.toggleAdminKeys();
      g.startAction('a');
    }
    long.tick(100_000 + 1);
    for (let i = 0; i < 100; i++) short.tick(1_000);
    short.tick(1);
    expect(held(long, 'ak')).toBe(held(short, 'ak'));
    expect(held(long, 'sh')).toBe(held(short, 'sh'));
  });
});

describe('Admin keys: saving, configuration and invariants', () => {
  it('the toggle round-trips while a key is held, and falls back to off when none is left', () => {
    const config = configWith();
    const g = game(config);
    give(g, 'ak', 2);
    g.toggleAdminKeys();
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.sleeve.keyToggles['adminKey']).toBe(true);
    const json = flatSave(serializeState(g.getState()));
    json.inventory = {};
    expect(deserializeState(asSave(json), config, numberFactory)!.sleeve.keyToggles['adminKey']).toBeUndefined();
  });

  it('flags the toggle on without a key as a broken state', () => {
    const g = game();
    (g.getState().sleeve as { keyToggles: Record<string, boolean> }).keyToggles['adminKey'] = true;
    expect(findInvariantViolations(g.getState(), configWith())).toContain('the Admin key toggle is switched on without an Admin key held');
  });

  it('rejects bad references', () => {
    const base = configWith();
    const bad = createConfig(base, {
      items: {
        ...base.items,
        adminKey: { itemId: 'nope', actionId: 'zzz', shard: { itemId: 'file', chance: 2 } },
        skillShard: { itemId: 'nope', levelsDelayed: 0 },
      },
    });
    const text = validateConfig(bad).join('\n');
    expect(text).toContain('items.adminKey refers to unknown item "nope"');
    expect(text).toContain('items.adminKey refers to unknown action "zzz"');
    expect(text).toContain('items.adminKey.shard must be an item without rarity');
    expect(text).toContain('items.adminKey.shard.chance must be between 0 and 1');
    expect(text).toContain('items.skillShard refers to unknown item "nope"');
    expect(text).toContain('items.skillShard.levelsDelayed must be an integer >= 1');
  });

  it('the valid test content passes', () => {
    expect(validateConfig(configWith())).toEqual([]);
  });
});
