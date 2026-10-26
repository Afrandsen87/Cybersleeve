import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { testConfig } from '../testing/testConfig';
import {
  REWARD_KINDS,
  SCALAR_FIELDS,
  createClampOverflowPolicy,
  createInitialState,
  deserializeState,
  payReward,
  CARRIED_OVER_ACTION_FIELDS,
  resetForResleeve,
  serializeState,
} from './index';

const config = testConfig;
const NaNBig = () => num(NaN);

describe('overflow policy: NaN is a bug, not a windfall', () => {
  const policy = createClampOverflowPolicy(numberFactory);

  it('NaN amounts become 0, never the largest value', () => {
    const s = createInitialState(config, numberFactory);
    s.credits = NaNBig();
    s.network = NaNBig();
    s.hackingProficiency = NaNBig();
    expect(policy.apply(s)).toBe(true);
    expect(s.credits.isZero() && s.network.isZero() && s.hackingProficiency.isZero()).toBe(true);
  });

  it('NaN action XP becomes 0', () => {
    const s = createInitialState(config, numberFactory);
    const id = Object.keys(s.actions)[0]!;
    s.actions[id]!.xp = NaNBig();
    policy.apply(s);
    expect(s.actions[id]!.xp.isZero()).toBe(true);
  });

  it('overflowing bonuses are clamped to a finite value like every other amount', () => {
    const s = createInitialState(config, numberFactory);
    s.hackingProficiency = num('1e9000000000000000');
    s.nodePayoutBonus = num('1e9000000000000000');
    s.networkRemainder = Infinity;
    policy.apply(s);
    expect(s.hackingProficiency.isFinite() && s.nodePayoutBonus.isFinite()).toBe(true);
    expect(Number.isFinite(s.networkRemainder)).toBe(true);
  });

  it('reports no change for a healthy state', () => {
    expect(policy.apply(createInitialState(config, numberFactory))).toBe(false);
  });
});

describe('unbounded bonuses are BigNums', () => {
  it('a bonus far beyond the double range survives a save and does not break the interface speed', () => {
    const g = createGame({ config });
    (g.getState() as { hackingProficiency: ReturnType<typeof num> }).hackingProficiency = num('1e500');
    const speed = g.sleeveStats().interfaceSpeed;
    expect(Number.isFinite(speed)).toBe(true);
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.hackingProficiency.eq(num('1e500'))).toBe(true);
  });

  it('an optional amount that is not a numeric string keeps its fresh value, and a present bad string rejects the save', () => {
    const json = JSON.parse(serializeState(createInitialState(config, numberFactory)));
    json.nodePayoutBonus = 'garbage-but-not-required';
    expect(deserializeState(JSON.stringify(json), config, numberFactory)).toBeNull(); // a present string must be numeric
    json.nodePayoutBonus = 0.25; // amounts are always stored as strings
    json.hackingProficiency = { not: 'a number' };
    const s = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(s.nodePayoutBonus.toNumber()).toBe(0);
    expect(s.hackingProficiency.toNumber()).toBe(0);
  });
});

describe('scalar field registry', () => {
  it('covers every scalar of the state exactly once', () => {
    const state = createInitialState(config, numberFactory);
    const nonScalar = [
      'autoRunOff',
      'overclocked',
      'focused',
      'zeroDaysOn',
      'adminKeysOn',
      'chains',
      'bankedCriticals',
      'automation',
      'actions',
      'purchased',
      'inventory',
    ];
    const expected = Object.keys(state)
      .filter((k) => !nonScalar.includes(k))
      .sort();
    expect(SCALAR_FIELDS.map((f) => f.key).sort()).toEqual(expected);
  });

  it('the positive list of what a re-sleeve carries over is exactly the sleeve XP and its run counter', () => {
    expect([...CARRIED_OVER_ACTION_FIELDS]).toEqual(['sleeveXp', 'runsTowardSleeveXp']);
  });

  it('everything outside the positive list resets, whatever it is', () => {
    const g = createGame({ config });
    const id = config.actions[0]!.id;
    const s = g.getState() as unknown as Record<string, unknown>;
    for (const f of SCALAR_FIELDS) s[f.key] = f.kind === 'big' ? num(7) : 7;
    Object.assign(g.getState().actions[id]!, { xp: num(9), sleeveXp: num(5), runsTowardSleeveXp: 3, running: true, progress: 0.5 });
    Object.assign(s, { purchased: { x: 1 }, autoRunOff: { x: true }, inventory: { i: { r: 4 } } });
    resetForResleeve(g.getState() as never, config, numberFactory);
    const fresh = createInitialState(config, numberFactory);
    const action = g.getState().actions[id]!;
    expect(action.sleeveXp.toNumber()).toBe(5);
    expect(action.runsTowardSleeveXp).toBe(3);
    expect(action.xp.isZero()).toBe(true);
    expect(action.running).toBe(false);
    expect(action.progress).toBe(0);
    expect(g.getState().purchased).toEqual(fresh.purchased);
    expect(g.getState().autoRunOff).toEqual(fresh.autoRunOff);
    expect(g.getState().inventory).toEqual(fresh.inventory);
  });

  it('a re-sleeve resets every scalar to its initial value and keeps only sleeve progress', () => {
    const g = createGame({ config });
    const s = g.getState() as unknown as Record<string, unknown>;
    for (const f of SCALAR_FIELDS) s[f.key] = f.kind === 'big' ? num(7) : 7;
    const id = config.actions[0]!.id;
    (g.getState().actions[id] as { sleeveXp: unknown }).sleeveXp = num(5);
    resetForResleeve(g.getState() as never, config, numberFactory);
    const fresh = createInitialState(config, numberFactory) as unknown as Record<string, unknown>;
    for (const f of SCALAR_FIELDS) {
      const now = s[f.key];
      const want = fresh[f.key];
      expect(f.kind === 'big' ? (now as ReturnType<typeof num>).eq(want as ReturnType<typeof num>) : now === want, f.key).toBe(true);
    }
    expect(g.getState().actions[id]!.sleeveXp.toNumber()).toBe(5);
  });

  it('every reward kind except credits has a payout target', () => {
    const s = createInitialState(config, numberFactory);
    for (const kind of REWARD_KINDS) {
      if (kind === 'credits') continue;
      payReward(s, kind, num(2), num(3));
    }
    expect(s.network.toNumber()).toBe(6);
    expect(s.legend).toBe(6);
    expect(s.hackingProficiency.toNumber()).toBe(6);
    expect(s.nodePayoutBonus.toNumber()).toBe(6);
    expect(s.iceRating.toNumber()).toBe(7); // starts at 1
  });

  it('whole-unit rewards are rounded down per run before the runs are summed', () => {
    const s = createInitialState(config, numberFactory);
    payReward(s, 'networkNodes', num(1.9), num(10));
    expect(s.network.toNumber()).toBe(10);
  });
});
