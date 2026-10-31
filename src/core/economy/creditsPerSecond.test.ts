/**
 * Economy owns one passive income total for queries and payments.
 * Called by: Vitest. Calls: networkIncomeFixture, NetworkSystem, GameEngine.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { networkIncomeFixture } from '../../testing/networkIncomeKit';

describe('total passive credits per second', () => {
  it('is zero with no nodes or synthetic sleeves', () => {
    const { engine, network } = networkIncomeFixture();
    expect(network.creditsPerSecond().isZero()).toBe(true);
    expect(engine.creditsPerSecond().isZero()).toBe(true);
  });

  it('equals the taxed network income when only nodes exist', () => {
    const { engine, network, state } = networkIncomeFixture(100);
    state.sleeve.heat = 25;
    expect(network.creditsPerSecond().eq(engine.passiveCreditsPerSecond())).toBe(true);
    expect(engine.creditsPerSecond().eq(network.creditsPerSecond())).toBe(true);
  });

  it('adds synthetic income without taxing it', () => {
    const { engine, network, state } = networkIncomeFixture(100, 7);
    state.sleeve.heat = 50;
    expect(network.creditsPerSecond().eq(engine.passiveCreditsPerSecond().add(num(7)))).toBe(true);
  });

  it.each([0, 100])('pays exactly the queried one-second total with %s nodes', (nodes) => {
    const { engine, network, state } = networkIncomeFixture(nodes, 7);
    state.sleeve.heat = 25;
    const before = state.wallet.credits;
    const rate = network.creditsPerSecond();
    network.payPassiveIncome(1000);
    expect(state.wallet.credits.sub(before).eq(rate)).toBe(true);
    expect(state.sleeve.peakNetworkIncome.eq(engine.passiveCreditsPerSecond())).toBe(true);
  });
});
