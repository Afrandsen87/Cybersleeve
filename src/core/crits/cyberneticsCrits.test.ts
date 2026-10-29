import { describe, expect, it } from 'vitest';
import { buy, creditsOf, cyberneticsConfig, cyberneticsGame, xpOf } from '../../testing/cyberneticsKit';
import { validateConfig } from '..';

// Action `a`: 10 s, 0.5 credits and 1 XP per run; a critical success pays x3 and gives x2 XP (the `crit` buyable makes every run critical).
const FOUR_RUNS_MS = 10_000 * 4 + 1;

describe('Signal Amplifier (criticalExtraChance)', () => {
  const amp = (chance: number) => buy({ id: 'amp', effect: { kind: 'criticalExtraChance', chance } });

  function fourCriticalRuns(chance: number | null) {
    const g = cyberneticsGame(cyberneticsConfig(chance === null ? [] : [amp(chance)]));
    g.buy('crit');
    g.buy('auto');
    if (chance !== null) g.buy('amp');
    const before = creditsOf(g);
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    return { gained: creditsOf(g) - before, xp: xpOf(g, 'a'), g };
  }

  it('without it, four critical runs pay 4 x 0.5 x 3 = 6 and give 4 x 2 = 8 XP', () => {
    const { gained, xp } = fourCriticalRuns(null);
    expect(gained).toBeCloseTo(6, 9);
    expect(xp).toBe(8);
  });

  it('at 100% every critical success brings one extra: 8 critical successes, so 12 credits and 16 XP', () => {
    const { gained, xp } = fourCriticalRuns(1);
    expect(gained).toBeCloseTo(12, 9);
    expect(xp).toBe(16);
  });

  it('the extras do not roll again: at 100% it is exactly double, never triple', () => {
    expect(fourCriticalRuns(1).gained).toBeCloseTo(2 * fourCriticalRuns(null).gained, 9);
  });

  it('does nothing to runs that are not critical', () => {
    const g = cyberneticsGame(cyberneticsConfig([amp(1)]));
    g.buy('auto');
    g.buy('amp');
    const before = creditsOf(g);
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(creditsOf(g) - before).toBeCloseTo(2, 9);
  });

  it('at 5% over a thousand critical runs it adds about 50 critical successes (between 20 and 90 for the seeded draw)', () => {
    const g = cyberneticsGame(cyberneticsConfig([amp(0.05)]));
    g.buy('crit');
    g.buy('auto');
    g.buy('amp');
    const before = creditsOf(g);
    g.startAction('a');
    g.tick(10_000 * 1000 + 1);
    const crits = (creditsOf(g) - before) / 1.5; // each critical success pays 0.5 x 3 = 1.5
    expect(crits).toBeGreaterThan(1020);
    expect(crits).toBeLessThan(1090);
  });

  it('one long tick and many short ones give the same result when the chance is 100%', () => {
    const long = fourCriticalRuns(1).gained;
    const g = cyberneticsGame(cyberneticsConfig([amp(1)]));
    g.buy('crit');
    g.buy('auto');
    g.buy('amp');
    const before = creditsOf(g);
    g.startAction('a');
    for (let i = 0; i < 40; i++) g.tick(1_000);
    g.tick(1);
    expect(creditsOf(g) - before).toBeCloseTo(long, 9);
  });

  it('is rejected at 0 or above 100%', () => {
    expect(validateConfig(cyberneticsConfig([amp(0)])).join('|')).toContain('criticalExtraChance chance must be in (0, 1]');
    expect(validateConfig(cyberneticsConfig([amp(1.5)])).join('|')).toContain('criticalExtraChance chance must be in (0, 1]');
  });
});

describe('Overdrive Spike (criticalRewardMultiplier)', () => {
  const spike = buy({ id: 'spike', effect: { kind: 'criticalRewardMultiplier', factor: 2 } });

  it('doubles the reward of a critical success (x3 becomes x6) on every action and leaves its XP alone', () => {
    const g = cyberneticsGame(cyberneticsConfig([spike]));
    g.buy('crit');
    g.buy('auto');
    g.buy('spike');
    const before = creditsOf(g);
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(creditsOf(g) - before).toBeCloseTo(4 * 0.5 * 6, 9);
    expect(xpOf(g, 'a')).toBe(8);
  });

  it('also applies to the other actions: the Net action pays 2 x 3 x 1 node per critical run', () => {
    const g = cyberneticsGame(cyberneticsConfig([spike]));
    g.buy('crit');
    g.buy('spike');
    g.startAction('net');
    g.tick(20_001);
    expect(g.getState().sleeve.network.toNumber()).toBe(6);
  });

  it('does nothing to ordinary runs', () => {
    const g = cyberneticsGame(cyberneticsConfig([spike]));
    g.buy('auto');
    g.buy('spike');
    const before = creditsOf(g);
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(creditsOf(g) - before).toBeCloseTo(2, 9);
  });

  it('stacks with the extra critical successes of Signal Amplifier: x6 on twice as many successes', () => {
    const g = cyberneticsGame(cyberneticsConfig([spike, buy({ id: 'amp', effect: { kind: 'criticalExtraChance', chance: 1 } })]));
    g.buy('crit');
    g.buy('auto');
    g.buy('spike');
    g.buy('amp');
    const before = creditsOf(g);
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(creditsOf(g) - before).toBeCloseTo(4 * 2 * 0.5 * 6, 9);
  });

  it('is rejected below 1', () => {
    const bad = cyberneticsConfig([buy({ id: 'bad', effect: { kind: 'criticalRewardMultiplier', factor: 0.5 } })]);
    expect(validateConfig(bad).join('|')).toContain('criticalRewardMultiplier factor must be >= 1');
  });
});
