/** Heat/economy/effects contexts: compounded heat tax, tooltip agreement and carried Cloaking ownership. */
import { describe, expect, it } from 'vitest';
import { numberFactory } from '../../numbers';
import { cloakingGame } from '../../testing/cloakingKit';
import { buildViewModel, statRow } from '../../ui/viewModel';
import { createConfig, validateConfig } from '../config/config';
import { resolveSleeveStats } from '../effects/sleeveResolver';
import { resetForResleeve } from '../save/state';
import { heatTaxFactor } from './heat';
import { heatStopPoint, heatTaxShare } from './heatModel';

describe('Cloaking Protocols', () => {
  it('does nothing without skills and compounds once per distinct owned skill, never per skill copy', () => {
    const { game, state } = cloakingGame();
    const baseline = game.creditKeepFactor();
    state.sleeve.purchased['cloak'] = 1;
    expect(game.creditKeepFactor()).toBe(baseline);
    state.sleeve.purchased['s1'] = 10;
    state.sleeve.purchased['s2'] = 1;
    expect(game.sleeveStats().heatTaxScale).toBeCloseTo(0.97 ** 2, 12);
    expect(1 - game.creditKeepFactor()).toBeCloseTo((1 - baseline) * 0.97 ** 2, 12);
    const tip = statRow(buildViewModel(game).sleeve.stats, 'heat').tip;
    expect(tip).toContain('Cloaking = 0.9409');
    expect(tip).toContain('x Cloaking');
  });

  it('survives a re-sleeve while the ordinary credit-paid ICE boost resets, and still scales the tax', () => {
    const { config, game, state } = cloakingGame();
    state.sleeve.purchased['cloak'] = 1;
    state.sleeve.purchased['boost'] = 1;
    state.sleeve.purchased['s1'] = 1;
    const before = game.sleeveStats().heatTaxScale;
    resetForResleeve(state, config, numberFactory);
    expect(state.sleeve.purchased['cloak']).toBe(1);
    expect(state.sleeve.purchased['boost']).toBeUndefined();
    expect(state.sleeve.purchased['s1']).toBe(1);
    state.sleeve.heat = 25;
    expect(game.sleeveStats().heatTaxScale).toBe(before);
    expect(1 - game.creditKeepFactor()).toBeCloseTo(0.25 * before, 12);
  });

  it('shares its resolved multiplier with the heat tax share and stop point', () => {
    const scale = 0.97 ** 4;
    expect(heatTaxShare(25, 0.2, 0.01, 1, scale)).toBeCloseTo(0.2 * scale, 12);
    expect(heatStopPoint(0.2, 0.01, 1, scale)).toBeCloseTo(125 / scale, 10);
    expect(heatTaxFactor(1e300, 0, 0.01, 1, scale)).toBe(0);
  });

  it('never returns NaN or negative retained income for huge or invalid heat, scale and reduction', () => {
    for (const heat of [0, -1, 1e300, Infinity, NaN]) {
      for (const scale of [0, 1, 0.97 ** 1e300, NaN, Infinity, -1]) {
        for (const reduction of [0, 1, NaN]) {
          const keep = heatTaxFactor(heat, reduction, 0.01, 1, scale);
          expect(keep).toBeGreaterThanOrEqual(0);
          expect(keep).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps invalid and huge injected skill counts finite and nonnegative', () => {
    const { config, state } = cloakingGame();
    state.sleeve.purchased['cloak'] = 1;
    for (const count of [0, -1, NaN, Infinity, 1e300]) {
      const stats = resolveSleeveStats(config.buyables, state, config.sleeve, numberFactory, undefined, undefined, undefined, () => count);
      expect(stats.heatTaxScale).toBeGreaterThanOrEqual(0);
      expect(stats.heatTaxScale).toBeLessThanOrEqual(1);
    }
  });

  it('validates the per-skill reduction rather than permitting invalid powers', () => {
    const { config } = cloakingGame();
    for (const perSkill of [-1, 1, Infinity, NaN]) {
      const buyables = config.buyables.map((b) =>
        b.id === 'cloak' ? { ...b, effect: { kind: 'heatReductionPerSleeveSkill' as const, perSkill } } : b,
      );
      expect(validateConfig(createConfig(config, { buyables }))).toContainEqual(expect.stringContaining('heat reduction per sleeve skill'));
    }
    expect(validateConfig(config)).toEqual([]);
  });
});
