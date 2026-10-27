/**
 * Back Channel Deals, Moles, heat cooling and validation of the skill effects, as skill effects.
 */
import { numberFactory } from '../numbers';
import { describe, expect, it } from 'vitest';
import { coolHeat, coolHeatBoosted, validateConfig, type BuyableDefinition } from './index';
import { skill, withSkills, mutable, skillGame } from './skillsKit';

describe('Back Channel Deals and Moles', () => {
  const channel = skill('bc', { kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 });
  const game = () => {
    const g = skillGame({ config: withSkills([channel]) });
    mutable(g).inventory = { file: { common: 3, rare: 2 } };
    return g;
  };

  it('does nothing before the skill is owned', () => {
    const g = game();
    expect(g.giveUpForMoles('file', 'common', 1)).toBe(0);
    expect(g.getState().moles).toBe(0);
    expect(g.getState().inventory['file']!['common']).toBe(3);
  });

  it('each common file given up gives 5 Moles', () => {
    const g = game();
    g.buy('bc');
    expect(g.giveUpForMoles('file', 'common', 1)).toBe(1);
    expect(g.getState().moles).toBe(5);
    expect(g.getState().inventory['file']!['common']).toBe(2);
    expect(g.giveUpForMoles('file', 'common', 'all')).toBe(2);
    expect(g.getState().moles).toBe(15);
  });

  it('only the named rarity can be given up, and an empty stack gives nothing', () => {
    const g = game();
    g.buy('bc');
    expect(g.giveUpForMoles('file', 'rare', 1)).toBe(0);
    expect(g.giveUpForMoles('ghost', 'common', 1)).toBe(0);
    g.giveUpForMoles('file', 'common', 'all');
    expect(g.giveUpForMoles('file', 'common', 1)).toBe(0);
    expect(g.getState().moles).toBe(15);
    expect(g.giveUpForMoles('file', 'common', -3)).toBe(0);
    expect(g.giveUpForMoles('file', 'common', Number.NaN)).toBe(0);
  });

  it('heat cools 50% faster while Moles remain, and each point cooled uses one Mole', () => {
    const g = game();
    g.buy('bc');
    mutable(g).heat = 20;
    mutable(g).moles = 5;
    g.tick(40_000); // boosted cycles last 40 s: one point per 40 s
    expect(g.getState().heat).toBe(19);
    expect(g.getState().moles).toBe(4);
  });

  it('the boost ends exactly when the Moles run out: 5 Moles cool 5 points in 200 s, then the normal pace', () => {
    const g = game();
    g.buy('bc');
    mutable(g).heat = 20;
    mutable(g).moles = 5;
    g.tick(200_000);
    expect(g.getState().heat).toBe(15);
    expect(g.getState().moles).toBe(0);
    g.tick(60_000); // normal pace now: one point per minute
    expect(g.getState().heat).toBe(14);
  });

  it('one long tick and many short ones give the same heat and Moles', () => {
    const run = (slice: number) => {
      const g = game();
      g.buy('bc');
      mutable(g).heat = 30;
      mutable(g).moles = 8;
      for (let t = 0; t < 600_000; t += slice) g.tick(slice);
      return [g.getState().heat, g.getState().moles, Math.round(g.getState().heatCooldownMs)];
    };
    expect(run(600_000)).toEqual(run(1_000));
    expect(run(600_000)).toEqual(run(50));
  });

  it('Moles do nothing while there is no heat, and are kept for later', () => {
    const g = game();
    g.buy('bc');
    mutable(g).moles = 5;
    g.tick(600_000);
    expect(g.getState().moles).toBe(5);
    expect(g.getState().heat).toBe(0);
  });

  it('Moles left over when the heat is gone are not spent on more than the heat they covered', () => {
    const g = game();
    g.buy('bc');
    mutable(g).heat = 2;
    mutable(g).moles = 10;
    g.tick(1_000_000);
    expect(g.getState().heat).toBe(0);
    expect(g.getState().moles).toBe(8);
  });

  it('Moles are reset by re-sleeving', () => {
    const g = game();
    g.buy('bc');
    g.giveUpForMoles('file', 'common', 'all');
    g.resleeve();
    expect(g.getState().moles).toBe(0);
  });
});

describe('coolHeatBoosted', () => {
  const none = { heat: 10, cooldownMs: 0, moles: 0 };

  it('with speed 1 and no Moles it equals coolHeat', () => {
    for (const delta of [0, 1, 59_999, 60_000, 250_000, 1e7]) {
      const a = coolHeat({ heat: 10, cooldownMs: 12_345 }, delta, 60_000, 1);
      const b = coolHeatBoosted({ ...none, cooldownMs: 12_345 }, delta, 60_000, 1, 1, 0);
      expect([b.heat, b.cooldownMs]).toEqual([a.heat, a.cooldownMs]);
    }
  });

  it('a speed of 2 does the same in half the time', () => {
    const slow = coolHeatBoosted(none, 120_000, 60_000, 1, 1, 0);
    const fast = coolHeatBoosted(none, 60_000, 60_000, 1, 2, 0);
    expect([fast.heat, fast.cooldownMs]).toEqual([slow.heat, slow.cooldownMs]);
  });

  it('keeps the heat and Moles of a step in which there is no heat', () => {
    expect(coolHeatBoosted({ heat: 0, cooldownMs: 0, moles: 7 }, 1e6, 60_000, 1, 1, 0.5)).toEqual({ heat: 0, cooldownMs: 0, moles: 7 });
  });

  it('heat below one whole point does not cool at all, so it spends no Moles', () => {
    const r = coolHeatBoosted({ heat: 0.5, cooldownMs: 0, moles: 3 }, 1e6, 60_000, 1, 1, 0.5);
    expect(r).toEqual({ heat: 0.5, cooldownMs: 0, moles: 3 });
  });

  it('removes whole points only: 2.5 heat cools to 0.5 and stops, using Moles for the 2 points cooled', () => {
    const r = coolHeatBoosted({ heat: 2.5, cooldownMs: 0, moles: 10 }, 1e7, 60_000, 1, 1, 0.5);
    expect(r.heat).toBeCloseTo(0.5, 12);
    expect(r.moles).toBe(8);
    expect(r.cooldownMs).toBe(0);
  });

  it('never produces negative heat or Moles, whatever the step', () => {
    for (const delta of [0, 1, 1e3, 1e5, 1e9, 1e15]) {
      for (const moles of [0, 0.5, 1, 7, 1e6]) {
        const r = coolHeatBoosted({ heat: 12.5, cooldownMs: 30_000, moles }, delta, 60_000, 1, 1.05, 0.5);
        expect(r.heat).toBeGreaterThanOrEqual(0);
        expect(r.moles).toBeGreaterThanOrEqual(0);
        expect(r.moles).toBeLessThanOrEqual(moles);
        expect(Number.isFinite(r.cooldownMs)).toBe(true);
      }
    }
  });
});

describe('validation of the skill effects', () => {
  const invalid = (effect: BuyableDefinition['effect']) => validateConfig(withSkills([skill('x', effect)])).join('|');

  it.each([
    [{ kind: 'interfaceSpeedMultiplier', factor: 0.9 }, 'factor must be >= 1'],
    [{ kind: 'heatCooldownSpeed', factor: 0 }, 'factor must be >= 1'],
    [{ kind: 'hackingProficiencyMultiplier', factor: -1 }, 'factor must be >= 1'],
    [{ kind: 'actionXpReduction', amount: 0 }, 'actionXpReduction amount must be in (0, 1)'],
    [{ kind: 'actionXpReduction', amount: 1 }, 'actionXpReduction amount must be in (0, 1)'],
    [{ kind: 'itemDropChanceMultiplier', itemId: 'ghost', factor: 2 }, 'unknown item "ghost"'],
    [{ kind: 'itemDropChanceMultiplier', itemId: 'file', factor: 0.5 }, 'factor must be >= 1'],
    [{ kind: 'nodePayoutFromItems', itemId: 'file', rarityId: 'ghost', perItem: 0.01 }, 'unknown rarity "ghost"'],
    [{ kind: 'nodePayoutFromItems', itemId: 'file', rarityId: 'common', perItem: -1 }, 'perItem must be >= 0'],
    [{ kind: 'backChannel', itemId: 'ghost', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 }, 'unknown item "ghost"'],
    [{ kind: 'backChannel', itemId: 'file', rarityId: 'ghost', molesPerItem: 5, cooldownBoost: 0.5 }, 'unknown rarity "ghost"'],
    [{ kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 0, cooldownBoost: 0.5 }, 'molesPerItem must be > 0'],
    [{ kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: -1 }, 'cooldownBoost must be >= 0'],
  ] as const)('%j is rejected', (effect, message) => {
    expect(invalid(effect as BuyableDefinition['effect'])).toContain(message);
  });

  it('valid skills pass', () => {
    expect(invalid({ kind: 'backChannel', itemId: 'file', rarityId: 'common', molesPerItem: 5, cooldownBoost: 0.5 })).toBe('');
  });
});

it('save and load keeps the skills, the Moles and the points they leave', async () => {
  const { serializeState, deserializeState } = await import('./index');
  const config = withSkills([skill('s1', { kind: 'heatCooldownSpeed', factor: 2 })]);
  const g = skillGame({ config });
  g.buy('s1');
  mutable(g).moles = 12;
  const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
  expect(restored.purchased['s1']).toBe(1);
  expect(restored.moles).toBe(12);
});
