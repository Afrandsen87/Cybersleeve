import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { gameConfig } from '../../content/gameConfig';
import { num } from '../../numbers';
import { setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, EFFECT_TRAITS, REWARD_KINDS, REWARDS, rewardOf, traitsOf, type BuyableEffect, type Diagnostics } from '..';

describe('effect traits', () => {
  it('only auto-run is toggleable', () => {
    const toggleable = Object.entries(EFFECT_TRAITS)
      .filter(([, t]) => t.toggleable)
      .map(([kind]) => kind);
    expect(toggleable).toEqual(['autoRun']);
  });

  it('effects that change an action need an action, sleeve-wide ones do not', () => {
    const needing = Object.entries(EFFECT_TRAITS)
      .filter(([, t]) => t.needsAction)
      .map(([kind]) => kind)
      .sort();
    expect(needing).toEqual([
      'autoRun',
      'creditSiphon',
      'criticalBoost',
      'criticalLink',
      'focusUnlock',
      'itemDrop',
      'overclockChain',
      'overclockUnlock',
      'rarityShiftFromProficiency',
      'rewardMultiplier',
      'startCostReduction',
    ]);
  });

  it('every kind used by the shipped content has traits', () => {
    for (const b of gameConfig.buyables) expect(traitsOf(b), b.id).toBeDefined();
  });

  it('traitsOf follows the effect of the buyable', () => {
    const effect: BuyableEffect = { kind: 'autoRun' };
    expect(traitsOf({ effect }).toggleable).toBe(true);
  });
});

describe('reward descriptors', () => {
  it('describe every kind, and only credits are scaled by the credit multiplier and none is taxed by heat', () => {
    expect([...REWARD_KINDS].sort()).toEqual(Object.keys(REWARDS).sort());
    for (const kind of REWARD_KINDS) {
      expect(rewardOf(kind).scaledByCreditMultiplier === true, kind).toBe(kind === 'credits');
    }
  });

  it('an action without a reward kind pays credits', () => {
    expect(rewardOf(undefined)).toBe(REWARDS.credits);
  });
});

describe('diagnostics', () => {
  it('reports game time that had to be dropped at the batch cap', () => {
    const warnings: string[] = [];
    const diagnostics: Diagnostics = { warn: (m) => warnings.push(m) };
    const g = createGame({
      config: createConfig(testConfig, { engine: { maxBatchesPerTick: 1, maxSlicesPerTick: 1 } }),
      diagnostics,
    });
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(10_000_000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('a: dropped');
  });

  it('is silent by default', () => {
    const g = createGame({ config: createConfig(testConfig, { engine: { maxBatchesPerTick: 1, maxSlicesPerTick: 1 } }) });
    setCredits(g, num(10));
    g.buy('auto');
    expect(() => g.tick(10_000_000)).not.toThrow();
  });
});
