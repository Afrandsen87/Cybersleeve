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
    s.interfaceSpeedBonus = NaNBig();
    expect(policy.apply(s)).toBe(true);
    expect(s.credits.isZero() && s.network.isZero() && s.interfaceSpeedBonus.isZero()).toBe(true);
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
    s.interfaceSpeedBonus = num('1e9000000000000000');
    s.nodePayoutBonus = num('1e9000000000000000');
    s.networkRemainder = Infinity;
    policy.apply(s);
    expect(s.interfaceSpeedBonus.isFinite() && s.nodePayoutBonus.isFinite()).toBe(true);
    expect(Number.isFinite(s.networkRemainder)).toBe(true);
  });

  it('reports no change for a healthy state', () => {
    expect(policy.apply(createInitialState(config, numberFactory))).toBe(false);
  });
});

describe('unbounded bonuses are BigNums', () => {
  it('a bonus far beyond the double range survives a save and does not break the interface speed', () => {
    const g = createGame({ config });
    (g.getState() as { interfaceSpeedBonus: ReturnType<typeof num> }).interfaceSpeedBonus = num('1e500');
    const speed = g.sleeveStats().interfaceSpeed;
    expect(Number.isFinite(speed)).toBe(true);
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.interfaceSpeedBonus.eq(num('1e500'))).toBe(true);
  });

  it('loads a bonus saved the old way, as a plain number', () => {
    const json = JSON.parse(serializeState(createInitialState(config, numberFactory)));
    json.interfaceSpeedBonus = 0.5;
    json.nodePayoutBonus = 'garbage-but-not-required';
    expect(deserializeState(JSON.stringify(json), config, numberFactory)).toBeNull(); // a present string must be numeric
    json.nodePayoutBonus = 0.25;
    const s = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(s.interfaceSpeedBonus.toNumber()).toBe(0.5);
    expect(s.nodePayoutBonus.toNumber()).toBe(0.25);
  });
});

describe('scalar field registry', () => {
  it('covers every scalar of the state exactly once', () => {
    const state = createInitialState(config, numberFactory);
    const nonScalar = ['unlockedActions', 'autoRunOff', 'actions', 'purchased'];
    const expected = Object.keys(state)
      .filter((k) => !nonScalar.includes(k))
      .sort();
    expect(SCALAR_FIELDS.map((f) => f.key).sort()).toEqual(expected);
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
    expect(s.infamy).toBe(6);
    expect(s.interfaceSpeedBonus.toNumber()).toBe(6);
    expect(s.nodePayoutBonus.toNumber()).toBe(6);
    expect(s.circumvention.toNumber()).toBe(7); // starts at 1
  });

  it('whole-unit rewards are rounded down per run before the runs are summed', () => {
    const s = createInitialState(config, numberFactory);
    payReward(s, 'networkNodes', num(1.9), num(10));
    expect(s.network.toNumber()).toBe(10);
  });
});
