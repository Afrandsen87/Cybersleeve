/**
 * Reward rounding has one owner (`rewards.ts`): whole-unit kinds floor each run's amount before runs are summed, the others do not.
 * `Economy.payout` (what a run shows it pays) and `payReward` (what is paid) must agree, including at the edges.
 */
import { describe, expect, it } from 'vitest';
import { num, numberFactory } from '../../numbers';
import { game } from '../../testing/gameKit';
import { Economy } from '../economy/economy';
import { testConfig } from '../../testing/testConfig';
import { DEFAULT_REWARD_KIND, REWARD_KINDS, REWARDS, payReward, wholeRunAmount } from './rewards';
import type { ActionDefinition, GameState, RewardKind } from '../types';

const economy = new Economy(testConfig, numberFactory);
const stateOf = () => game().getState() as GameState;
const defOf = (rewardKind: RewardKind): ActionDefinition => ({ ...testConfig.actions[0]!, rewardKind });

/** Amounts that exercise zero, fractions, huge values and the non-finite edges. */
const AMOUNTS = [0, 0.4, 0.999, 1, 2.75, 1e15 + 0.5, 1e300, -3.5, Number.NaN, Number.POSITIVE_INFINITY];

describe('reward rounding', () => {
  it('the default reward kind is credits and its amounts are not rounded', () => {
    expect(DEFAULT_REWARD_KIND).toBe('credits');
    expect(wholeRunAmount(undefined, num(2.75)).toNumber()).toBeCloseTo(2.75, 12);
  });

  it('whole-unit kinds floor each run, the others keep fractions', () => {
    for (const kind of REWARD_KINDS) {
      const out = wholeRunAmount(kind, num(2.75)).toNumber();
      expect(out, kind).toBeCloseTo(REWARDS[kind].wholePerRun ? 2 : 2.75, 12);
    }
  });

  it('Economy.payout and wholeRunAmount agree for every kind and edge amount', () => {
    for (const kind of REWARD_KINDS)
      for (const amount of AMOUNTS) {
        const a = economy.payout(defOf(kind), num(amount)).toNumber();
        const b = wholeRunAmount(kind, num(amount)).toNumber();
        expect(Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b)), `${kind} ${amount}`).toBe(true);
      }
  });

  it('payReward adds the rounded amount once per run, with fractional amounts per run floored first', () => {
    const state = stateOf();
    const before = state.sleeve.network.toNumber();
    payReward(state, 'networkNodes', num(2.75), num(10));
    expect(state.sleeve.network.toNumber() - before).toBe(20); // 10 runs of floor(2.75), not floor(27.5)
    const credits = state.wallet.credits.toNumber();
    payReward(state, 'credits', num(2.75), num(10));
    expect(state.wallet.credits.toNumber() - credits).toBeCloseTo(27.5, 9);
  });

  it('payReward pays nothing for zero runs or a zero amount, and never pays a negative whole amount below its floor', () => {
    const state = stateOf();
    const before = state.sleeve.network.toNumber();
    payReward(state, 'networkNodes', num(0.9), num(1000));
    payReward(state, 'networkNodes', num(5), num(0));
    expect(state.sleeve.network.toNumber()).toBe(before);
  });

  it('a huge amount stays finite or clamps rather than corrupting the balance', () => {
    const state = stateOf();
    payReward(state, 'credits', num(1e300), num(1e300));
    expect(Number.isNaN(state.wallet.credits.toNumber())).toBe(false);
  });
});
