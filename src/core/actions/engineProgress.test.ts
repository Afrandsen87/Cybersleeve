/**
 * GameEngine: levelling, progression, buyables, re-sleeve and the network action.
 */
import { game } from '../../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { networkAction, setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';

describe('GameEngine - levelling and speed', () => {
  it('10th run reaches level 1 and shortens runs to 5 s', () => {
    const g = game();
    for (let i = 0; i < 10; i++) {
      g.startAction('a');
      g.tick(10_000); // still level 0 (10 s runs) until the 10th run completes
    }
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(10))).toBe(true);
    expect(g.actionLevel('a')).toBe(1);
    expect(g.currentDurationMs('a')).toBe(5_000);
  });

  it('100 runs give 1 sleeve xp', () => {
    const g = game();
    for (let i = 0; i < 100; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.getState().sleeve.actions['a']!.sleeveXp.eq(num(1))).toBe(true);
  });

  it('does not credit extra time when a level-up shortens a run in progress', () => {
    const g = game();
    (g.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(9);
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(9_000); // 9 s into the first (10 s) run
    // Force the duration below the elapsed progress: sleeve level 10 -> 1 s per run.
    setSleeveXp(g, num('1e9'));
    const before = g.getState().sleeve.actions['a']!.xp;
    g.tick(100);
    // Exactly one completion is allowed to happen right away; time must not be minted.
    expect(g.getState().sleeve.actions['a']!.xp.sub(before).lte(num(2))).toBe(true);
  });
});

describe('GameEngine - configurable progression', () => {
  it('startingCredits, reward and xp come from the config', () => {
    const g = game({
      progression: { startingCredits: 7 },
      actions: [{ ...testConfig.actions[0]!, reward: num(3), xpPerRun: num(4), baseDurationMs: 1000 }],
    });
    expect(g.getState().wallet.credits.eq(num(7))).toBe(true);
    g.startAction('a');
    g.tick(1000);
    expect(g.getState().wallet.credits.eq(num(10))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(4))).toBe(true);
  });

  it('level thresholds come from the config (level 1 at 3 xp)', () => {
    const g = game({ progression: { actionLevels: { firstLevelXp: 3, growthFactor: 2 } } });
    for (let i = 0; i < 3; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.actionLevel('a')).toBe(1);
  });

  it('level worth comes from the config (linear 0.5 per level, exponential sleeve)', () => {
    const g = game({ speed: { actionLevel: { kind: 'linear', perLevel: 0.5 }, sleeveLevel: { kind: 'exponential', base: 3 } } });
    (g.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(110); // action level 2 (10 + 100 XP) -> 1 + 2*0.5 = 2
    setSleeveXp(g, num(10)); // sleeve level 1 -> 3^1
    expect(g.currentSpeed('a')).toBe(6);
  });

  it('global levers: speed, reward, xp and cost', () => {
    const g = game({ global: { speedMultiplier: 2, creditMultiplier: 10, xpMultiplier: 3, costMultiplier: 2 } });
    expect(g.currentDurationMs('a')).toBe(5_000);
    expect(g.rewardPerRun('a').eq(num(5))).toBe(true);
    expect(g.xpPerRun('a').eq(num(3))).toBe(true);
    expect(g.costOf('auto').eq(num(20))).toBe(true);
    g.startAction('a');
    g.tick(5_000);
    expect(g.getState().wallet.credits.eq(num(5))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(3))).toBe(true);
  });

  it('runsPerSleeveXp and sleeveXpPerGrant come from the config', () => {
    const g = game({ progression: { runsPerSleeveXp: 2, sleeveXpPerGrant: 7 } });
    for (let i = 0; i < 2; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.getState().sleeve.actions['a']!.sleeveXp.eq(num(7))).toBe(true);
  });

  it('maxBatchesPerTick comes from the config: one batch stops at the first level change, the rest of the tick is dropped', () => {
    const g = game({ engine: { maxBatchesPerTick: 1, maxSlicesPerTick: 1 } });
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(10_000_000);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(10))).toBe(true); // level 2 is reached at 10 XP, where the batch ends
  });

  it('createGame refuses an invalid configuration and lists the problems', () => {
    expect(() => game({ global: { speedMultiplier: 0 }, engine: { maxBatchesPerTick: 0 } })).toThrow(
      /global\.speedMultiplier[\s\S]*maxBatchesPerTick/,
    );
  });
});

describe('GameEngine - buyables', () => {
  it('auto-run restarts the action without clicks and carries leftover time', () => {
    const g = game();
    setCredits(g, num(10));
    expect(g.buy('auto')).toBe('purchased');
    g.tick(25_000); // two full runs (20 s) + 5 s into the third
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(2))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.running).toBe(true);
    expect(g.getState().sleeve.actions['a']!.progress).toBeCloseTo(0.5);
  });

  it('dual processors doubles the credits per cycle and nothing else (not xp, not counted runs)', () => {
    const g = game();
    setCredits(g, num(15));
    expect(g.buy('dual')).toBe('purchased');
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().wallet.credits.eq(num(1))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(1))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.runsTowardSleeveXp).toBe(1);
    expect(g.xpPerRun('a').eq(num(1))).toBe(true);
  });

  it('refuses a purchase without enough credits', () => {
    expect(game().buy('auto')).toBe('cannot-afford');
  });

  it('duplicate processors: hidden until dual is owned, then doubles the reward per copy, price x10 each', () => {
    const g = game();
    setCredits(g, num(15 + 150 + 1500 + 15000));
    expect(g.isBuyableAvailable('dup')).toBe(false);
    expect(g.buy('dup')).toBe('locked');
    g.buy('dual');
    expect(g.isBuyableAvailable('dup')).toBe(true);
    expect(g.rewardMultiplier('a').eq(num(2))).toBe(true);

    expect(g.costOf('dup').eq(num(150))).toBe(true);
    expect(g.buy('dup')).toBe('purchased');
    expect(g.rewardMultiplier('a').eq(num(4))).toBe(true);
    expect(g.costOf('dup').eq(num(1500))).toBe(true);
    expect(g.buy('dup')).toBe('purchased');
    expect(g.rewardMultiplier('a').eq(num(8))).toBe(true);
    expect(g.costOf('dup').eq(num(15000))).toBe(true);
    expect(g.buy('dup')).toBe('purchased');
    expect(g.ownedCount('dup')).toBe(3);
    expect(g.rewardMultiplier('a').eq(num(16))).toBe(true);
    expect(g.isBuyableMaxed('dup')).toBe(false);

    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().wallet.credits.eq(num(0.5 * 16))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(1))).toBe(true); // the multiplier is on the reward only
  });

  it('auto-run with a huge tick completes every run that fits (no run is dropped)', () => {
    const g = game();
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(10_000_000);
    // Runs take 10 s / (action level * sleeve level), so the 10,000 s tick holds far more than 1,000 runs.
    expect(g.getState().sleeve.actions['a']!.xp.gt(num(1000))).toBe(true);
  });
});

describe('GameEngine - re-sleeve', () => {
  it('keeps sleeve xp and the run counter, resets everything else (including repeatable copies)', () => {
    const g = game();
    setCredits(g, num(10 + 15 + 150));
    g.buy('auto');
    g.buy('dual');
    g.buy('dup');
    g.tick(50_000);
    const sleeveXpBefore = g.getState().sleeve.actions['a']!.sleeveXp;
    const runsBefore = g.getState().sleeve.actions['a']!.runsTowardSleeveXp;
    expect(g.resleeve()).toBe(true);
    const s = g.getState();
    expect(s.wallet.credits.isZero()).toBe(true);
    expect(s.sleeve.purchased).toEqual({});
    expect(s.sleeve.actions['a']!.xp.isZero()).toBe(true);
    expect(s.sleeve.actions['a']!.running).toBe(false);
    expect(s.sleeve.actions['a']!.sleeveXp.eq(sleeveXpBefore)).toBe(true);
    expect(s.sleeve.actions['a']!.runsTowardSleeveXp).toBe(runsBefore);
  });

  it('re-sleeve restores the configured starting credits', () => {
    const g = game({ progression: { startingCredits: 5 } });
    setCredits(g, num(999));
    g.resleeve();
    expect(g.getState().wallet.credits.eq(num(5))).toBe(true);
  });

  it('a higher sleeve level speeds up runs and survives re-sleeving (worked example)', () => {
    const g = game();
    setSleeveXp(g, num(10)); // sleeve level 1
    expect(g.currentDurationMs('a')).toBe(5_000);
    g.resleeve();
    expect(g.currentDurationMs('a')).toBe(5_000);
  });
});

describe('GameEngine - network action and passive income', () => {
  const withNetwork = () => game({ actions: [testConfig.actions[0]!, networkAction] });

  it('a network action pays nodes, not credits, and still gives XP', () => {
    const g = withNetwork();
    g.startAction('net');
    g.tick(19_999);
    expect(g.getState().sleeve.network.isZero()).toBe(true);
    g.tick(1);
    expect(g.getState().sleeve.network.eq(num(1))).toBe(true);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
    expect(g.getState().sleeve.actions['net']!.xp.eq(num(1))).toBe(true);
  });

  it('each node produces credits per second from the config (0.05 per node per second)', () => {
    const g = withNetwork();
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(10);
    expect(g.passiveCreditsPerSecond().eq(num(0.5))).toBe(true);
    g.tick(2_000); // idle: no action was started
    expect(g.getState().wallet.credits.eq(num(1))).toBe(true);
    g.tick(500);
    expect(g.getState().wallet.credits.eq(num(1.25))).toBe(true);
  });

  it('passive income uses the configured rate and the global reward lever', () => {
    const g = game({ network: { creditsPerNodePerSecond: 2 }, global: { creditMultiplier: 3 } });
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(1);
    expect(g.passiveCreditsPerSecond().eq(num(6))).toBe(true);
  });

  it('nodes completed during a tick only produce from the next tick', () => {
    const g = withNetwork();
    g.startAction('net');
    g.tick(20_000);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
    g.tick(1_000);
    expect(g.getState().wallet.credits.eq(num(0.05))).toBe(true);
  });

  it('with no network nothing is produced passively', () => {
    const g = withNetwork();
    g.tick(60_000);
    expect(g.getState().wallet.credits.isZero()).toBe(true);
  });

  it("re-sleeving resets the network but keeps the action's sleeve xp", () => {
    const g = withNetwork();
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(5);
    setSleeveXp(g, num(7), 'net');
    g.resleeve();
    expect(g.getState().sleeve.network.isZero()).toBe(true);
    expect(g.getState().sleeve.actions['net']!.sleeveXp.eq(num(7))).toBe(true);
  });
});
