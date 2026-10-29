/**
 * GameEngine: access level, Push malware, per-action sleeve levels, canStart and odd time values.
 */
import { game } from '../../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { malwareAction, networkAction, setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';

describe('GameEngine - access level and Push malware', () => {
  const withMalware = () =>
    game({ actions: [testConfig.actions[0]!, networkAction, malwareAction], network: { creditsPerNodePerSecond: 0 } }); // no passive income, to isolate the run payouts

  it('a locked action cannot be started, and does not run', () => {
    const g = withMalware();
    expect(g.isUnlocked('mal')).toBe(false);
    expect(g.isUnlocked('a')).toBe(true);
    expect(g.startAction('mal')).toBe(false);
    g.tick(60_000);
    expect(g.getState().sleeve.actions['mal']!.xp.isZero()).toBe(true);
  });

  it('the access upgrade (level 2) unlocks it', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    expect(g.isUnlocked('mal')).toBe(true);
    expect(g.startAction('mal')).toBe(true);
  });

  it('pays 1 credit per network node and adds 1 heat per run', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(8);
    expect(g.rewardPerRun('mal').eq(num(8))).toBe(true);
    g.startAction('mal');
    g.tick(5_999);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
    g.tick(1);
    expect(g.getState().wallet.credits.eq(num(8))).toBe(true);
    expect(g.getState().sleeve.heat).toBe(1);
    expect(g.sleeveStats().heat).toBe(1);
  });

  it('runs are paid in full whatever the heat: only node income is taxed', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(100);
    g.startAction('mal');
    const before = g.getState().wallet.credits.toNumber();
    g.tick(6_000); // pays 100, then heat = 1
    g.startAction('mal');
    g.tick(6_000); // pays 100 again
    expect(g.getState().wallet.credits.toNumber() - before).toBeGreaterThanOrEqual(200 - 1e-8);
    expect(g.getState().sleeve.heat).toBe(2);
  });

  it('pays nothing with an empty network but still adds heat', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    g.startAction('mal');
    g.tick(6_000);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
    expect(g.getState().sleeve.heat).toBe(1);
  });

  it('re-sleeving locks it again', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    g.resleeve();
    expect(g.isUnlocked('mal')).toBe(false);
  });
});

describe('GameEngine - sleeve levels are per action', () => {
  const both = () => game({ actions: [testConfig.actions[0]!, networkAction] });

  it("runs of one action only feed that action's sleeve xp", () => {
    const g = both();
    for (let i = 0; i < 100; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.getState().sleeve.actions['a']!.sleeveXp.eq(num(1))).toBe(true);
    expect(g.getState().sleeve.actions['net']!.sleeveXp.isZero()).toBe(true);
    expect(g.getState().sleeve.actions['net']!.runsTowardSleeveXp).toBe(0);
  });

  it('a sleeve level speeds up only its own action', () => {
    const g = both();
    setSleeveXp(g, num(10), 'a'); // sleeve level 1 for 'a' only
    expect(g.sleeveLevel('a')).toBe(1);
    expect(g.sleeveLevel('net')).toBe(0);
    expect(g.currentDurationMs('a')).toBe(5_000);
    expect(g.currentDurationMs('net')).toBe(20_000);
  });

  it('a per-action sleeve level rule overrides the default', () => {
    const g = game({ actions: [{ ...testConfig.actions[0]!, sleeveLevels: { firstLevelXp: 2, growthFactor: 2 } }] });
    setSleeveXp(g, num(2));
    expect(g.sleeveLevel('a')).toBe(1);
  });
});

describe('time that is not a usable amount of time', () => {
  it('ignores NaN, negative and infinite ticks instead of corrupting the game', () => {
    const g = game();
    g.startAction('a');
    for (const bad of [Number.NaN, -5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) g.tick(bad);
    expect(g.getState().sleeve.actions['a']!.progress).toBe(0);
    expect(g.getState().wallet.credits.isFinite()).toBe(true);
  });
});

describe('canStart', () => {
  it('is true for a free unlocked action and false for a locked one (the start cost case is in iceRating.test.ts)', () => {
    const g = game({ actions: [testConfig.actions[0]!, { ...testConfig.actions[0]!, id: 'locked', requiredAccessLevel: 9 }] });
    expect(g.canStart('a')).toBe(true);
    expect(g.canStart('locked')).toBe(false);
  });
});
