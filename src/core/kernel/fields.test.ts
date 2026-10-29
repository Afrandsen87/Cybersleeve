import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { testConfig } from '../../testing/testConfig';
import {
  REWARD_KINDS,
  SCALAR_FIELDS,
  createClampOverflowPolicy,
  createInitialState,
  deserializeState,
  payReward,
  CARRIED_OVER_ACTION_FIELDS,
  CARRIED_OVER_WALLET_FIELDS,
  resetForResleeve,
  serializeState,
} from '..';
import { flat } from '../../testing/flatState';
import { asSave, flatSave } from '../../testing/saveKit';

const config = testConfig;
const NaNBig = () => num(NaN);

describe('overflow policy: NaN is a bug, not a windfall', () => {
  const policy = createClampOverflowPolicy(numberFactory);

  it('NaN amounts become 0, never the largest value', () => {
    const s = createInitialState(config, numberFactory);
    s.wallet.credits = NaNBig();
    s.sleeve.network = NaNBig();
    s.sleeve.hackingProficiency = NaNBig();
    expect(policy.apply(s)).toBe(true);
    expect(s.wallet.credits.isZero() && s.sleeve.network.isZero() && s.sleeve.hackingProficiency.isZero()).toBe(true);
  });

  it('NaN action XP becomes 0', () => {
    const s = createInitialState(config, numberFactory);
    const id = Object.keys(s.sleeve.actions)[0]!;
    s.sleeve.actions[id]!.xp = NaNBig();
    policy.apply(s);
    expect(s.sleeve.actions[id]!.xp.isZero()).toBe(true);
  });

  it('overflowing bonuses are clamped to a finite value like every other amount', () => {
    const s = createInitialState(config, numberFactory);
    s.sleeve.hackingProficiency = num('1e9000000000000000');
    s.sleeve.nodePayoutBonus = num('1e9000000000000000');
    s.sleeve.networkRemainder = Infinity;
    policy.apply(s);
    expect(s.sleeve.hackingProficiency.isFinite() && s.sleeve.nodePayoutBonus.isFinite()).toBe(true);
    expect(Number.isFinite(s.sleeve.networkRemainder)).toBe(true);
  });

  it('reports no change for a healthy state', () => {
    expect(policy.apply(createInitialState(config, numberFactory))).toBe(false);
  });
});

describe('unbounded bonuses are BigNums', () => {
  it('a bonus far beyond the double range survives a save and does not break the interface speed', () => {
    const g = createGame({ config });
    (g.getState() as unknown as { sleeve: { hackingProficiency: ReturnType<typeof num> } }).sleeve.hackingProficiency = num('1e500');
    const speed = g.sleeveStats().interfaceSpeed;
    expect(Number.isFinite(speed)).toBe(true);
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.sleeve.hackingProficiency.eq(num('1e500'))).toBe(true);
  });

  it('an optional amount that is not a numeric string keeps its fresh value, and a present bad string rejects the save', () => {
    const json = flatSave(serializeState(createInitialState(config, numberFactory)));
    json.nodePayoutBonus = 'garbage-but-not-required';
    expect(deserializeState(asSave(json), config, numberFactory)).toBeNull(); // a present string must be numeric
    json.nodePayoutBonus = 0.25; // amounts are always stored as strings
    json.hackingProficiency = { not: 'a number' };
    const s = deserializeState(asSave(json), config, numberFactory)!;
    expect(s.sleeve.nodePayoutBonus.toNumber()).toBe(0);
    expect(s.sleeve.hackingProficiency.toNumber()).toBe(0);
  });
});

describe('scalar field registry', () => {
  it('covers every scalar of the state exactly once', () => {
    const state = createInitialState(config, numberFactory);
    const nonScalar = [
      'autoRunOff',
      'overclocked',
      'focused',
      'focusStacks',
      'lastLifePurchases',
      'keyToggles',
      'chains',
      'bankedCriticals',
      'automation',
      'actions',
      'purchased',
      'inventory',
      'runs',
      'synths',
      'corporation',
    ];
    for (const f of SCALAR_FIELDS) expect(f.key in state[f.owner], `${f.key} lives in ${f.owner}`).toBe(true);
    const expected = [...Object.keys(state.wallet), ...Object.keys(state.sleeve)].filter((k) => !nonScalar.includes(k)).sort();
    expect(SCALAR_FIELDS.map((f) => f.key).sort()).toEqual(expected);
  });

  it('the positive list of what a re-sleeve carries over is exactly the sleeve XP and its run counter', () => {
    expect([...CARRIED_OVER_ACTION_FIELDS]).toEqual(['sleeveXp', 'runsTowardSleeveXp']);
  });

  it('everything outside the positive list resets, whatever it is', () => {
    const g = createGame({ config });
    const id = config.actions[0]!.id;
    const s = flat<Record<string, unknown>>(g);
    for (const f of SCALAR_FIELDS) s[f.key] = f.kind === 'big' ? num(7) : 7;
    Object.assign(g.getState().sleeve.actions[id]!, { xp: num(9), sleeveXp: num(5), runsTowardSleeveXp: 3, running: true, progress: 0.5 });
    Object.assign(s, { purchased: { x: 1 }, autoRunOff: { x: true }, inventory: { i: { r: 4 } } });
    resetForResleeve(g.getState() as never, config, numberFactory);
    const fresh = createInitialState(config, numberFactory);
    const action = g.getState().sleeve.actions[id]!;
    expect(action.sleeveXp.toNumber()).toBe(5);
    expect(action.runsTowardSleeveXp).toBe(3);
    expect(action.xp.isZero()).toBe(true);
    expect(action.running).toBe(false);
    expect(action.progress).toBe(0);
    expect(g.getState().sleeve.purchased).toEqual(fresh.sleeve.purchased);
    expect(g.getState().sleeve.autoRunOff).toEqual(fresh.sleeve.autoRunOff);
    expect(g.getState().wallet.inventory).toEqual(fresh.wallet.inventory);
  });

  it('a re-sleeve resets every scalar to its initial value and keeps only sleeve progress', () => {
    const g = createGame({ config });
    const s = flat<Record<string, unknown>>(g);
    for (const f of SCALAR_FIELDS) s[f.key] = f.kind === 'big' ? num(7) : 7;
    const id = config.actions[0]!.id;
    (g.getState().sleeve.actions[id] as { sleeveXp: unknown }).sleeveXp = num(5);
    resetForResleeve(g.getState() as never, config, numberFactory);
    const fresh = createInitialState(config, numberFactory);
    for (const f of SCALAR_FIELDS) {
      const now = s[f.key];
      // the all-time peaks are statistics: the wallet list keeps them through a re-sleeve
      const want = (CARRIED_OVER_WALLET_FIELDS as readonly string[]).includes(f.key)
        ? (s[f.key] as unknown)
        : (fresh[f.owner] as unknown as Record<string, unknown>)[f.key];
      expect(f.kind === 'big' ? (now as ReturnType<typeof num>).eq(want as ReturnType<typeof num>) : now === want, f.key).toBe(true);
    }
    expect(g.getState().sleeve.actions[id]!.sleeveXp.toNumber()).toBe(5);
  });

  it('every reward kind except credits has a payout target', () => {
    const s = createInitialState(config, numberFactory);
    for (const kind of REWARD_KINDS) {
      if (kind === 'credits') continue;
      payReward(s, kind, num(2), num(3));
    }
    expect(s.sleeve.network.toNumber()).toBe(6);
    expect(s.sleeve.legend).toBe(6);
    expect(s.sleeve.hackingProficiency.toNumber()).toBe(6);
    expect(s.sleeve.nodePayoutBonus.toNumber()).toBe(6);
    expect(s.sleeve.iceRating.toNumber()).toBe(7); // starts at 1
  });

  it('whole-unit rewards are rounded down per run before the runs are summed', () => {
    const s = createInitialState(config, numberFactory);
    payReward(s, 'networkNodes', num(1.9), num(10));
    expect(s.sleeve.network.toNumber()).toBe(10);
  });
});
