import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { buy, cyberneticsConfig, cyberneticsGame } from '../../testing/cyberneticsKit';
import { levelRewardFactor } from './levelRewardFactor';
import { validateConfig, type BuyableDefinition } from '..';

const parasite = (
  over: Partial<Extract<BuyableDefinition['effect'], { kind: 'rewardMultiplierFromActionLevel' }>> = {},
): BuyableDefinition =>
  buy({
    id: 'bp',
    effect: {
      kind: 'rewardMultiplierFromActionLevel',
      sourceActionId: 'net',
      targetActionId: 'net',
      coefficient: 2.263,
      scale: 18,
      ...over,
    },
  });

const factorAt = (level: number, owned = 1): number => levelRewardFactor([parasite()], { purchased: { bp: owned } }, 'net', () => level);

describe('levelRewardFactor (Backbone Parasite curve)', () => {
  it('is exactly 1 at level 0 and when the buyable is not owned', () => {
    expect(factorAt(0)).toBe(1);
    expect(factorAt(50, 0)).toBe(1);
  });

  it('roughly doubles at action level 10 and doubles again by level 50', () => {
    expect(factorAt(10)).toBeCloseTo(2, 1);
    expect(factorAt(50)).toBeCloseTo(4, 1);
  });

  it('keeps rising but ever more slowly (concave): each extra 100 levels adds less than the 100 before', () => {
    const steps = [0, 100, 200, 300, 400].map((l) => factorAt(l));
    const gains = steps.slice(1).map((v, i) => v - steps[i]!);
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeLessThan(gains[i - 1]!);
    expect(gains.every((g) => g > 0)).toBe(true);
  });

  it('grows without bound but stays moderate: below x12 at level 1000', () => {
    expect(factorAt(1000)).toBeLessThan(12);
    expect(factorAt(1000)).toBeGreaterThan(factorAt(100));
  });

  it('ignores the level of other actions and the reward of other actions', () => {
    expect(levelRewardFactor([parasite({ sourceActionId: 'a' })], { purchased: { bp: 1 } }, 'net', (id) => (id === 'net' ? 50 : 0))).toBe(
      1,
    );
    expect(levelRewardFactor([parasite()], { purchased: { bp: 1 } }, 'a', () => 50)).toBe(1);
  });

  it('treats a negative level as 0', () => {
    expect(factorAt(-5)).toBe(1);
  });
});

describe('Backbone Parasite in the game', () => {
  it('multiplies the reward of the target action by the factor of its level', () => {
    const g = cyberneticsGame(cyberneticsConfig([parasite({ coefficient: 1, scale: 1 })]));
    g.buy('bp');
    expect(g.rewardMultiplier('net').toNumber()).toBe(1); // level 0
    (g.getState().actions['net'] as { xp: unknown }).xp = num(1e12); // level 1 (the kit's first level needs 1e12 XP)
    expect(g.actionLevel('net')).toBe(1);
    expect(g.rewardMultiplier('net').toNumber()).toBeCloseTo(1 + Math.log(2), 9);
    expect(g.rewardMultiplier('a').toNumber()).toBe(1);
  });

  it('is rejected with an unknown action or a coefficient or scale of 0 or less', () => {
    const errors = (b: BuyableDefinition) => validateConfig(cyberneticsConfig([b])).join('|');
    expect(errors(parasite({ targetActionId: 'nope' }))).toContain('refers to unknown action "nope"');
    expect(errors(parasite({ coefficient: 0 }))).toContain('coefficient must be > 0');
    expect(errors(parasite({ scale: 0 }))).toContain('scale must be > 0');
  });
});
