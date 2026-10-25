import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { seededRandom } from '../testing/random';
import { setCredits, testConfig } from '../testing/testConfig';
import { CriticalSuccesses, createConfig, criticalRuleFor, validateConfig, type BuyableDefinition, type GameConfig } from './index';

const crit = (chance: number): BuyableDefinition => ({
  id: 'crit',
  name: 'Crit',
  description: '',
  cost: num(1),
  maxPurchases: Infinity,
  effect: { kind: 'criticalChance', chance },
});

/** The test action pays 0.5 credits and 1 XP per 10 s run; action and sleeve levels are pushed out of reach so speed stays put. */
function configWith(over: { chance?: number; rule?: Partial<GameConfig['criticalSuccess']>; action?: object } = {}): GameConfig {
  const base = createConfig(testConfig, {
    buyables: [...testConfig.buyables, crit(over.chance ?? 0.05)],
    criticalSuccess: over.rule,
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
  return createConfig(base, { actions: [{ ...base.actions[0]!, ...over.action }] });
}

/** A game that owns `copies` of the critical buyable and auto-run. */
function game(config: GameConfig, copies: number, seed = 1) {
  const g = createGame({ config, random: seededRandom(seed) });
  setCredits(g, num(1_000_000));
  for (let i = 0; i < copies; i++) expect(g.buy('crit')).toBe('purchased');
  expect(g.buy('auto')).toBe('purchased');
  return g;
}

const credits = (g: ReturnType<typeof game>): number => g.getState().credits.toNumber();
const xp = (g: ReturnType<typeof game>): number => g.getState().actions['a']!.xp.toNumber();

describe('critical chance', () => {
  it('is 0 before the buyable is owned', () => {
    expect(createGame({ config: configWith() }).sleeveStats().criticalChance).toBe(0);
  });

  it('adds the chance of every copy owned', () => {
    expect(game(configWith({ chance: 0.05 }), 3).sleeveStats().criticalChance).toBeCloseTo(0.15, 12);
  });

  it('never goes above 1, however many copies are owned', () => {
    expect(game(configWith({ chance: 0.4 }), 5).sleeveStats().criticalChance).toBe(1);
  });
});

describe('critical successes', () => {
  it('without the buyable no run is critical: 0.5 credits and 1 XP per run', () => {
    const g = createGame({ config: configWith(), random: seededRandom(1) });
    setCredits(g, num(10));
    g.buy('auto');
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 * 4 + 1);
    expect(credits(g) - before).toBeCloseTo(2, 9);
    expect(xp(g)).toBe(4);
  });

  it('with chance 1 every run pays 3x and gives 2x XP', () => {
    const g = game(configWith({ chance: 1 }), 1);
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 * 4 + 1);
    expect(credits(g) - before).toBeCloseTo(4 * 0.5 * 3, 9);
    expect(xp(g)).toBe(8);
  });

  it('the multipliers come from the configuration', () => {
    const g = game(configWith({ chance: 1, rule: { xpMultiplier: 5, rewardMultiplier: 10 } }), 1);
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 + 1);
    expect(credits(g) - before).toBeCloseTo(5, 9);
    expect(xp(g)).toBe(5);
  });

  it('a critical run is not extra runs: heat and the run counter count each run once', () => {
    const g = game(configWith({ chance: 1, action: { heatPerRun: 2 } }), 1);
    g.startAction('a');
    g.tick(10_000 * 3 + 1);
    expect(g.getState().heat).toBe(6);
    expect(g.getState().actions['a']!.runsTowardSleeveXp).toBe(3);
  });

  it('a long batch splits into ordinary and critical runs that add up: credits = 0.5 x (runs + 2 x criticals), XP = runs + criticals', () => {
    const g = game(configWith({ chance: 0.5 }), 1, 7);
    const before = credits(g);
    const runs = 5_000;
    g.startAction('a');
    g.tick(10_000 * runs + 1);
    const criticals = xp(g) - runs;
    expect(criticals).toBeGreaterThan(runs * 0.45);
    expect(criticals).toBeLessThan(runs * 0.55);
    expect(credits(g) - before).toBeCloseTo(0.5 * (runs + 2 * criticals), 6);
  });

  it('an action can replace single fields of the rule: its reward x10, XP stays at the global 2x', () => {
    const g = game(configWith({ chance: 1, action: { criticalSuccess: { rewardMultiplier: 10 } } }), 1);
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 + 1);
    expect(credits(g) - before).toBeCloseTo(5, 9);
    expect(xp(g)).toBe(2);
  });

  it('an action can give a critical success its own completion effect, applied once per critical run', () => {
    const rule = { completionEffects: [{ kind: 'removeNodesFraction' as const, fraction: 0.5 }] };
    const g = game(configWith({ chance: 1, action: { criticalSuccess: rule } }), 1);
    (g.getState() as { network: unknown }).network = num(1000);
    g.startAction('a');
    g.tick(10_000 + 1);
    expect(g.getState().network.toNumber()).toBe(500);
  });

  it('stacks with a reward multiplier from a buyable: x2 and critical x3 give x6', () => {
    const g = game(configWith({ chance: 1 }), 1);
    expect(g.buy('dual')).toBe('purchased');
    const before = credits(g);
    g.startAction('a');
    g.tick(10_000 + 1);
    expect(credits(g) - before).toBeCloseTo(0.5 * 2 * 3, 9);
  });

  it('one long tick and many short ones give the same result when every run is critical', () => {
    const config = createConfig(configWith({ chance: 1 }), {
      progression: { actionLevels: { firstLevelXp: 10, growthFactor: 10 } },
      sleeve: { heatCooldownMs: 1e15 },
    });
    const once = game(config, 1);
    const stepped = game(config, 1);
    once.startAction('a');
    stepped.startAction('a');
    once.tick(200_000);
    for (let i = 0; i < 4_000; i++) stepped.tick(50);
    expect(xp(once)).toBe(xp(stepped));
    expect(once.actionLevel('a')).toBe(stepped.actionLevel('a'));
    expect(credits(once)).toBeCloseTo(credits(stepped), 6);
  });
});

describe('criticalRuleFor and CriticalSuccesses', () => {
  const base = { xpMultiplier: 2, rewardMultiplier: 3 };

  it('uses the global rule for an action without its own', () => {
    expect(criticalRuleFor(base, {})).toEqual(base);
  });

  it('lays the action fields over the global rule', () => {
    expect(criticalRuleFor(base, { criticalSuccess: { xpMultiplier: 9 } })).toEqual({ xpMultiplier: 9, rewardMultiplier: 3 });
  });

  it('draws no random number while the chance is 0', () => {
    let draws = 0;
    const roll = new CriticalSuccesses({ criticalChance: () => 0 }, () => {
      draws++;
      return 0.5;
    }).roll(100);
    expect(roll).toBe(0);
    expect(draws).toBe(0);
  });

  it('every run is critical at chance 1, and the count never exceeds the runs', () => {
    expect(new CriticalSuccesses({ criticalChance: () => 1 }, seededRandom(1)).roll(37)).toBe(37);
    const half = new CriticalSuccesses({ criticalChance: () => 0.5 }, seededRandom(2));
    for (let i = 0; i < 50; i++) expect(half.roll(10)).toBeLessThanOrEqual(10);
  });
});

describe('critical configuration is validated', () => {
  const problems = (config: GameConfig): string => validateConfig(config).join('\n');

  it('accepts the test configuration with the buyable', () => {
    expect(validateConfig(configWith())).toEqual([]);
  });

  it.each([0, -0.1, 1.5, NaN, Infinity])('rejects a chance of %s', (chance) => {
    expect(problems(configWith({ chance }))).toContain('criticalChance chance must be in (0, 1]');
  });

  it.each([{ xpMultiplier: 0.5 }, { rewardMultiplier: NaN }])('rejects the global rule %j', (rule) => {
    expect(problems(configWith({ rule }))).toContain('criticalSuccess.');
  });

  it('rejects an action rule with a multiplier below 1', () => {
    expect(problems(configWith({ action: { criticalSuccess: { rewardMultiplier: 0 } } }))).toContain(
      'action "a".criticalSuccess.rewardMultiplier',
    );
  });
});
