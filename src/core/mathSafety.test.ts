import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { legendAction, testConfig } from '../testing/testConfig';
import { type BuyableDefinition, createConfig, effectiveDurationMs, heatTaxFactor, speedMultiplier, validateConfig } from './index';

const game = (overrides = {}, actions = testConfig.actions, buyables: readonly BuyableDefinition[] = testConfig.buyables) =>
  createGame({ config: createConfig(testConfig, { actions, buyables, ...overrides }) });
const mutable = (g: { getState(): unknown }) => g.getState() as Record<string, unknown> & { purchased: Record<string, number> };

describe('speed at astronomical scale', () => {
  it('a speed multiplier that overflows saturates instead of becoming Infinity', () => {
    const huge = [
      { id: 'x', factor: () => Number.MAX_VALUE },
      { id: 'y', factor: () => 10 },
    ];
    expect(speedMultiplier(huge, { actionId: 'a', actionLevel: 1, sleeveLevel: 1, interfaceSpeed: 1 })).toBe(Number.MAX_VALUE);
  });

  it('a NaN speed multiplier counts as 1 (no windfall)', () => {
    const broken = [
      { id: 'x', factor: () => 0 },
      { id: 'y', factor: () => Infinity },
    ];
    expect(speedMultiplier(broken, { actionId: 'a', actionLevel: 1, sleeveLevel: 1, interfaceSpeed: 1 })).toBe(1);
  });

  it('a run never takes less than the configured minimum', () => {
    expect(effectiveDurationMs(1_000, Number.MAX_VALUE, 0.001)).toBe(0.001);
    expect(effectiveDurationMs(1_000, 4, 0.001)).toBe(250);
  });

  it('an auto-run at overflowing interface speed keeps the state valid and the balance growing', () => {
    const g = game();
    mutable(g).hackingProficiency = num('1e400');
    mutable(g).purchased['auto'] = 1;
    g.startAction('a');
    for (let i = 0; i < 20; i++) {
      const before = g.getState().credits;
      g.tick(50);
      expect(g.getState().credits.gte(before)).toBe(true);
    }
    expect(g.getState().credits.isZero()).toBe(false);
    expect(findInvariantViolations(g.getState(), testConfig)).toEqual([]);
  });

  it('interface speed at the double limit does not poison passive income or the duration', () => {
    const g = game();
    mutable(g).hackingProficiency = num('1e999');
    mutable(g).network = num(10);
    expect(Number.isFinite(g.sleeveStats().interfaceSpeed)).toBe(true);
    expect(g.currentDurationMs('a')).toBeGreaterThan(0);
    g.tick(5_000);
    expect(findInvariantViolations(g.getState(), testConfig)).toEqual([]);
  });

  it('a node payout bonus beyond the double range stays a usable multiplier', () => {
    const g = game();
    mutable(g).nodePayoutBonus = num('1e999');
    mutable(g).network = num(10);
    mutable(g).heat = 100; // a tax of 100% times a saturated multiplier must not become NaN
    expect(g.passiveCreditsPerSecond().isNaN()).toBe(false);
    g.tick(1_000);
    expect(findInvariantViolations(g.getState(), testConfig)).toEqual([]);
  });
});

describe('Infamy comes in whole points', () => {
  it('a fractional reward multiplier never pays a fraction of a point per run', () => {
    const unlock: BuyableDefinition = { id: 'unlock', name: 'u', description: '', cost: num(1), effect: { kind: 'unlock' } };
    const boost: BuyableDefinition = {
      id: 'boost',
      name: 'b',
      description: '',
      actionId: 'legend',
      cost: num(1),
      effect: { kind: 'rewardMultiplier', factor: 1.5 },
    };
    const g = game({}, [testConfig.actions[0]!, legendAction], [...testConfig.buyables, unlock, boost]);
    mutable(g).purchased['unlock'] = 1;
    mutable(g).purchased['boost'] = 1;
    mutable(g).network = num(1000);
    for (let i = 0; i < 3; i++) {
      g.startAction('legend');
      g.tick(1_000);
    }
    expect(g.getState().infamy).toBe(3); // 1.5 per run rounded down to 1, three runs
  });
});

describe('the heat tax rate comes from the configuration', () => {
  const rate = 0.02;
  it('2% per point: 25 heat keeps half', () => {
    expect(heatTaxFactor(25, 0, rate)).toBeCloseTo(0.5, 10);
    expect(heatTaxFactor(50, 0, rate)).toBe(0);
    expect(heatTaxFactor(50, 0.5, rate)).toBeCloseTo(0.5, 10);
  });

  it('with no tax per point heat costs nothing', () => {
    expect(heatTaxFactor(1_000, 0, 0)).toBe(1);
  });

  it('the view of the engine uses the configured rate for the keep factor', () => {
    const g = game({ sleeve: { heatTaxPerPoint: rate } });
    mutable(g).heat = 10;
    expect(g.creditKeepFactor()).toBeCloseTo(0.8, 10);
  });
});

describe('sleeve XP reduction cap and new settings are validated', () => {
  it('progression.maxSleeveXpReduction caps the total reduction', () => {
    const reduce: BuyableDefinition = {
      id: 'study',
      name: 's',
      description: '',
      cost: num(1),
      effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel: 0.5, maxReduction: 0.9 },
    };
    const second = { id: 'b', name: 'B', baseDurationMs: 1_000, reward: num(1), xpPerRun: num(1) };
    const g = game({ progression: { maxSleeveXpReduction: 0.3 } }, [testConfig.actions[0]!, second], [...testConfig.buyables, reduce]);
    mutable(g).purchased['study'] = 1;
    (g.getState().actions['a'] as { sleeveXp: unknown }).sleeveXp = num(1e6);
    expect(g.sleeveXpReduction('b')).toBe(0.3);
  });

  it.each([
    [{ sleeve: { heatTaxPerPoint: -0.1 } }, 'sleeve.heatTaxPerPoint'],
    [{ progression: { maxSleeveXpReduction: 1 } }, 'progression.maxSleeveXpReduction'],
    [{ engine: { minRunDurationMs: 0 } }, 'engine.minRunDurationMs'],
    [{ runtime: { renderMs: 0 } }, 'runtime.renderMs'],
    [{ global: { creditMultiplier: 0 } }, 'global.creditMultiplier'],
  ])('rejects %j', (overrides, fragment) => {
    expect(validateConfig(createConfig(testConfig, overrides)).join('\n')).toContain(fragment);
  });
});
