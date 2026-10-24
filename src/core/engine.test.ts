import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { malwareAction, networkAction, practiceAction, setCredits, setSleeveXp, testConfig } from '../testing/testConfig';
import { createConfig } from './index';

const game = (overrides = {}) => createGame({ config: createConfig(testConfig, overrides) });

describe('GameEngine - manual running', () => {
  it('does nothing until the action is started', () => {
    const g = game();
    g.tick(60_000);
    expect(g.getState().credits.isZero()).toBe(true);
  });

  it('fills the bar over 10 s and pays 0.5 credits + 1 xp on completion', () => {
    const g = game();
    expect(g.startAction('a')).toBe(true);
    g.tick(9_999);
    expect(g.getState().credits.isZero()).toBe(true);
    expect(g.getState().actions['a']!.running).toBe(true);
    g.tick(1);
    expect(g.getState().credits.eq(num(0.5))).toBe(true);
    expect(g.getState().actions['a']!.xp.eq(num(1))).toBe(true);
    expect(g.getState().actions['a']!.running).toBe(false);
    expect(g.getState().actions['a']!.progressMs).toBe(0);
  });

  it('needs a new click for the next run and discards leftover time', () => {
    const g = game();
    g.startAction('a');
    g.tick(25_000);
    expect(g.getState().credits.eq(num(0.5))).toBe(true);
    g.tick(10_000);
    expect(g.getState().credits.eq(num(0.5))).toBe(true);
  });

  it('ignores unknown actions and non-positive deltas', () => {
    const g = game();
    expect(g.startAction('ghost')).toBe(false);
    g.startAction('a');
    g.tick(0);
    g.tick(-5);
    g.tick(NaN);
    expect(g.getState().actions['a']!.progressMs).toBe(0);
  });
});

describe('GameEngine - levelling and speed', () => {
  it('10th run reaches level 2 and shortens runs to 5 s', () => {
    const g = game();
    for (let i = 0; i < 10; i++) {
      g.startAction('a');
      g.tick(10_000); // still level 1 (10 s runs) until the 10th run completes
    }
    expect(g.getState().actions['a']!.xp.eq(num(10))).toBe(true);
    expect(g.actionLevel('a')).toBe(2);
    expect(g.currentDurationMs('a')).toBe(5_000);
  });

  it('100 runs give 1 sleeve xp', () => {
    const g = game();
    for (let i = 0; i < 100; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.getState().actions['a']!.sleeveXp.eq(num(1))).toBe(true);
  });

  it('does not credit extra time when a level-up shortens a run in progress', () => {
    const g = game();
    (g.getState().actions['a'] as { xp: unknown }).xp = num(9);
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(9_000); // 9 s into the first (10 s) run
    // Force the duration below the elapsed progress: sleeve level 10 -> 1 s per run.
    setSleeveXp(g, num('1e9'));
    const before = g.getState().actions['a']!.xp;
    g.tick(100);
    // Exactly one completion is allowed to happen right away; time must not be minted.
    expect(g.getState().actions['a']!.xp.sub(before).lte(num(2))).toBe(true);
  });
});

describe('GameEngine - configurable progression', () => {
  it('startingCredits, reward and xp come from the config', () => {
    const g = game({
      progression: { startingCredits: 7 },
      actions: [{ ...testConfig.actions[0]!, reward: num(3), xpPerRun: num(4), baseDurationMs: 1000 }],
    });
    expect(g.getState().credits.eq(num(7))).toBe(true);
    g.startAction('a');
    g.tick(1000);
    expect(g.getState().credits.eq(num(10))).toBe(true);
    expect(g.getState().actions['a']!.xp.eq(num(4))).toBe(true);
  });

  it('level thresholds come from the config (level 2 at 3 xp)', () => {
    const g = game({ progression: { actionLevels: { firstLevelXp: 3, growthFactor: 2 } } });
    for (let i = 0; i < 3; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.actionLevel('a')).toBe(2);
  });

  it('level worth comes from the config (linear 0.5 per level, exponential sleeve)', () => {
    const g = game({ speed: { actionLevel: { kind: 'linear', perLevel: 0.5 }, sleeveLevel: { kind: 'exponential', base: 3 } } });
    (g.getState().actions['a'] as { xp: unknown }).xp = num(100); // action level 3 -> 1 + 2*0.5 = 2
    setSleeveXp(g, num(10)); // sleeve level 2 -> 3^1
    expect(g.currentSpeed('a')).toBe(6);
  });

  it('global levers: speed, reward, xp and cost', () => {
    const g = game({ global: { speedMultiplier: 2, rewardMultiplier: 10, xpMultiplier: 3, costMultiplier: 2 } });
    expect(g.currentDurationMs('a')).toBe(5_000);
    expect(g.rewardPerRun('a').eq(num(5))).toBe(true);
    expect(g.xpPerRun('a').eq(num(3))).toBe(true);
    expect(g.costOf('auto').eq(num(20))).toBe(true);
    g.startAction('a');
    g.tick(5_000);
    expect(g.getState().credits.eq(num(5))).toBe(true);
    expect(g.getState().actions['a']!.xp.eq(num(3))).toBe(true);
  });

  it('runsPerSleeveXp and sleeveXpPerGrant come from the config', () => {
    const g = game({ progression: { runsPerSleeveXp: 2, sleeveXpPerGrant: 7 } });
    for (let i = 0; i < 2; i++) {
      g.startAction('a');
      g.tick(10_000);
    }
    expect(g.getState().actions['a']!.sleeveXp.eq(num(7))).toBe(true);
  });

  it('maxBatchesPerTick comes from the config: one batch stops at the first level change, the rest of the tick is dropped', () => {
    const g = game({ engine: { maxBatchesPerTick: 1, maxSlicesPerTick: 1 } });
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(10_000_000);
    expect(g.getState().actions['a']!.xp.eq(num(10))).toBe(true); // level 2 is reached at 10 XP, where the batch ends
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
    expect(g.getState().actions['a']!.xp.eq(num(2))).toBe(true);
    expect(g.getState().actions['a']!.running).toBe(true);
    expect(g.getState().actions['a']!.progressMs).toBeCloseTo(5_000);
  });

  it('dual processors doubles credits, xp and counted runs per cycle', () => {
    const g = game();
    setCredits(g, num(15));
    expect(g.buy('dual')).toBe('purchased');
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.eq(num(1))).toBe(true);
    expect(g.getState().actions['a']!.xp.eq(num(2))).toBe(true);
    expect(g.getState().actions['a']!.runsTowardSleeveXp).toBe(2);
  });

  it('refuses a purchase without enough credits', () => {
    expect(game().buy('auto')).toBe('cannot-afford');
  });

  it('duplicate processors: hidden until dual is owned, then doubles output per copy, price x10 each', () => {
    const g = game();
    setCredits(g, num(15 + 150 + 1500 + 15000));
    expect(g.isBuyableAvailable('dup')).toBe(false);
    expect(g.buy('dup')).toBe('locked');
    g.buy('dual');
    expect(g.isBuyableAvailable('dup')).toBe(true);
    expect(g.outputMultiplier('a').eq(num(2))).toBe(true);

    expect(g.costOf('dup').eq(num(150))).toBe(true);
    expect(g.buy('dup')).toBe('purchased');
    expect(g.outputMultiplier('a').eq(num(4))).toBe(true);
    expect(g.costOf('dup').eq(num(1500))).toBe(true);
    expect(g.buy('dup')).toBe('purchased');
    expect(g.outputMultiplier('a').eq(num(8))).toBe(true);
    expect(g.costOf('dup').eq(num(15000))).toBe(true);
    expect(g.buy('dup')).toBe('purchased');
    expect(g.ownedCount('dup')).toBe(3);
    expect(g.outputMultiplier('a').eq(num(16))).toBe(true);
    expect(g.isBuyableMaxed('dup')).toBe(false);

    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.eq(num(0.5 * 16))).toBe(true);
    expect(g.getState().actions['a']!.xp.eq(num(16))).toBe(true);
  });

  it('auto-run with a huge tick completes every run that fits (no run is dropped)', () => {
    const g = game();
    setCredits(g, num(10));
    g.buy('auto');
    g.tick(10_000_000);
    // Runs take 10 s / (action level * sleeve level), so the 10,000 s tick holds far more than 1,000 runs.
    expect(g.getState().actions['a']!.xp.gt(num(1000))).toBe(true);
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
    const sleeveXpBefore = g.getState().actions['a']!.sleeveXp;
    const runsBefore = g.getState().actions['a']!.runsTowardSleeveXp;
    expect(g.resleeve()).toBe(true);
    const s = g.getState();
    expect(s.credits.isZero()).toBe(true);
    expect(s.purchased).toEqual({});
    expect(s.actions['a']!.xp.isZero()).toBe(true);
    expect(s.actions['a']!.running).toBe(false);
    expect(s.actions['a']!.sleeveXp.eq(sleeveXpBefore)).toBe(true);
    expect(s.actions['a']!.runsTowardSleeveXp).toBe(runsBefore);
  });

  it('re-sleeve restores the configured starting credits', () => {
    const g = game({ progression: { startingCredits: 5 } });
    setCredits(g, num(999));
    g.resleeve();
    expect(g.getState().credits.eq(num(5))).toBe(true);
  });

  it('a higher sleeve level speeds up runs and survives re-sleeving (worked example)', () => {
    const g = game();
    setSleeveXp(g, num(10)); // sleeve level 2
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
    expect(g.getState().network.isZero()).toBe(true);
    g.tick(1);
    expect(g.getState().network.eq(num(1))).toBe(true);
    expect(g.getState().credits.isZero()).toBe(true);
    expect(g.getState().actions['net']!.xp.eq(num(1))).toBe(true);
  });

  it('each node produces credits per second from the config (0.05 per node per second)', () => {
    const g = withNetwork();
    (g.getState() as { network: unknown }).network = num(10);
    expect(g.passiveCreditsPerSecond().eq(num(0.5))).toBe(true);
    g.tick(2_000); // idle: no action was started
    expect(g.getState().credits.eq(num(1))).toBe(true);
    g.tick(500);
    expect(g.getState().credits.eq(num(1.25))).toBe(true);
  });

  it('passive income uses the configured rate and the global reward lever', () => {
    const g = game({ network: { creditsPerNodePerSecond: 2 }, global: { rewardMultiplier: 3 } });
    (g.getState() as { network: unknown }).network = num(1);
    expect(g.passiveCreditsPerSecond().eq(num(6))).toBe(true);
  });

  it('nodes completed during a tick only produce from the next tick', () => {
    const g = withNetwork();
    g.startAction('net');
    g.tick(20_000);
    expect(g.getState().credits.isZero()).toBe(true);
    g.tick(1_000);
    expect(g.getState().credits.eq(num(0.05))).toBe(true);
  });

  it('with no network nothing is produced passively', () => {
    const g = withNetwork();
    g.tick(60_000);
    expect(g.getState().credits.isZero()).toBe(true);
  });

  it("re-sleeving resets the network but keeps the action's sleeve xp", () => {
    const g = withNetwork();
    (g.getState() as { network: unknown }).network = num(5);
    setSleeveXp(g, num(7), 'net');
    g.resleeve();
    expect(g.getState().network.isZero()).toBe(true);
    expect(g.getState().actions['net']!.sleeveXp.eq(num(7))).toBe(true);
  });
});

describe('GameEngine - sleeve stats and global buyables', () => {
  it('start at the configured values: access level 1, interface speed (test config: 1), heat 0', () => {
    expect(game().sleeveStats()).toMatchObject({ accessLevel: 1, interfaceSpeed: 1, heat: 0 });
  });

  it('the start values come from the config', () => {
    const g = game({ sleeve: { baseAccessLevel: 3, baseInterfaceSpeed: 5, baseHeat: 2 } });
    expect(g.sleeveStats()).toMatchObject({ accessLevel: 3, interfaceSpeed: 5, heat: 2 });
  });

  it('interface boost adds 0.05; access upgrade raises access level to 2', () => {
    const g = game();
    setCredits(g, num(1100));
    expect(g.buy('speed')).toBe('purchased');
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(1.05, 10);
    expect(g.sleeveStats().accessLevel).toBe(1);
    expect(g.buy('access')).toBe('purchased');
    expect(g.sleeveStats().accessLevel).toBe(2);
    expect(g.getState().credits.isZero()).toBe(true);
  });

  it('an access level buyable never lowers the access level', () => {
    const g = game({ sleeve: { baseAccessLevel: 5 } });
    setCredits(g, num(1000));
    g.buy('access');
    expect(g.sleeveStats().accessLevel).toBe(5);
  });

  it('a repeatable interface buyable adds its amount per copy', () => {
    const g = game({
      buyables: [{ id: 'x', name: 'X', description: '', cost: num(1), maxPurchases: 3, effect: { kind: 'interfaceSpeed', amount: 1 } }],
    });
    setCredits(g, num(10));
    g.buy('x');
    g.buy('x');
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(3, 10);
  });

  it('global buyables do not change any action and are reset by re-sleeving', () => {
    const g = game();
    setCredits(g, num(1100));
    g.buy('speed');
    g.buy('access');
    expect(g.outputMultiplier('a').eq(num(1))).toBe(true);
    expect(g.isAutoRun('a')).toBe(false);
    g.resleeve();
    expect(g.sleeveStats()).toMatchObject({ accessLevel: 1, interfaceSpeed: 1, heat: 0 });
  });
});

describe('GameEngine - interface speed', () => {
  it('multiplies the speed of every action: 0.5 doubles every run time', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 } });
    expect(g.currentSpeed('a')).toBe(0.5);
    expect(g.currentDurationMs('a')).toBe(20_000);
    g.startAction('a');
    g.tick(19_999);
    expect(g.getState().credits.isZero()).toBe(true);
    g.tick(1);
    expect(g.getState().credits.eq(num(0.5))).toBe(true);
  });

  it('the interface boost speeds actions up: 0.5 + 0.05 = 0.55', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 } });
    setCredits(g, num(100));
    g.buy('speed');
    expect(g.currentSpeed('a')).toBeCloseTo(0.55, 10);
  });

  it('stacks with action level, sleeve level and the global lever', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 }, global: { speedMultiplier: 4 } });
    (g.getState().actions['a'] as { xp: unknown }).xp = num(100); // action level 3
    expect(g.currentSpeed('a')).toBe(3 * 1 * 0.5 * 4);
  });
});

describe('GameEngine - heat tax', () => {
  const taxed = (heat: number) => {
    const g = game();
    (g.getState() as { heat: number }).heat = heat;
    return g;
  };

  it('0 heat does nothing', () => {
    const g = taxed(0);
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.eq(num(0.5))).toBe(true);
  });

  it('13 heat subtracts 13 percent of earned credits', () => {
    const g = taxed(13);
    expect(g.creditKeepFactor()).toBeCloseTo(0.87, 10);
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.toNumber()).toBeCloseTo(0.5 * 0.87, 10);
  });

  it('also taxes passive network income', () => {
    const g = taxed(50);
    (g.getState() as { network: unknown }).network = num(20);
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(0.5, 10); // 20 * 0.05 * 0.5
    g.tick(1_000);
    expect(g.getState().credits.toNumber()).toBeCloseTo(0.5, 10);
  });

  it('does not tax network nodes, and 100 or more heat earns no credits at all', () => {
    const both = game({ actions: [testConfig.actions[0]!, networkAction] });
    (both.getState() as { heat: number }).heat = 100;
    both.startAction('net');
    both.startAction('a');
    both.tick(20_000);
    expect(both.getState().network.eq(num(1))).toBe(true);
    expect(both.getState().credits.isZero()).toBe(true);
  });

  it('the base heat of the config counts as well', () => {
    const g = game({ sleeve: { baseHeat: 10 } });
    expect(g.creditKeepFactor()).toBeCloseTo(0.9, 10);
  });

  it('re-sleeving resets the heat gained', () => {
    const g = taxed(40);
    g.resleeve();
    expect(g.getState().heat).toBe(0);
    expect(g.sleeveStats().heat).toBe(0);
  });
});

describe('GameEngine - interface speed reward', () => {
  const practice = (overrides = {}) => game({ actions: [practiceAction], buyables: [], sleeve: { baseInterfaceSpeed: 1 }, ...overrides });

  it('a completed run raises interface speed by the reward and pays no credits', () => {
    const g = practice();
    g.startAction('practice');
    g.tick(1_000);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(1.001, 10);
    expect(g.getState().credits.isZero()).toBe(true);
  });

  it('is not taxed by heat', () => {
    const g = practice();
    (g.getState() as { heat: number }).heat = 100;
    g.startAction('practice');
    g.tick(1_000);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(1.001, 10);
    expect(g.payoutPerRun('practice').toNumber()).toBeCloseTo(0.001, 10);
  });

  it('batched auto runs give the same gain as the runs completed (10 runs -> +0.01)', () => {
    const g = practice();
    g.startAction('practice');
    g.tick(1_000);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(1.001, 10);
    const auto = game({
      actions: [practiceAction],
      buyables: [{ id: 'auto', name: 'Auto', description: '', actionId: 'practice', cost: num(0), effect: { kind: 'autoRun' } }],
      sleeve: { baseInterfaceSpeed: 1 },
    });
    auto.buy('auto');
    auto.tick(10_000);
    expect(auto.sleeveStats().interfaceSpeed).toBeGreaterThan(1.009);
  });

  it('is a multiplier with diminishing returns: 1000 runs double the speed, 3000 runs quadruple it', () => {
    const g = practice({ sleeve: { baseInterfaceSpeed: 0.1 } });
    (g.getState() as { interfaceSpeedBonus: ReturnType<typeof num> }).interfaceSpeedBonus = num(1);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(0.2, 10);
    (g.getState() as { interfaceSpeedBonus: ReturnType<typeof num> }).interfaceSpeedBonus = num(3);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(0.4, 10);
  });

  it('boosts to the base speed scale the earned multiplier too', () => {
    const g = practice({
      sleeve: { baseInterfaceSpeed: 1 },
      buyables: [{ id: 'b', name: 'B', description: '', cost: num(0), effect: { kind: 'interfaceSpeed', amount: 1 } }],
    });
    (g.getState() as { interfaceSpeedBonus: ReturnType<typeof num> }).interfaceSpeedBonus = num(1);
    g.buy('b');
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(4, 10); // (1 + 1) * (1 + 1)
  });

  it('re-sleeving resets the bonus', () => {
    const g = practice();
    g.startAction('practice');
    g.tick(1_000);
    g.resleeve();
    expect(g.sleeveStats().interfaceSpeed).toBe(1);
  });
});

describe('GameEngine - heat cooldown', () => {
  const hot = (heat: number, overrides = {}) => {
    const g = game(overrides);
    (g.getState() as { heat: number }).heat = heat;
    return g;
  };

  it('removes 1 heat for every full 60 s that pass', () => {
    const g = hot(5);
    g.tick(59_999);
    expect(g.getState().heat).toBe(5);
    g.tick(1);
    expect(g.getState().heat).toBe(4);
    g.tick(60_000);
    expect(g.getState().heat).toBe(3);
  });

  it('the progress of a cycle builds up over many small ticks and is kept', () => {
    const g = hot(2);
    for (let i = 0; i < 1_199; i++) g.tick(50); // 59.95 s
    expect(g.getState().heat).toBe(2);
    expect(g.getState().heatCooldownMs).toBeCloseTo(59_950, 6);
    g.tick(50);
    expect(g.getState().heat).toBe(1);
    expect(g.getState().heatCooldownMs).toBeCloseTo(0, 6);
  });

  it('several cycles in one long tick all count', () => {
    const g = hot(5);
    g.tick(150_000); // 2 full cycles + 30 s
    expect(g.getState().heat).toBe(3);
    expect(g.getState().heatCooldownMs).toBe(30_000);
  });

  it('stops at 0 and does not go negative or bank time while there is no heat', () => {
    const g = hot(2);
    g.tick(10 * 60_000);
    expect(g.getState().heat).toBe(0);
    expect(g.getState().heatCooldownMs).toBe(0);
    g.tick(50_000);
    expect(g.getState().heat).toBe(0);
    expect(g.getState().heatCooldownMs).toBe(0);
  });

  it('starts again once heat rises above 0', () => {
    const g = hot(0);
    g.tick(120_000);
    (g.getState() as { heat: number }).heat = 1;
    g.tick(59_000);
    expect(g.getState().heat).toBe(1);
    g.tick(1_000);
    expect(g.getState().heat).toBe(0);
  });

  it('cycle length and amount come from the config', () => {
    const g = hot(10, { sleeve: { heatCooldownMs: 1_000, heatCooldownAmount: 3 } });
    g.tick(2_500);
    expect(g.getState().heat).toBe(4);
    expect(g.getState().heatCooldownMs).toBe(500);
  });

  it('cooling lowers the tax', () => {
    const g = hot(2);
    g.tick(60_000);
    expect(g.creditKeepFactor()).toBeCloseTo(0.99, 10);
  });

  it('re-sleeving restarts the cooldown cycle', () => {
    const g = hot(5);
    g.tick(30_000);
    g.resleeve();
    expect(g.getState().heatCooldownMs).toBe(0);
  });
});

describe('GameEngine - access level and Push malware', () => {
  const withMalware = () =>
    game({ actions: [testConfig.actions[0]!, networkAction, malwareAction], network: { creditsPerNodePerSecond: 0 } }); // no passive income, to isolate the run payouts

  it('a locked action cannot be started, and does not run', () => {
    const g = withMalware();
    expect(g.isUnlocked('mal')).toBe(false);
    expect(g.isUnlocked('a')).toBe(true);
    expect(g.startAction('mal')).toBe(false);
    g.tick(60_000);
    expect(g.getState().actions['mal']!.xp.isZero()).toBe(true);
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
    (g.getState() as { network: unknown }).network = num(8);
    expect(g.rewardPerRun('mal').eq(num(8))).toBe(true);
    g.startAction('mal');
    g.tick(5_999);
    expect(g.getState().credits.isZero()).toBe(true);
    g.tick(1);
    expect(g.getState().credits.eq(num(8))).toBe(true);
    expect(g.getState().heat).toBe(1);
    expect(g.sleeveStats().heat).toBe(1);
  });

  it('heat taxes the next run: 1 heat keeps 99 percent', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    (g.getState() as { network: unknown }).network = num(100);
    g.startAction('mal');
    g.tick(6_000); // pays 100 at 0 heat, then heat = 1
    g.startAction('mal');
    g.tick(6_000); // pays 99
    expect(g.getState().credits.toNumber()).toBeCloseTo(199, 8);
    expect(g.getState().heat).toBe(2);
  });

  it('pays nothing with an empty network but still adds heat', () => {
    const g = withMalware();
    setCredits(g, num(1000));
    g.buy('access');
    g.startAction('mal');
    g.tick(6_000);
    expect(g.getState().credits.isZero()).toBe(true);
    expect(g.getState().heat).toBe(1);
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
    expect(g.getState().actions['a']!.sleeveXp.eq(num(1))).toBe(true);
    expect(g.getState().actions['net']!.sleeveXp.isZero()).toBe(true);
    expect(g.getState().actions['net']!.runsTowardSleeveXp).toBe(0);
  });

  it('a sleeve level speeds up only its own action', () => {
    const g = both();
    setSleeveXp(g, num(10), 'a'); // sleeve level 2 for 'a' only
    expect(g.sleeveLevel('a')).toBe(2);
    expect(g.sleeveLevel('net')).toBe(1);
    expect(g.currentDurationMs('a')).toBe(5_000);
    expect(g.currentDurationMs('net')).toBe(20_000);
  });

  it('a per-action sleeve level rule overrides the default', () => {
    const g = game({ actions: [{ ...testConfig.actions[0]!, sleeveLevels: { firstLevelXp: 2, growthFactor: 2 } }] });
    setSleeveXp(g, num(2));
    expect(g.sleeveLevel('a')).toBe(2);
  });
});
