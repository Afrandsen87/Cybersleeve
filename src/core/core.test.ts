import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../numbers';
import { testConfig } from '../testing/testConfig';
import {
  LevelRule,
  Progression,
  Shop,
  createConfig,
  createInitialState,
  createSpeedModifiers,
  deserializeState,
  effectiveDurationMs,
  heatTaxFactor,
  levelFactor,
  resolveEffects,
  resolveSleeveStats,
  serializeState,
  SPEED_FACTOR_IDS,
  speedFactors,
  speedMultiplier,
  validateConfig,
  type LevelRuleConfig,
} from './index';

const config = testConfig;
const rule = (c: LevelRuleConfig) => new LevelRule(c, numberFactory);

describe('LevelRule (default 10 / 10): every level costs its full amount on its own', () => {
  const r = rule({ firstLevelXp: 10, growthFactor: 10 });

  // Levels start at 0. Level 1 costs 10, level 2 a further 100, level 3 a further 1000, ... so the totals are 10, 110, 1110, 11110.
  it.each([
    [0, 0],
    [1, 0],
    [9, 0],
    [9.99, 0],
    [10, 1],
    [99, 1],
    [100, 1],
    [109, 1],
    [110, 2],
    [1_109, 2],
    [1_110, 3],
    [10_000, 3],
    [11_110, 4],
  ])('xp %s -> level %s', (xp, level) => {
    expect(r.levelForXp(num(xp))).toBe(level);
  });

  it('keeps working at astronomical scale', () => {
    // Total XP of n levels is 10 * (10^n - 1) / 9, about 1.1 * 10^n.
    expect(r.levelForXp(num('1e300'))).toBe(299);
    expect(r.levelForXp(num('1.12e300'))).toBe(300);
    expect(r.levelForXp(num('1e1000'))).toBe(999);
  });

  it('maps non-finite xp to the maximum level instead of crashing', () => {
    expect(r.levelForXp(num(Infinity))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('the total at which the next level is reached adds up every level before it', () => {
    expect(r.xpForNextLevel(0).eq(num(10))).toBe(true);
    expect(r.xpForNextLevel(1).eq(num(110))).toBe(true);
    expect(r.xpForNextLevel(2).eq(num(1110))).toBe(true);
  });

  it('a level costs its full amount, whatever came before', () => {
    expect(r.xpCostOfLevel(0).eq(num(10))).toBe(true);
    expect(r.xpCostOfLevel(1).eq(num(100))).toBe(true);
    expect(r.xpCostOfLevel(2).eq(num(1000))).toBe(true);
    // Going from level 2 to 3 takes a full thousand, not 900.
    expect(r.xpForNextLevel(2).sub(r.xpForNextLevel(1)).eq(num(1000))).toBe(true);
  });

  it.each([
    [0, 0],
    [5, 5],
    [10, 0],
    [55, 45],
    [109, 99],
    [110, 0],
    [660, 550],
  ])('xp %s leaves %s inside the current level (the count starts again at each level-up)', (xp, into) => {
    expect(r.xpIntoLevel(num(xp)).toNumber()).toBeCloseTo(into, 9);
  });

  it.each([
    [0, 0],
    [5, 0.5],
    [10, 0],
    [60, 0.5],
    [100, 0.9],
    [110, 0],
    [610, 0.5],
  ])('progress fraction at xp %s is %s (position within the current level)', (xp, fraction) => {
    expect(r.progressFraction(num(xp))).toBeCloseTo(fraction, 9);
  });

  it('progress fraction is 1 for non-finite xp and stays within [0, 1] at huge scale', () => {
    expect(r.progressFraction(num(Infinity))).toBe(1);
    const p = r.progressFraction(num('5e300'));
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe('LevelRule (custom thresholds)', () => {
  it('first level costs 5 XP, doubling: levels 1,2,3,4 cost 5,10,20,40, so they are reached at 5,15,35,75 in total', () => {
    const r = rule({ firstLevelXp: 5, growthFactor: 2 });
    expect(r.levelForXp(num(4.99))).toBe(0);
    expect(r.levelForXp(num(5))).toBe(1);
    expect(r.levelForXp(num(14.99))).toBe(1);
    expect(r.levelForXp(num(15))).toBe(2);
    expect(r.levelForXp(num(35))).toBe(3);
    expect(r.levelForXp(num(75))).toBe(4);
    expect(r.xpForNextLevel(0).eq(num(5))).toBe(true);
    expect(r.xpForNextLevel(2).eq(num(35))).toBe(true);
  });

  it('is exact at every boundary even when the logarithm is inexact (growth 3, first 1)', () => {
    const r = rule({ firstLevelXp: 1, growthFactor: 3 });
    for (let level = 1; level <= 30; level++) {
      const at = r.xpForNextLevel(level - 1);
      expect(r.levelForXp(at)).toBe(level);
      expect(r.levelForXp(at.mul(num(0.999999)))).toBe(level - 1);
    }
  });

  it('a gentler growth factor levels up more often', () => {
    const slow = rule({ firstLevelXp: 10, growthFactor: 10 });
    const fast = rule({ firstLevelXp: 10, growthFactor: 2 });
    expect(fast.levelForXp(num(1000))).toBeGreaterThan(slow.levelForXp(num(1000)));
  });
});

describe('speed', () => {
  const modifiers = createSpeedModifiers(config);
  const ctx = (actionLevel: number, sleeveLevel: number, interfaceSpeed = 1) => ({
    actionId: 'a',
    actionLevel,
    sleeveLevel,
    interfaceSpeed,
  });

  it('default: multiplier = action level x sleeve level', () => {
    expect(speedMultiplier(modifiers, ctx(2, 1))).toBe(6); // (1 + 2) x (1 + 1)
  });

  it('interface speed multiplies the speed by its value (0.5 halves it)', () => {
    expect(speedMultiplier(modifiers, ctx(2, 1, 0.5))).toBe(3);
    expect(effectiveDurationMs(1_000, speedMultiplier(modifiers, ctx(0, 0, 0.5)), 0.001)).toBe(2_000);
  });

  it('empty modifier list gives 1', () => {
    expect(speedMultiplier([], ctx(9, 9))).toBe(1);
  });

  it('divides the base duration by the multiplier (worked example 10/6 s)', () => {
    expect(effectiveDurationMs(10_000, speedMultiplier(modifiers, ctx(2, 1)), 0.001)).toBeCloseTo(10_000 / 6);
  });

  it('linear scaling: perLevel 0.5 gives 1 + 0.5 per level, and level 0 is worth exactly 1', () => {
    expect(levelFactor({ kind: 'linear', perLevel: 0.5 }, 0)).toBe(1);
    expect(levelFactor({ kind: 'linear', perLevel: 0.5 }, 4)).toBe(3);
  });

  it('exponential scaling: base 2 doubles per level', () => {
    expect(levelFactor({ kind: 'exponential', base: 2 }, 0)).toBe(1);
    expect(levelFactor({ kind: 'exponential', base: 2 }, 3)).toBe(8);
  });

  it('config drives the modifiers (sleeve exponential, global x3)', () => {
    const custom = createConfig(config, {
      speed: { sleeveLevel: { kind: 'exponential', base: 2 } },
      global: { speedMultiplier: 3 },
    });
    expect(speedMultiplier(createSpeedModifiers(custom), ctx(1, 3))).toBe(2 * 8 * 3);
  });

  it('a per-action scaling override wins over the global one', () => {
    const custom = createConfig(config, {
      actions: [{ ...config.actions[0]!, speedScaling: { kind: 'linear', perLevel: 10 } }],
    });
    expect(speedMultiplier(createSpeedModifiers(custom), ctx(1, 0))).toBe(11);
  });
});

describe('heatTaxFactor', () => {
  it.each([
    [0, 1],
    [13, 0.87],
    [50, 0.5],
    [100, 0],
    [250, 0],
    [-5, 1],
    [NaN, 1],
  ])('heat %s keeps %s of earned credits', (heat, kept) => {
    expect(heatTaxFactor(heat, 0, 0.01)).toBeCloseTo(kept, 10);
  });
});

describe('resolveSleeveStats', () => {
  it('reports the current heat from the state', () => {
    const stats = resolveSleeveStats(
      config.buyables,
      {
        purchased: {},
        heat: 4,
        hackingProficiency: num(0),
        network: num(0),
        iceRating: num(1),
        infamy: 0,
        nodePayoutBonus: num(0),
        inventory: {},
      },
      config.sleeve,
      numberFactory,
    );
    expect(stats.heat).toBe(4);
  });

  it('multiplies the interface speed by 1 + the bonus earned by actions (0.5 * 1.25 = 0.625)', () => {
    const stats = resolveSleeveStats(
      [],
      {
        purchased: {},
        heat: 0,
        hackingProficiency: num(0.25),
        network: num(0),
        iceRating: num(1),
        infamy: 0,
        nodePayoutBonus: num(0),
        inventory: {},
      },
      { ...config.sleeve, baseInterfaceSpeed: 0.5 },
      numberFactory,
    );
    expect(stats.interfaceSpeed).toBeCloseTo(0.625, 10);
  });

  it('a new game starts with the configured base heat', () => {
    const s = createInitialState(createConfig(config, { sleeve: { baseHeat: 6 } }), numberFactory);
    expect(s.heat).toBe(6);
    expect(s.heatCooldownMs).toBe(0);
  });
});

describe('resolveEffects', () => {
  const effects = (purchased: Record<string, number>, actionId = 'a') =>
    resolveEffects(config.buyables, { purchased }, actionId, numberFactory);

  it('has no effects when nothing is owned', () => {
    const e = effects({});
    expect(e.autoRun).toBe(false);
    expect(e.rewardMultiplier.eq(num(1))).toBe(true);
  });

  it('combines owned effects', () => {
    const e = effects({ auto: 1, dual: 1 });
    expect(e.autoRun).toBe(true);
    expect(e.rewardMultiplier.eq(num(2))).toBe(true);
  });

  it('applies a repeated effect once per copy (dual x1, dup x3 -> 2^4)', () => {
    expect(effects({ dual: 1, dup: 3 }).rewardMultiplier.eq(num(16))).toBe(true);
  });

  it('does not overflow for very many copies', () => {
    const e = effects({ dual: 1, dup: 2000 });
    expect(e.rewardMultiplier.isFinite()).toBe(true);
    expect(e.rewardMultiplier.floorLog10()).toBe(Math.floor(2001 * Math.log10(2)));
  });

  it('ignores effects targeting other actions', () => {
    const e = effects({ auto: 1 }, 'other');
    expect(e.autoRun).toBe(false);
  });
});

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
    s.actions['a'] = { xp: num(77), sleeveXp: num(12), runsTowardSleeveXp: 42, augments: { common: 3 }, running: true, progress: 0.25 };
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

  it.each([0, 1, 2, 5, 99, '4', null])(
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
      version: 4,
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
    expect(deserializeState('{"version":4,"credits":5}', config, numberFactory)).toBeNull();
  });

  it('ignores unknown ids and fills in missing ones', () => {
    const json = JSON.stringify({
      version: 4,
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

describe('speedFactors', () => {
  const mods = createSpeedModifiers(config);
  const context = { actionId: 'a', actionLevel: 3, sleeveLevel: 2, interfaceSpeed: 0.5 };

  it('lists one factor per modifier, named, in order', () => {
    const f = speedFactors(mods, context);
    expect(f.map((x) => x.id)).toEqual([
      SPEED_FACTOR_IDS.actionLevel,
      SPEED_FACTOR_IDS.sleeveLevel,
      SPEED_FACTOR_IDS.interfaceSpeed,
      SPEED_FACTOR_IDS.globalSpeed,
      SPEED_FACTOR_IDS.overclock,
      SPEED_FACTOR_IDS.focus,
    ]);
    expect(f.find((x) => x.id === SPEED_FACTOR_IDS.interfaceSpeed)!.factor).toBe(0.5);
  });

  it('the Overclock and Focus factors are 1 unless a bonus is given, and 1 + bonus when it is', () => {
    const factorOf = (c: object, id: string) => speedFactors(mods, { ...context, ...c }).find((x) => x.id === id)!.factor;
    expect(factorOf({}, SPEED_FACTOR_IDS.overclock)).toBe(1);
    expect(factorOf({}, SPEED_FACTOR_IDS.focus)).toBe(1);
    expect(factorOf({ overclockBonus: 0.5 }, SPEED_FACTOR_IDS.overclock)).toBe(1.5);
    expect(factorOf({ focusBonus: 0.25 }, SPEED_FACTOR_IDS.focus)).toBe(1.25);
  });

  it('multiplies to exactly the speed multiplier', () => {
    const product = speedFactors(mods, context).reduce((p, x) => p * x.factor, 1);
    expect(product).toBeCloseTo(speedMultiplier(mods, context), 12);
  });

  it('sanitises like the speed multiplier: NaN counts as 1, overflow saturates', () => {
    const odd = [
      { id: 'nan', factor: () => Number.NaN },
      { id: 'big', factor: () => Number.POSITIVE_INFINITY },
    ];
    expect(speedFactors(odd, context)).toEqual([
      { id: 'nan', factor: 1 },
      { id: 'big', factor: 1e308 },
    ]);
  });
});
