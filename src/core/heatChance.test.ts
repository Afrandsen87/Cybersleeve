/**
 * Heat that a completed run only makes with a chance (`ActionDefinition.heatChance`, Overclock `heatChanceFactor`).
 * A batch draws how many runs make heat in one binomial draw, so one long tick and many short ones agree on average.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { seededRandom } from '../testing/random';
import { networkAction, payoutAction, setCredits, testConfig } from '../testing/testConfig';
import { createConfig, validateConfig, type BuyableDefinition, type GameConfig } from './index';

const unlock: BuyableDefinition = {
  id: 'oc-push',
  name: 'Overclock',
  description: '',
  actionId: 'push',
  cost: num(1),
  effect: { kind: 'overclockUnlock' },
};
const auto: BuyableDefinition = {
  id: 'push-auto',
  name: 'Auto',
  description: '',
  actionId: 'push',
  cost: num(1),
  effect: { kind: 'autoRun' },
};

/** Push-style action: 1 s runs, 1 heat per run that makes heat; levels out of reach and no cooling or passive income. */
function configWith(push: object, rule: object = { heatPerRunFactor: 3, heatChanceFactor: 2 }): GameConfig {
  const base = createConfig(testConfig, {
    buyables: [...testConfig.buyables, unlock, auto],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
    sleeve: { heatCooldownMs: 1e15 },
  });
  return createConfig(base, {
    actions: [base.actions[0]!, { ...networkAction, baseDurationMs: 1_000 }, { ...payoutAction, overclock: rule, ...push }],
  });
}

function heatAfter(config: GameConfig, runs: number, steps: number, overclock: boolean, seed = 7): number {
  const g = createGame({ config, random: seededRandom(seed) });
  setCredits(g, num(1e9));
  g.buy('push-auto');
  if (overclock) {
    g.buy('oc-push');
    g.toggleOverclock('push');
  }
  g.startAction('push');
  for (let i = 0; i < steps; i++) g.tick((runs * 1_000 + 1) / steps);
  return g.getState().heat;
}

describe('heat chance', () => {
  it('without heatChance every run makes heat (no randomness involved)', () => {
    expect(heatAfter(configWith({}), 50, 1, false)).toBe(50);
  });

  it('a chance of 0 makes no heat', () => {
    expect(heatAfter(configWith({ heatChance: 0 }), 50, 1, false)).toBe(0);
  });

  it('a chance of 10% makes about a tenth of the heat, in one long tick or many short ones', () => {
    const config = configWith({ heatChance: 0.1 });
    for (const steps of [1, 40]) {
      const heat = heatAfter(config, 20_000, steps, false);
      expect(heat).toBeGreaterThan(1_700);
      expect(heat).toBeLessThan(2_300);
    }
  });

  it('Overclock doubles the chance and triples the heat per heat-making run', () => {
    const config = configWith({ heatChance: 0.1 });
    const heat = heatAfter(config, 20_000, 1, true);
    expect(heat).toBeGreaterThan(0.2 * 3 * 20_000 * 0.9);
    expect(heat).toBeLessThan(0.2 * 3 * 20_000 * 1.1);
  });

  it('the chance is capped at 1 under Overclock', () => {
    expect(heatAfter(configWith({ heatChance: 0.8 }), 100, 1, true)).toBe(300);
  });

  it('is reproducible with the same seed', () => {
    const config = configWith({ heatChance: 0.1 });
    expect(heatAfter(config, 5_000, 1, false, 3)).toBe(heatAfter(config, 5_000, 1, false, 3));
  });
});

describe('heat chance validation', () => {
  const errors = (push: object, rule?: object) => validateConfig(configWith(push, rule));
  it('accepts the real range', () => {
    expect(errors({ heatChance: 0.1 })).toEqual([]);
  });
  it('rejects a heatChance outside 0..1', () => {
    expect(errors({ heatChance: 1.5 }).join()).toContain('heatChance must be between 0 and 1');
    expect(errors({ heatChance: -0.1 }).join()).toContain('heatChance must be between 0 and 1');
  });
  it('rejects a heatChanceFactor below 1', () => {
    expect(errors({}, { heatChanceFactor: 0.5 }).join()).toContain('overclock heatChanceFactor must be >= 1');
  });
});
