import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../numbers';
import { malwareAction, networkAction, testConfig } from '../testing/testConfig';
import { createGame } from '../app/createGame';
import {
  Economy,
  Progression,
  coolHeat,
  createClampOverflowPolicy,
  createConfig,
  createInitialState,
  deserializeState,
  heatTaxFactor,
  validateConfig,
} from './index';

const config = testConfig;
const load = (data: object) =>
  deserializeState(JSON.stringify({ version: 3, credits: '0', network: '0', actions: {}, purchased: {}, ...data }), config, numberFactory);

describe('loading a save sanitises it', () => {
  it('turns negative amounts into 0', () => {
    const s = load({
      credits: '-50',
      network: '-1',
      actions: { a: { xp: '-3', sleeveXp: '-9', runsTowardSleeveXp: 0, running: false, progressMs: 0 } },
    })!;
    expect(s.credits.isZero()).toBe(true);
    expect(s.network.isZero()).toBe(true);
    expect(s.actions['a']!.xp.isZero()).toBe(true);
    expect(s.actions['a']!.sleeveXp.isZero()).toBe(true);
  });

  it('drops non-finite times and keeps the run counter below runsPerSleeveXp', () => {
    const s = load({ actions: { a: { xp: '0', sleeveXp: '0', runsTowardSleeveXp: 250, running: true, progressMs: 'Infinity' } } })!;
    expect(s.actions['a']!.progressMs).toBe(0);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(50); // 250 mod 100
  });

  it('discards a buyable whose requirements are not owned, however the save got there', () => {
    expect(load({ purchased: { dup: 4 } })!.purchased).toEqual({});
    expect(load({ purchased: { dual: 1, dup: 4 } })!.purchased).toEqual({ dual: 1, dup: 4 });
  });

  it('caps absurd copy counts of an unlimited buyable at a safe integer', () => {
    const s = load({ purchased: { dual: 1, dup: 1e300 } })!;
    expect(s.purchased['dup']).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects a save with a non-finite amount outright', () => {
    expect(load({ credits: '1e9000000000000000' })).toBeNull();
  });
});

describe('validateConfig - extra checks', () => {
  const problems = (overrides: object) => validateConfig(createConfig(config, overrides)).join('\n');

  it('rejects an empty action list', () => {
    expect(problems({ actions: [], buyables: [] })).toContain('at least one action');
  });

  it('rejects a requirement cycle, which could never be unlocked', () => {
    const buyables = [
      { id: 'x', name: 'x', description: '', actionId: 'a', cost: num(1), effect: { kind: 'autoRun' as const }, requires: ['y'] },
      { id: 'y', name: 'y', description: '', actionId: 'a', cost: num(1), effect: { kind: 'autoRun' as const }, requires: ['x'] },
      { id: 'z', name: 'z', description: '', actionId: 'a', cost: num(1), effect: { kind: 'autoRun' as const }, requires: ['x'] },
    ];
    const text = problems({ buyables });
    expect(text).toContain('buyable "x": its requirements form a cycle');
    expect(text).toContain('buyable "y": its requirements form a cycle');
    expect(text).not.toContain('buyable "z": its requirements form a cycle'); // blocked by the cycle, but not part of it
  });

  it('accepts a requirement chain without a cycle', () => {
    expect(problems({})).toBe('');
  });

  it('rejects a network action that pays nodes per node (the network would compound)', () => {
    const bad = { ...networkAction, rewardPerNetworkNode: true };
    expect(problems({ actions: [bad], buyables: [] })).toContain('would compound');
  });

  it('rejects a negative reward and negative cost', () => {
    const text = problems({
      actions: [{ ...testConfig.actions[0]!, reward: num(-1), xpPerRun: num(-1) }],
      buyables: [{ id: 'x', name: 'x', description: '', cost: num(-5), effect: { kind: 'accessLevel' as const, level: 2 } }],
    });
    expect(text).toContain('reward must be >= 0');
    expect(text).toContain('xpPerRun must be >= 0');
    expect(text).toContain('cost must be >= 0');
  });
});

describe('Economy.creditsForRuns (closed form)', () => {
  const economy = new Economy(config, numberFactory);
  const gross = num(10);
  /** Reference: pay run by run, raising the tax after each. */
  const sequential = (runs: number, heat: number, perRun: number): number => {
    let total = 0;
    for (let i = 0; i < runs; i++) {
      total += 10 * heatTaxFactor(heat);
      heat += perRun;
    }
    return total;
  };

  it.each([
    [1, 0, 1],
    [50, 0, 1],
    [99, 0, 1],
    [100, 0, 1],
    [101, 0, 1],
    [5000, 0, 1],
    [10, 13, 1],
    [10, 13, 2.5],
    [40, 90, 0.5],
    [3, 0, 40],
  ])('matches paying %i runs one by one (starting heat %f, +%f heat per run)', (runs, heat, perRun) => {
    expect(economy.creditsForRuns(gross, runs, heat, perRun).toNumber()).toBeCloseTo(sequential(runs, heat, perRun), 6);
  });

  it('without heat per run it is runs times the taxed payout; at 100 heat or more nothing is paid', () => {
    expect(economy.creditsForRuns(gross, 7, 0, 0).toNumber()).toBeCloseTo(70, 9);
    expect(economy.creditsForRuns(gross, 7, 25, 0).toNumber()).toBeCloseTo(52.5, 9);
    expect(economy.creditsForRuns(gross, 7, 100, 0).isZero()).toBe(true);
    expect(economy.creditsForRuns(gross, 7, 120, 1).isZero()).toBe(true);
  });

  it('pays nothing for zero or negative runs, and cost does not grow with the run count', () => {
    expect(economy.creditsForRuns(gross, 0, 0, 1).isZero()).toBe(true);
    expect(economy.creditsForRuns(gross, -3, 0, 1).isZero()).toBe(true);
    expect(economy.creditsForRuns(gross, 1e15, 0, 1).isFinite()).toBe(true);
  });
});

describe('coolHeat', () => {
  const cool = (heat: number, cooldownMs: number, delta: number) => coolHeat({ heat, cooldownMs }, delta, 60_000, 1);

  it('removes 1 heat per full cycle and keeps the partial progress', () => {
    expect(cool(5, 0, 150_000)).toEqual({ heat: 3, cooldownMs: 30_000 });
  });

  it('stops at 0 and resets the cycle', () => {
    expect(cool(2, 30_000, 10_000_000)).toEqual({ heat: 0, cooldownMs: 0 });
  });

  it('does nothing while there is no heat', () => {
    expect(cool(0, 0, 1_000_000)).toEqual({ heat: 0, cooldownMs: 0 });
  });
});

describe('overflow policy', () => {
  const policy = createClampOverflowPolicy(numberFactory);
  const max = numberFactory.maxValue();

  it('leaves a healthy state alone', () => {
    const s = createInitialState(config, numberFactory);
    s.credits = num('1e5000');
    expect(policy.apply(s)).toBe(false);
    expect(s.credits.eq(num('1e5000'))).toBe(true);
  });

  it('clamps overflowing amounts to the largest finite value and negative non-finite ones to zero', () => {
    const s = createInitialState(config, numberFactory);
    s.credits = num(Infinity);
    s.network = num('-1e9000000000000000');
    s.actions['a']!.xp = num('1e9000000000000000');
    expect(policy.apply(s)).toBe(true);
    expect(s.credits.eq(max)).toBe(true);
    expect(s.network.isZero()).toBe(true);
    expect(s.actions['a']!.xp.eq(max)).toBe(true);
    expect(s.credits.isFinite()).toBe(true);
  });

  it('clamps non-finite heat (NaN becomes 0)', () => {
    const s = createInitialState(config, numberFactory);
    s.heat = Infinity;
    policy.apply(s);
    expect(s.heat).toBe(Number.MAX_SAFE_INTEGER);
    s.heat = NaN;
    policy.apply(s);
    expect(s.heat).toBe(0);
  });

  it('the engine applies it every tick: credits that overflow stay valid and saveable', () => {
    const g = createGame({ config: createConfig(testConfig, { actions: [testConfig.actions[0]!, networkAction, malwareAction] }) });
    (g.getState() as { credits: unknown }).credits = max;
    (g.getState() as { network: unknown }).network = num('1e300');
    g.tick(1e9); // passive income of 1e300 nodes pushes credits past the limit
    expect(g.getState().credits.isFinite()).toBe(true);
    expect(g.getState().credits.eq(max)).toBe(true);
  });
});

describe('Progression.runsBeforeLevelChange', () => {
  const progression = new Progression(config, numberFactory);

  it('is the number of runs until the action level threshold, the last run being the one that crosses it', () => {
    const s = createInitialState(config, numberFactory);
    expect(progression.runsBeforeLevelChange(s, 'a', num(1), num(1))).toBe(10); // level 2 at 10 XP
    s.actions['a']!.xp = num(4);
    expect(progression.runsBeforeLevelChange(s, 'a', num(1), num(1))).toBe(6);
  });

  it('never returns a count that overshoots: a partial run count rounds down, and the result is at least 1', () => {
    const s = createInitialState(config, numberFactory);
    s.actions['a']!.xp = num(4);
    expect(progression.runsBeforeLevelChange(s, 'a', num(2.5), num(1))).toBe(2); // 4 + 2 * 2.5 = 9, still below 10
    s.actions['a']!.xp = num(9.5);
    expect(progression.runsBeforeLevelChange(s, 'a', num(3), num(1))).toBe(1);
  });

  it('is limited by the sleeve level when that comes first (counted runs, not XP)', () => {
    const s = createInitialState(config, numberFactory);
    // Sleeve level 2 needs 10 sleeve XP = 1000 counted runs; with 1 XP per run the action level (10 runs) comes first.
    expect(progression.runsBeforeLevelChange(s, 'a', num(0), num(1))).toBe(1000);
    s.actions['a']!.runsTowardSleeveXp = 40;
    expect(progression.runsBeforeLevelChange(s, 'a', num(0), num(8))).toBe(120); // (1000 - 40) / 8
  });

  it('is unbounded when neither track can ever change', () => {
    const s = createInitialState(config, numberFactory);
    expect(progression.runsBeforeLevelChange(s, 'a', num(0), num(0))).toBe(Infinity);
  });
});
