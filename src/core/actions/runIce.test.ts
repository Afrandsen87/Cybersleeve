/** Actions/effects run ICE: deterministic draws, clamping and base stat ownership. */
import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../app/createGame';
import { numberFactory } from '../../numbers';
import { effectiveLevelConfig, effectiveState } from '../../testing/effectiveLevelKit';
import { earnRunIce } from './runIce';
import { createConfig, validateConfig } from '..';
import { buy } from '../../testing/cyberneticsKit';

describe('run ICE', () => {
  it('draws expected hits from the injected source and credits base ICE', () => {
    const config = effectiveLevelConfig();
    const game = createGame({ config });
    const state = effectiveState(game);
    state.sleeve.purchased['safety'] = 2;
    const draws = [0.01, 0.059, 0.061, 0.9];
    const random = vi.fn(() => draws.shift()!);
    const base = state.sleeve.iceRating.toNumber();
    earnRunIce(config.buyables, state, 'a', 4, numberFactory, random);
    expect(state.sleeve.iceRating.toNumber()).toBe(base + 2);
    expect(random).toHaveBeenCalledTimes(4);
  });
  it('no copies, zero runs and a different action consume no randomness', () => {
    const config = effectiveLevelConfig();
    const state = effectiveState(createGame({ config }));
    const random = vi.fn(() => 0);
    earnRunIce(config.buyables, state, 'a', 10, numberFactory, random);
    state.sleeve.purchased['safety'] = 1;
    earnRunIce(config.buyables, state, 'a', 0, numberFactory, random);
    earnRunIce(config.buyables, state, 'net', 10, numberFactory, random);
    expect(random).not.toHaveBeenCalled();
  });
  it('clamps huge copy chances to certainty without drawing', () => {
    const config = effectiveLevelConfig();
    const state = effectiveState(createGame({ config }));
    state.sleeve.purchased['safety'] = 1e200;
    const base = state.sleeve.iceRating.toNumber();
    const random = vi.fn(() => 0.99);
    earnRunIce(config.buyables, state, 'a', 100, numberFactory, random);
    expect(state.sleeve.iceRating.toNumber()).toBe(base + 100);
    expect(random).not.toHaveBeenCalled();
  });
  it('validates chance and copy increment', () => {
    for (const [chance, perCopy] of [
      [-1, 0],
      [NaN, 0],
      [Infinity, 0],
      [1.1, 0],
      [0.1, -1],
      [0.1, NaN],
    ]) {
      const config = createConfig(effectiveLevelConfig(), {
        buyables: [
          buy({ id: 'bad', actionId: 'a', effect: { kind: 'runIceChance', targetActionId: 'a', chance: chance!, perCopy: perCopy! } }),
        ],
      });
      expect(validateConfig(config).length).toBeGreaterThan(0);
    }
  });
});
