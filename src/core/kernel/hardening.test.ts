import { describe, expect, it, vi } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { malwareAction, networkAction, testConfig } from '../../testing/testConfig';
import { createGame } from '../../app/createGame';
import { Progression, coolHeat, createClampOverflowPolicy, createConfig, createInitialState, deserializeState, validateConfig } from '..';

const config = testConfig;
const load = (data: object) =>
  deserializeState(JSON.stringify({ version: 6, credits: '0', network: '0', actions: {}, purchased: {}, ...data }), config, numberFactory);

describe('loading a save sanitises it', () => {
  it('turns negative amounts into 0', () => {
    const s = load({
      credits: '-50',
      network: '-1',
      actions: { a: { xp: '-3', sleeveXp: '-9', runsTowardSleeveXp: 0, running: false, progress: 0 } },
    })!;
    expect(s.credits.isZero()).toBe(true);
    expect(s.network.isZero()).toBe(true);
    expect(s.actions['a']!.xp.isZero()).toBe(true);
    expect(s.actions['a']!.sleeveXp.isZero()).toBe(true);
  });

  it('drops non-finite times and keeps the run counter below runsPerSleeveXp', () => {
    const s = load({ actions: { a: { xp: '0', sleeveXp: '0', runsTowardSleeveXp: 250, running: true, progress: 'Infinity' } } })!;
    expect(s.actions['a']!.progress).toBe(0);
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
      buyables: [{ id: 'x', name: 'x', description: '', cost: num(-5), effect: { kind: 'accessLevel' as const, amount: 1 } }],
    });
    expect(text).toContain('reward must be >= 0');
    expect(text).toContain('xpPerRun must be >= 0');
    expect(text).toContain('cost must be >= 0');
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
  const max = num(1e308);

  it('leaves a healthy state alone', () => {
    const s = createInitialState(config, numberFactory);
    s.credits = num('1e300');
    expect(policy.apply(s)).toBe(false);
    expect(s.credits.eq(num('1e300'))).toBe(true);
  });

  it('clamps overflowing amounts to the game infinity (1e308) and negative non-finite ones to zero', () => {
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

  it('clamps an amount above 1e308 to 1e308 and tells the listener, once per application, only when infinity is reached', () => {
    const reached = vi.fn();
    const listening = createClampOverflowPolicy(numberFactory, reached);
    const s = createInitialState(config, numberFactory);
    s.credits = num('1e307');
    expect(listening.apply(s)).toBe(false);
    expect(reached).not.toHaveBeenCalled();
    s.credits = num('1e500');
    s.actions['a']!.sleeveXp = num('1e400');
    expect(listening.apply(s)).toBe(true);
    expect(s.credits.eq(max)).toBe(true);
    expect(s.actions['a']!.sleeveXp.eq(max)).toBe(true);
    expect(reached).toHaveBeenCalledTimes(1);
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
    expect(progression.runsBeforeLevelChange(s, 'a', num(1))).toBe(10); // level 2 at 10 XP
    s.actions['a']!.xp = num(4);
    expect(progression.runsBeforeLevelChange(s, 'a', num(1))).toBe(6);
  });

  it('never returns a count that overshoots: a partial run count rounds down, and the result is at least 1', () => {
    const s = createInitialState(config, numberFactory);
    s.actions['a']!.xp = num(4);
    expect(progression.runsBeforeLevelChange(s, 'a', num(2.5))).toBe(2); // 4 + 2 * 2.5 = 9, still below 10
    s.actions['a']!.xp = num(9.5);
    expect(progression.runsBeforeLevelChange(s, 'a', num(3))).toBe(1);
  });

  it('is limited by the sleeve level when that comes first (runs, not XP)', () => {
    const s = createInitialState(config, numberFactory);
    // Sleeve level 2 needs 10 sleeve XP = 1000 runs; with 1 XP per run the action level (10 runs) comes first.
    expect(progression.runsBeforeLevelChange(s, 'a', num(0))).toBe(1000);
    s.actions['a']!.runsTowardSleeveXp = 40;
    expect(progression.runsBeforeLevelChange(s, 'a', num(0))).toBe(960); // 1000 - 40
  });

  it('is never unbounded: even an action that earns no XP reaches its next sleeve level by counting runs', () => {
    const s = createInitialState(config, numberFactory);
    expect(Number.isFinite(progression.runsBeforeLevelChange(s, 'a', num(0)))).toBe(true);
  });
});
