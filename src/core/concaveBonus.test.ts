import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { gameConfig, PRACTICE_HACKING } from '../content/gameConfig';
import { practiceAction, testConfig } from '../testing/testConfig';
import { concaveBonus } from './concaveBonus';
import { createConfig, validateConfig } from './index';

describe('concaveBonus', () => {
  it('is 0 for nothing earned, and for negative or NaN input', () => {
    for (const raw of [0, -5, Number.NaN]) expect(concaveBonus(raw, 1, 0.25)).toBe(0);
  });

  it('exponent 1 is the straight line scale * raw', () => {
    expect(concaveBonus(7, 2, 1)).toBeCloseTo(14, 12);
  });

  it('exponent 0 is the logarithm scale * ln(1 + raw)', () => {
    expect(concaveBonus(Math.E - 1, 3, 0)).toBeCloseTo(3, 12);
  });

  it('starts with slope `scale`: tiny amounts count in full', () => {
    expect(concaveBonus(1e-9, 1, 0.25)).toBeCloseTo(1e-9, 15);
    expect(concaveBonus(1e-9, 5, 0.25)).toBeCloseTo(5e-9, 14);
  });

  it('rises forever but each further point is worth less (monotonic, strictly concave, no ceiling)', () => {
    let previous = 0;
    let previousStep = Number.POSITIVE_INFINITY;
    for (const raw of [1, 10, 100, 1e3, 1e6, 1e12, 1e100]) {
      const value = concaveBonus(raw, 1, 0.25);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    // equal raw increments buy less and less
    for (let raw = 0; raw < 50; raw += 10) {
      const step = concaveBonus(raw + 10, 1, 0.25) - concaveBonus(raw, 1, 0.25);
      expect(step).toBeLessThan(previousStep);
      previousStep = step;
    }
  });

  it('a lower exponent is stricter', () => {
    expect(concaveBonus(1e6, 1, 0)).toBeLessThan(concaveBonus(1e6, 1, 0.25));
    expect(concaveBonus(1e6, 1, 0.25)).toBeLessThan(concaveBonus(1e6, 1, 0.5));
    expect(concaveBonus(1e6, 1, 0.5)).toBeLessThan(concaveBonus(1e6, 1, 1));
  });

  it('stays finite at the largest values', () => {
    expect(Number.isFinite(concaveBonus(Number.POSITIVE_INFINITY, 1, 0.25))).toBe(true);
    expect(Number.isFinite(concaveBonus(Number.MAX_VALUE, 1e300, 1))).toBe(true);
  });
});

describe('the earned interface speed in the game', () => {
  const practiceGame = (exponent: number) =>
    createGame({
      config: createConfig(testConfig, {
        actions: [practiceAction],
        buyables: [],
        sleeve: { baseInterfaceSpeed: 1, earnedSpeedExponent: exponent },
      }),
    });
  const hackingMultiplierOf = (g: ReturnType<typeof practiceGame>) => g.sleeveStats().hackingMultiplier;

  it('pays the same straight line as before when the exponent is 1', () => {
    const g = practiceGame(1);
    g.startAction(practiceAction.id);
    g.tick(10_000);
    expect(hackingMultiplierOf(g)).toBeGreaterThan(1);
  });

  it('grows more slowly with a lower exponent after the same play', () => {
    const results = [1, 0.5, 0.25].map((exponent) => {
      const g = practiceGame(exponent);
      g.startAction(practiceAction.id);
      for (let i = 0; i < 2_000; i++) g.tick(100);
      return hackingMultiplierOf(g);
    });
    expect(results[1]).toBeLessThan(results[0] as number);
    expect(results[2]).toBeLessThan(results[1] as number);
    expect(results[2]).toBeGreaterThan(1);
  });

  it('one long tick and many short ones give the same speed bonus', () => {
    const run = (ticks: number, ms: number) => {
      const g = practiceGame(0.25);
      g.startAction(practiceAction.id);
      for (let i = 0; i < ticks; i++) g.tick(ms);
      return hackingMultiplierOf(g);
    };
    expect(run(1, 60_000)).toBeCloseTo(run(600, 100), 6);
  });
});

describe('the real configuration', () => {
  it('has a valid earned-speed curve that is strictly diminishing', () => {
    expect(validateConfig(gameConfig)).toEqual([]);
    expect(gameConfig.sleeve.earnedSpeedExponent).toBeLessThan(1);
  });

  it('rejects a curve that would accelerate', () => {
    const bad = createConfig(gameConfig, { sleeve: { earnedSpeedExponent: 1.5 } });
    expect(validateConfig(bad).join()).toContain('earnedSpeedExponent');
  });

  it('has no reward multiplier on Practice Hacking', () => {
    const practice = gameConfig.buyables.filter((b) => b.actionId === PRACTICE_HACKING && b.effect.kind === 'rewardMultiplier');
    expect(practice).toEqual([]);
  });
});
