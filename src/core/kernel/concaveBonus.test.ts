import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { gameConfig, PRACTICE_HACKING } from '../../content/gameConfig';
import { num } from '../../numbers';
import { practiceAction, testConfig } from '../../testing/testConfig';
import { concaveBonus } from './concaveBonus';
import { createConfig, earnedSpeedBeyond, validateConfig } from '..';

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

describe('concaveBonus with a second shape past a knee', () => {
  const beyond = { knee: 1, exponent: 0.1 };
  const single = (raw: number): number => concaveBonus(raw, 1, 0.25);
  const bent = (raw: number): number => concaveBonus(raw, 1, 0.25, beyond);

  it('is the single curve up to and including the knee', () => {
    for (const raw of [0, 1e-9, 0.1, 0.5, 1]) expect(bent(raw)).toBe(single(raw));
  });

  it('continues from the value at the knee: nothing jumps there', () => {
    expect(bent(1 + 1e-9)).toBeCloseTo(single(1), 8);
  });

  it('continues with the slope it had at the knee: no kink there either', () => {
    const h = 1e-6;
    const slopeBefore = (single(1) - single(1 - h)) / h;
    const slopeAfter = (bent(1 + h) - bent(1)) / h;
    expect(slopeAfter).toBeCloseTo(slopeBefore, 4);
  });

  it('matches the formula past the knee: value at the knee plus (1 + knee)^exponent x (r^beyond - 1) / beyond, r = (1 + raw) / (1 + knee)', () => {
    const raw = 3;
    const atKnee = (2 ** 0.25 - 1) / 0.25;
    const r = (1 + raw) / (1 + beyond.knee);
    expect(bent(raw)).toBeCloseTo(atKnee + 2 ** 0.25 * ((r ** 0.1 - 1) / 0.1), 12);
  });

  it('is flatter past the knee: each further point is worth less than on the single curve, and still more than nothing', () => {
    for (const raw of [2, 10, 100, 1e6]) {
      expect(bent(raw)).toBeLessThan(single(raw));
      expect(bent(raw)).toBeGreaterThan(bent(1));
    }
    const step = (f: (x: number) => number, from: number): number => f(from + 10) - f(from);
    expect(step(bent, 10)).toBeLessThan(step(single, 10));
  });

  it('still rises forever and with diminishing returns (no ceiling)', () => {
    let previous = bent(1);
    let previousStep = Number.POSITIVE_INFINITY;
    for (const raw of [2, 10, 100, 1e3, 1e6, 1e12, 1e100]) {
      expect(bent(raw)).toBeGreaterThan(previous);
      previous = bent(raw);
    }
    for (let raw = 1; raw < 60; raw += 10) {
      const step = bent(raw + 10) - bent(raw);
      expect(step).toBeLessThan(previousStep);
      previousStep = step;
    }
  });

  it('a second exponent equal to the first changes nothing', () => {
    for (const raw of [0.5, 1, 7, 1e9])
      expect(concaveBonus(raw, 2, 0.25, { knee: 1, exponent: 0.25 })).toBeCloseTo(concaveBonus(raw, 2, 0.25), 9);
  });

  it('a knee of 0 makes the second shape the whole curve', () => {
    for (const raw of [0.5, 7, 1e9])
      expect(concaveBonus(raw, 1, 0.25, { knee: 0, exponent: 0.1 })).toBeCloseTo(concaveBonus(raw, 1, 0.1), 9);
  });

  it('works with a logarithmic second shape, and stays finite for huge amounts', () => {
    expect(concaveBonus(Math.E * 2 - 1, 1, 0.25, { knee: 1, exponent: 0 })).toBeCloseTo(
      (2 ** 0.25 - 1) / 0.25 + 2 ** 0.25 * Math.log(Math.E),
      9,
    );
    expect(Number.isFinite(concaveBonus(1e300, 1, 0.25, beyond))).toBe(true);
    expect(Number.isFinite(concaveBonus(Number.POSITIVE_INFINITY, 1, 0.25, beyond))).toBe(true);
  });

  it('scales with `scale` like the single curve', () => {
    expect(concaveBonus(10, 3, 0.25, beyond)).toBeCloseTo(3 * concaveBonus(10, 1, 0.25, beyond), 12);
  });
});

describe('the second shape in the configuration', () => {
  it('is checked: a knee below 0 and a second exponent above 1 are refused', () => {
    expect(validateConfig(createConfig(gameConfig, { sleeve: { earnedSpeedKnee: -1 } })).join()).toContain('earnedSpeedKnee');
    expect(validateConfig(createConfig(gameConfig, { sleeve: { earnedSpeedExponentBeyond: 1.5 } })).join()).toContain(
      'earnedSpeedExponentBeyond',
    );
  });

  it('is optional: without it there is one curve, as before', () => {
    expect(earnedSpeedBeyond({})).toBeUndefined();
    expect(earnedSpeedBeyond({ earnedSpeedExponentBeyond: 0.1 })).toEqual({ knee: 1, exponent: 0.1 }); // the knee defaults to 1
    expect(earnedSpeedBeyond({ earnedSpeedKnee: 5, earnedSpeedExponentBeyond: 0.1 })).toEqual({ knee: 5, exponent: 0.1 });
  });

  it('the real content flattens the curve past 1 Hacking Proficiency and leaves it as it was below', () => {
    const { earnedSpeedScale: scale, earnedSpeedExponent: e1, earnedSpeedKnee: knee, earnedSpeedExponentBeyond: e2 } = gameConfig.sleeve;
    expect(knee).toBe(1);
    expect(e2!).toBeLessThan(e1);
    const multiplier = (proficiency: number): number => {
      const g = createGame();
      (g.getState() as unknown as { sleeve: { hackingProficiency: unknown } }).sleeve.hackingProficiency = num(proficiency);
      return g.sleeveStats().hackingMultiplier;
    };
    const oldCurve = (x: number): number => 1 + concaveBonus(x, scale, e1);
    for (const p of [0.01, 0.5, 1]) expect(multiplier(p)).toBeCloseTo(oldCurve(p), 12);
    for (const p of [2, 10, 100]) {
      expect(multiplier(p)).toBeLessThan(oldCurve(p));
      expect(multiplier(p)).toBeGreaterThan(multiplier(1));
    }
  });
});
