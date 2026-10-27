/**
 * Progression, Shop, serialization and config helpers.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../numbers';
import { testConfig } from '../testing/testConfig';
import {
  LevelRule,
  Progression,
  Shop,
  createConfig,
  createInitialState,
  deserializeState,
  serializeState,
  validateConfig,
  type LevelRuleConfig,
} from './index';

const config = testConfig;
const _rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('Progression', () => {
  const progression = new Progression(config, numberFactory);
  const record = (s: ReturnType<typeof createInitialState>, xp: number, runs: number | string) =>
    progression.recordRuns(s, 'a', num(xp), num(runs));

  it('adds action xp and counts runs', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 1, 1);
    expect(s.actions['a']!.xp.eq(num(1))).toBe(true);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(1);
  });

  it('grants 1 sleeve xp per 100 runs and keeps the remainder', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 99, 99);
    expect(s.actions['a']!.sleeveXp.isZero()).toBe(true);
    record(s, 1, 1);
    expect(s.actions['a']!.sleeveXp.eq(num(1))).toBe(true);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(0);
    record(s, 250, 250);
    expect(s.actions['a']!.sleeveXp.eq(num(3))).toBe(true);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(50);
  });

  it('handles huge run counts without breaking (remainder dropped)', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 1, '1e40');
    expect(s.actions['a']!.sleeveXp.floorLog10()).toBe(38);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(0);
  });

  it('sleeveXpPerGrant and runsPerSleeveXp come from the config', () => {
    const custom = createConfig(config, { progression: { runsPerSleeveXp: 10, sleeveXpPerGrant: 5 } });
    const p = new Progression(custom, numberFactory);
    const s = createInitialState(custom, numberFactory);
    p.recordRuns(s, 'a', num(25), num(25));
    expect(s.actions['a']!.sleeveXp.eq(num(10))).toBe(true);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(5);
  });

  it('action level 1 at exactly 10 xp (10 runs)', () => {
    const s = createInitialState(config, numberFactory);
    for (let i = 0; i < 9; i++) record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(0);
    record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(1);
    expect(progression.nextActionLevelXp(s, 'a').eq(num(110))).toBe(true); // 10 for level 1, a further 100 for level 2
    expect(progression.actionXpIntoLevel(s, 'a').isZero()).toBe(true); // the count starts again
    expect(progression.actionXpForLevel(s, 'a').eq(num(100))).toBe(true);
  });

  it('the XP counted inside a level starts again at each level-up, and the next level needs the full amount', () => {
    const s = createInitialState(config, numberFactory);
    record(s, 109, 109);
    expect(progression.actionLevel(s, 'a')).toBe(1);
    expect(progression.actionXpIntoLevel(s, 'a').toNumber()).toBe(99);
    record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(2);
    expect(progression.actionXpIntoLevel(s, 'a').toNumber()).toBe(0);
    expect(progression.actionXpForLevel(s, 'a').toNumber()).toBe(1000);
    record(s, 999, 999);
    expect(progression.actionLevel(s, 'a')).toBe(2);
    record(s, 1, 1);
    expect(progression.actionLevel(s, 'a')).toBe(3);
  });

  it('every level starts at 0', () => {
    const s = createInitialState(config, numberFactory);
    expect(progression.actionLevel(s, 'a')).toBe(0);
    expect(progression.sleeveLevel(s, 'a')).toBe(0);
  });

  it('a per-action level rule overrides the default', () => {
    const custom = createConfig(config, {
      actions: [{ ...config.actions[0]!, levels: { firstLevelXp: 2, growthFactor: 2 } }],
    });
    const p = new Progression(custom, numberFactory);
    const s = createInitialState(custom, numberFactory);
    p.recordRuns(s, 'a', num(5), num(5));
    expect(p.actionLevel(s, 'a')).toBe(1); // level 1 costs 2, level 2 a further 4: 5 XP is not enough for level 2
    p.recordRuns(s, 'a', num(1), num(1));
    expect(p.actionLevel(s, 'a')).toBe(2);
  });

  it('rejects unknown actions', () => {
    const s = createInitialState(config, numberFactory);
    expect(() => progression.recordRuns(s, 'nope', num(1), num(1))).toThrow();
    expect(() => progression.actionLevel(s, 'nope')).toThrow();
  });
});

describe('Shop', () => {
  const shop = new Shop(config.buyables, numberFactory, 1);
  const fresh = () => createInitialState(config, numberFactory);

  it('refuses when credits are insufficient and changes nothing', () => {
    const s = fresh();
    s.credits = num(9.99);
    expect(shop.canBuy(s, 'auto')).toBe(false);
    expect(shop.buy(s, 'auto')).toBe('cannot-afford');
    expect(s.credits.eq(num(9.99))).toBe(true);
    expect(s.purchased['auto']).toBeUndefined();
  });

  it('buys at exactly the cost and deducts it', () => {
    const s = fresh();
    s.credits = num(12);
    expect(shop.buy(s, 'auto')).toBe('purchased');
    expect(s.credits.eq(num(2))).toBe(true);
    expect(s.purchased['auto']).toBe(1);
  });

  it('one-time buyables cannot be bought twice; unknown ids are rejected', () => {
    const s = fresh();
    s.credits = num(100);
    shop.buy(s, 'auto');
    expect(shop.buy(s, 'auto')).toBe('max-reached');
    expect(shop.buy(s, 'ghost')).toBe('unknown');
    expect(s.credits.eq(num(90))).toBe(true);
  });

  it('a gated buyable is locked until its requirement is owned', () => {
    const s = fresh();
    s.credits = num(1000);
    expect(shop.isAvailable(s, 'dup')).toBe(false);
    expect(shop.buy(s, 'dup')).toBe('locked');
    expect(s.credits.eq(num(1000))).toBe(true);
    shop.buy(s, 'dual');
    expect(shop.isAvailable(s, 'dup')).toBe(true);
  });

  it('a repeatable buyable costs 10x more each time, without limit (150, 1500, 15000, ...)', () => {
    const s = fresh();
    s.credits = num('1e30');
    shop.buy(s, 'dual');
    for (let n = 0; n < 12; n++) {
      expect(shop.costOf(s, 'dup').eq(num(150).mul(num(10).pow(n)))).toBe(true);
      expect(shop.buy(s, 'dup')).toBe('purchased');
    }
    expect(s.purchased['dup']).toBe(12);
    expect(shop.isMaxed(s, 'dup')).toBe(false);
  });

  it('charges the price of the copy being bought and refuses when it cannot be paid', () => {
    const s = fresh();
    s.credits = num(15 + 150 + 1000);
    shop.buy(s, 'dual');
    expect(shop.buy(s, 'dup')).toBe('purchased'); // 150
    expect(s.credits.eq(num(1000))).toBe(true);
    expect(shop.buy(s, 'dup')).toBe('cannot-afford'); // 1500 > 1000
    expect(s.credits.eq(num(1000))).toBe(true);
  });

  it('the global cost multiplier scales every price', () => {
    const pricey = new Shop(config.buyables, numberFactory, 2);
    const s = fresh();
    expect(pricey.costOf(s, 'auto').eq(num(20))).toBe(true);
    s.credits = num(19);
    expect(pricey.buy(s, 'auto')).toBe('cannot-afford');
  });

  it('maxPurchases limits repeatable buyables', () => {
    const limited = new Shop([{ ...config.buyables[0]!, maxPurchases: 2 }], numberFactory, 1);
    const s = fresh();
    s.credits = num(100);
    expect(limited.buy(s, 'auto')).toBe('purchased');
    expect(limited.buy(s, 'auto')).toBe('purchased');
    expect(limited.buy(s, 'auto')).toBe('max-reached');
  });
});

describe('serialization', () => {
  it('round-trips a state including huge numbers and copy counts', () => {
    const s = createInitialState(config, numberFactory);
    s.credits = num('1.5e400');
    s.network = num(33);
    s.actions['a'] = {
      xp: num(77),
      sleeveXp: num(12),
      runsTowardSleeveXp: 42,
      augments: { common: 3 },
      skillShards: 2,
      running: true,
      progress: 0.25,
    };
    s.purchased['auto'] = 1;
    s.purchased['dual'] = 1;
    s.purchased['dup'] = 7;

    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.credits.eq(s.credits)).toBe(true);
    expect(restored.network.eq(num(33))).toBe(true);
    expect(restored.actions['a']!.sleeveXp.eq(num(12))).toBe(true);
    expect(restored.actions['a']!.runsTowardSleeveXp).toBe(42);
    expect(restored.actions['a']!.xp.eq(num(77))).toBe(true);
    expect(restored.actions['a']!.running).toBe(true);
    expect(restored.actions['a']!.progress).toBe(0.25);
    expect(restored.purchased).toEqual({ auto: 1, dual: 1, dup: 7 });
  });

  it.each([0, 1, 2, 7, 99, '5', null])(
    'refuses a save of another format version (%j): the game starts over instead of guessing',
    (version) => {
      const json = JSON.parse(serializeState(createInitialState(config, numberFactory)));
      json.version = version;
      expect(deserializeState(JSON.stringify(json), config, numberFactory)).toBeNull();
    },
  );

  it('round-trips heat, and a save without heat loads with 0', () => {
    const s = createInitialState(config, numberFactory);
    s.heat = 13;
    s.heatCooldownMs = 42_000;
    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.heat).toBe(13);
    expect(restored.heatCooldownMs).toBe(42_000);
    const old = JSON.parse(serializeState(s));
    delete old.heat;
    delete old.heatCooldownMs;
    const legacy = deserializeState(JSON.stringify(old), config, numberFactory)!;
    expect(legacy.heat).toBe(0);
    expect(legacy.heatCooldownMs).toBe(0);
  });

  it('keeps owned global buyables across save and load', () => {
    const s = createInitialState(config, numberFactory);
    s.purchased['speed'] = 1;
    s.purchased['access'] = 1;
    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.purchased).toEqual({ speed: 1, access: 1 });
  });

  it("keeps each action's own sleeve xp in saved games", () => {
    const two = createConfig(config, { actions: [config.actions[0]!, { ...config.actions[0]!, id: 'b' }] });
    const s = createInitialState(two, numberFactory);
    s.actions['a']!.sleeveXp = num(1);
    s.actions['b']!.sleeveXp = num(2);
    const restored = deserializeState(serializeState(s), two, numberFactory)!;
    expect(restored.actions['a']!.sleeveXp.eq(num(1))).toBe(true);
    expect(restored.actions['b']!.sleeveXp.eq(num(2))).toBe(true);
  });

  it('caps stored copy counts at maxPurchases for one-time buyables', () => {
    const json = JSON.stringify({
      version: 6,
      credits: '0',
      network: '0',
      actions: {},
      purchased: { auto: 5, dual: 1, dup: 3 },
    });
    expect(deserializeState(json, config, numberFactory)!.purchased).toEqual({ auto: 1, dual: 1, dup: 3 });
  });

  it('returns null for corrupt or incompatible input', () => {
    expect(deserializeState('not json', config, numberFactory)).toBeNull();
    expect(deserializeState('{"version":999}', config, numberFactory)).toBeNull();
    expect(deserializeState('{"version":6,"credits":5}', config, numberFactory)).toBeNull();
  });

  it('ignores unknown ids and fills in missing ones', () => {
    const json = JSON.stringify({
      version: 6,
      credits: '5',
      network: '0',
      actions: { ghost: { xp: '9', sleeveXp: '0', runsTowardSleeveXp: 0, running: true, progress: 0.5 } },
      purchased: { 'ghost-buyable': 1, dual: 1 },
    });
    const s = deserializeState(json, config, numberFactory)!;
    expect(Object.keys(s.actions)).toEqual(['a']);
    expect(s.actions['a']!.xp.isZero()).toBe(true);
    expect(s.purchased).toEqual({ dual: 1 });
  });
});

describe('config helpers', () => {
  it('the test configuration is valid', () => {
    expect(validateConfig(config)).toEqual([]);
  });

  it('createConfig overrides sections field by field and leaves the base untouched', () => {
    const c = createConfig(config, { global: { speedMultiplier: 5 }, progression: { startingCredits: 100 } });
    expect(c.global.speedMultiplier).toBe(5);
    expect(c.global.costMultiplier).toBe(1);
    expect(c.progression.startingCredits).toBe(100);
    expect(c.progression.runsPerSleeveXp).toBe(100);
    expect(config.global.speedMultiplier).toBe(1);
  });

  it('startingCredits seeds a new game', () => {
    const c = createConfig(config, { progression: { startingCredits: 25 } });
    expect(createInitialState(c, numberFactory).credits.eq(num(25))).toBe(true);
  });

  it('reports every kind of invalid value', () => {
    const bad = createConfig(config, {
      actions: [
        { ...config.actions[0]!, baseDurationMs: 0, requiredAccessLevel: 0, heatPerRun: -1 },
        { ...config.actions[0]!, levels: { firstLevelXp: 0, growthFactor: 1 } },
      ],
      buyables: [
        {
          id: 'x',
          name: 'x',
          description: '',
          actionId: 'nope',
          cost: num(1),
          effect: { kind: 'autoRun' },
          requires: ['ghost', 'x'],
          maxPurchases: 0,
          costGrowth: 0.5,
        },
        { id: 'x', name: 'x', description: '', actionId: 'a', cost: num(-1), effect: { kind: 'rewardMultiplier', factor: 0.5 } },
        { id: 'g1', name: 'g', description: '', actionId: 'a', cost: num(1), effect: { kind: 'interfaceSpeed', amount: -1 } },
        { id: 'g2', name: 'g', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 0 } },
        { id: 'g3', name: 'g', description: '', cost: num(1), effect: { kind: 'autoRun' } },
      ],
      sleeve: { baseAccessLevel: 0, baseInterfaceSpeed: 0, baseHeat: -1, heatCooldownMs: 0, heatCooldownAmount: 0 },
      progression: { runsPerSleeveXp: 0, sleeveXpPerGrant: 0, startingCredits: -1 },
      speed: { actionLevel: { kind: 'linear', perLevel: 0 }, sleeveLevel: { kind: 'exponential', base: 0.5 } },
      network: { creditsPerNodePerSecond: -1 },
      global: { speedMultiplier: 0, creditMultiplier: -1, xpMultiplier: NaN, costMultiplier: 0 },
      engine: { maxBatchesPerTick: 0 },
      runtime: { stepMs: 0, maxDeltaMs: -1, autosaveMs: 0, fastForwardFactor: 1 },
    });
    const text = validateConfig(bad).join('\n');
    for (const fragment of [
      'duplicate action id',
      'baseDurationMs',
      'firstLevelXp',
      'growthFactor',
      'duplicate buyable id',
      'unknown action',
      'requires unknown buyable "ghost"',
      'cannot require itself',
      'maxPurchases',
      'costGrowth',
      'cost must be >= 0',
      'factor must be >= 1',
      'runsPerSleeveXp',
      'sleeveXpPerGrant',
      'startingCredits',
      'speed.actionLevel.perLevel',
      'speed.sleeveLevel.base',
      'global.speedMultiplier',
      'global.creditMultiplier',
      'global.xpMultiplier',
      'global.costMultiplier',
      'maxBatchesPerTick',
      'runtime.stepMs',
      'runtime.maxDeltaMs',
      'runtime.autosaveMs',
      'fastForwardFactor',
      'network.creditsPerNodePerSecond',
      'needs an actionId',
      'interface speed amount must be >= 0',
      'access level amount must be an integer >= 1',
      'sleeve.baseAccessLevel',
      'sleeve.baseInterfaceSpeed',
      'sleeve.baseHeat',
      'sleeve.heatCooldownMs',
      'sleeve.heatCooldownAmount',
      'requiredAccessLevel must be an integer >= 1',
      'heatPerRun must be >= 0',
    ]) {
      expect(text, fragment).toContain(fragment);
    }
  });
});
