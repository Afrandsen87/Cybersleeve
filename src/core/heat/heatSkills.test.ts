/**
 * The anonymity skills that shape heat, as effects: Quiet Hours, Undercover, Deep Cover and Blackout (Scorched Earth is in
 * `burnLeadsFlat.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, validateConfig, type BuyableDefinition, type GameConfig } from '..';

const buyable = (id: string, effect: BuyableDefinition['effect']): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  cost: num(1),
  effect,
});

/** An action that runs for ages, so it is "in progress" for the whole test, with a tiny Overclock heat so heat stays readable. */
const long = {
  id: 'long',
  name: 'Long',
  baseDurationMs: 1e9,
  reward: num(0),
  xpPerRun: num(1),
  overclock: { speedBonus: 0.5, heatPerMinute: 1e-9 },
};
const unlockOverclock = (): BuyableDefinition => ({ ...buyable('oc', { kind: 'overclockUnlock' }), actionId: 'long' });

function game(skills: BuyableDefinition[]) {
  const config: GameConfig = createConfig(testConfig, {
    actions: [...testConfig.actions, long],
    buyables: [...testConfig.buyables, unlockOverclock(), ...skills],
  });
  const g = createGame({ config });
  setCredits(g, num(1e6));
  for (const s of [unlockOverclock(), ...skills]) expect(g.buy(s.id)).toBe('purchased');
  return g;
}
const setHeat = (g: ReturnType<typeof game>, heat: number): void => {
  (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = heat;
};
const setMoles = (g: ReturnType<typeof game>, moles: number): void => {
  (g.getState() as unknown as { sleeve: { moles: number } }).sleeve.moles = moles;
};

const quiet = buyable('quiet', { kind: 'idleHeatCooldown', factor: 5 });
const undercover = buyable('under', { kind: 'idleHeatCooldownAction', actionId: 'long' });

describe('Quiet Hours', () => {
  it('heat cools 5 times as fast while no action is in progress', () => {
    const g = game([quiet]);
    setHeat(g, 20);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBe(15);
  });

  it('heat cools at the normal pace while an action is running', () => {
    const g = game([quiet]);
    g.startAction('long');
    setHeat(g, 20);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBe(19);
  });

  it('a manual action that has finished its run and waits does not count as in progress', () => {
    const g = game([quiet]);
    g.startAction('a');
    g.tick(10_000); // the run completes; the manual action stops and waits
    expect(g.getState().sleeve.actions['a']!.running).toBe(false);
    setHeat(g, 20);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBe(15);
  });

  it('one long tick and many short ones cool the same', () => {
    const run = (slice: number) => {
      const g = game([quiet]);
      setHeat(g, 40);
      for (let t = 0; t < 360_000; t += slice) g.tick(slice);
      return [g.getState().sleeve.heat, Math.round(g.getState().sleeve.heatCooldownMs)];
    };
    expect(run(360_000)).toEqual(run(1_000));
    expect(run(360_000)).toEqual(run(50));
  });
});

describe('Undercover', () => {
  it('without it a running action keeps the normal pace; with it the action counts as idle', () => {
    const without = game([quiet]);
    without.startAction('long');
    setHeat(without, 20);
    without.tick(60_000);
    const withIt = game([quiet, undercover]);
    withIt.startAction('long');
    setHeat(withIt, 20);
    withIt.tick(60_000);
    expect([without.getState().sleeve.heat, withIt.getState().sleeve.heat]).toEqual([19, 15]);
  });

  it('an action that runs with Overclock does not count as idle', () => {
    const g = game([quiet, undercover]);
    g.startAction('long');
    expect(g.toggleOverclock('long')).toBe(true);
    setHeat(g, 20);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBeGreaterThan(18.99);
    expect(g.getState().sleeve.heat).toBeLessThan(19.01);
  });

  it('names one action only: another running action keeps the normal pace', () => {
    const g = game([quiet, undercover]);
    g.startAction('long');
    g.startAction('a'); // runs 10 s, then waits
    setHeat(g, 20);
    g.tick(9_000);
    expect(g.getState().sleeve.heat).toBe(20); // 'a' is in progress: not idle, and not yet a full cooldown cycle
    g.tick(51_000); // 'a' has completed; only 'long' is left
    expect(g.getState().sleeve.heat).toBeLessThan(20);
  });

  it('does nothing without Quiet Hours', () => {
    const g = game([undercover]);
    g.startAction('long');
    setHeat(g, 20);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBe(19);
  });
});

describe('Deep Cover', () => {
  const deep = buyable('deep', { kind: 'moleAggregation', bonusPerOrder: 0.05 });
  const channel = buyable('bc', { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 2 });

  it('Moles are not spent while heat cools', () => {
    const g = game([channel, deep]);
    setHeat(g, 20);
    setMoles(g, 100);
    g.tick(120_000);
    expect(g.getState().sleeve.moles).toBe(100);
    expect(g.getState().sleeve.heat).toBeLessThan(20);
  });

  it('the Mole boost no longer applies: 100 Moles cool at 1.05^2 times the normal pace, not 3 times', () => {
    const g = game([channel, deep]);
    setHeat(g, 50);
    setMoles(g, 100);
    g.tick(60_000 / 1.05 ** 2 - 1); // just short of one cycle at the aggregated pace
    expect(g.getState().sleeve.heat).toBe(50);
    g.tick(2);
    expect(g.getState().sleeve.heat).toBe(49);
    expect(g.getState().sleeve.moles).toBe(100);
  });

  it('without Moles it changes nothing', () => {
    const g = game([deep]);
    setHeat(g, 20);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBe(19);
  });
});

describe('Blackout', () => {
  const blackout = buyable('black', { kind: 'heatTaxCap', maxShare: 0.5 });

  it('the heat tax keeps at least half of node income however hot it gets', () => {
    const g = game([blackout]);
    setHeat(g, 1e6);
    expect(g.creditKeepFactor()).toBe(0.5);
  });

  it('is invisible while the tax is below the cap', () => {
    const g = game([blackout]);
    setHeat(g, 20);
    expect(g.creditKeepFactor()).toBeCloseTo(0.8, 12);
  });

  it('without it a hot sleeve keeps nothing', () => {
    const g = game([]);
    setHeat(g, 1e6);
    expect(g.creditKeepFactor()).toBe(0);
  });
});

describe('validation of the heat effects', () => {
  const errorsOf = (effect: BuyableDefinition['effect']): string[] =>
    validateConfig(createConfig(testConfig, { buyables: [...testConfig.buyables, buyable('x', effect)] }));

  it('accepts sensible values', () => {
    expect(errorsOf({ kind: 'burnLeadFlatHeat', amount: 1 })).toEqual([]);
    expect(errorsOf({ kind: 'idleHeatCooldown', factor: 5 })).toEqual([]);
    expect(errorsOf({ kind: 'idleHeatCooldownAction', actionId: 'a' })).toEqual([]);
    expect(errorsOf({ kind: 'moleAggregation', bonusPerOrder: 0.05 })).toEqual([]);
    expect(errorsOf({ kind: 'heatTaxCap', maxShare: 0.5 })).toEqual([]);
  });

  it('rejects values that would break the maths', () => {
    expect(errorsOf({ kind: 'burnLeadFlatHeat', amount: 0 }).join()).toMatch(/amount must be > 0/);
    expect(errorsOf({ kind: 'idleHeatCooldown', factor: 0.5 }).join()).toMatch(/factor must be >= 1/);
    expect(errorsOf({ kind: 'idleHeatCooldownAction', actionId: 'ghost' }).join()).toMatch(/unknown action "ghost"/);
    expect(errorsOf({ kind: 'moleAggregation', bonusPerOrder: -1 }).join()).toMatch(/bonusPerOrder must be > 0/);
    expect(errorsOf({ kind: 'heatTaxCap', maxShare: 1 }).join()).toMatch(/maxShare must be in \(0, 1\)/);
    expect(errorsOf({ kind: 'heatTaxCap', maxShare: Number.NaN }).join()).toMatch(/maxShare/);
  });
});
