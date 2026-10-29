/**
 * One long tick and many short ones pay the same through BOTH pay paths: the direct reward of an action's own runs, and the linked payouts
 * (Overclock's `alsoPays` and the `paysActionReward` buyable, one source list). Whole-unit rewards are floored per run, never per batch,
 * so a batch of any size pays the same as the runs one by one.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { networkAction, setCredits, testConfig } from '../../testing/testConfig';
import { type BuyableDefinition, createConfig } from '..';

const buyable = (b: Pick<BuyableDefinition, 'id' | 'effect'> & Partial<BuyableDefinition>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(1),
  ...b,
});

/** 'net' pays 1 node per second-long run and a x1.5 multiplier makes the gross 1.5: a whole-unit reward that must floor to 1 per run. */
const NET_X1_5 = buyable({ id: 'net-x1.5', actionId: 'net', effect: { kind: 'rewardMultiplier', factor: 1.5 } });
const autoOf = (actionId: string) => buyable({ id: `${actionId}-auto`, actionId, effect: { kind: 'autoRun' } });
const TAP = buyable({ id: 'tap', effect: { kind: 'paysActionReward', sourceActionId: 'a', targetActionId: 'net', chance: 1 } });
const OVERCLOCK = buyable({ id: 'oc-a', actionId: 'a', effect: { kind: 'overclockUnlock' } });

/** Passive income and heat cooling are applied per tick by design, so they are off; levels are out of reach so durations stay fixed. */
function config(extra: BuyableDefinition[], overclock?: object) {
  const base = createConfig(testConfig, {
    buyables: [...testConfig.buyables, NET_X1_5, autoOf('a'), autoOf('net'), ...extra],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
    sleeve: { heatCooldownMs: 1e15 },
  });
  const a = { ...base.actions[0]!, baseDurationMs: 1_000, ...(overclock ? { overclock } : {}) };
  return createConfig(base, { actions: [a, { ...networkAction, baseDurationMs: 1_000 }] });
}

function prepared(cfg: ReturnType<typeof config>, buys: string[], overclockOn: boolean) {
  const g = createGame({ config: cfg });
  setCredits(g, num(1e9));
  for (const id of buys) expect(g.buy(id), id).toBe('purchased');
  if (overclockOn) expect(g.toggleOverclock('a')).toBe(true);
  return g;
}

/** Plays `totalMs` of game time once, and in `steps` equal ticks on a twin, from a state with both actions auto-running. */
function twins(cfg: ReturnType<typeof config>, buys: string[], totalMs: number, steps: number, overclockOn = false) {
  const once = prepared(cfg, buys, overclockOn);
  const stepped = prepared(cfg, buys, overclockOn);
  for (const g of [once, stepped]) g.startAction('a');
  once.tick(totalMs);
  for (let i = 0; i < steps; i++) stepped.tick(totalMs / steps);
  return { once, stepped };
}

function expectSamePayout(once: ReturnType<typeof prepared>, stepped: ReturnType<typeof prepared>) {
  const a = once.getState();
  const b = stepped.getState();
  expect(a.sleeve.network.toNumber()).toBe(b.sleeve.network.toNumber());
  expect(a.wallet.credits.toNumber()).toBeCloseTo(b.wallet.credits.toNumber(), 6);
}

// An end time that is not an exact run boundary, where float rounding could tip one twin over.
const TOTAL = 200_000.5;
const STEPS = 2_000;

describe('direct reward path', () => {
  it('a network action run for 200 runs pays 200 nodes (not 300) however the time is delivered', () => {
    const cfg = config([]);
    const make = () => prepared(cfg, ['net-x1.5', 'net-auto'], false);
    const once = make();
    const stepped = make();
    once.startAction('net');
    stepped.startAction('net');
    once.tick(TOTAL);
    for (let i = 0; i < STEPS; i++) stepped.tick(TOTAL / STEPS);
    expect(once.getState().sleeve.network.toNumber()).toBe(200);
    expectSamePayout(once, stepped);
  });

  it('credits from fractional rewards add up the same in one tick or many', () => {
    const { once, stepped } = twins(config([]), ['a-auto', 'dual'], TOTAL, STEPS);
    expect(once.getState().wallet.credits.toNumber()).toBeGreaterThan(1e9);
    expectSamePayout(once, stepped);
  });
});

describe('linked payout path', () => {
  it('paysActionReward at 100%: 200 runs of the source pay 200 whole rewards of the target, in one tick or many', () => {
    const { once, stepped } = twins(config([TAP]), ['net-x1.5', 'a-auto', 'tap'], TOTAL, STEPS);
    expect(once.getState().sleeve.network.toNumber()).toBe(200);
    expectSamePayout(once, stepped);
  });

  it("Overclock's alsoPays: 200 runs of the source pay 200 whole rewards of the target, in one tick or many", () => {
    const cfg = config([OVERCLOCK], { speedBonus: 0.0001, alsoPays: 'net' });
    const { once, stepped } = twins(cfg, ['net-x1.5', 'a-auto', 'oc-a'], 100_000.5, STEPS, true);
    // the Overclock speed bonus is tiny, so close to 100 runs: the count is exact in both, and equal
    expect(once.getState().sleeve.network.toNumber()).toBeGreaterThanOrEqual(100);
    expectSamePayout(once, stepped);
  });

  it('both sources together pay each target reward once per source (two per run)', () => {
    const cfg = config([TAP, OVERCLOCK], { speedBonus: 0.0001, alsoPays: 'net' });
    const { once, stepped } = twins(cfg, ['net-x1.5', 'a-auto', 'tap', 'oc-a'], 100_000.5, STEPS, true);
    expect(once.getState().sleeve.network.toNumber()).toBeGreaterThanOrEqual(200);
    expectSamePayout(once, stepped);
  });
});
