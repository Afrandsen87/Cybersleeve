/**
 * GameEngine: sleeve stats, interface speed, heat tax and cooldown, credit multiplier.
 */
import { game } from '../../testing/gameKit';
import { describe, expect, it } from 'vitest';
import { num } from '../../numbers';
import { networkAction, practiceAction, setCredits, testConfig } from '../../testing/testConfig';
import { flat } from '../../testing/flatState';

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
    expect(g.getState().wallet.credits.isZero()).toBe(true);
  });

  it('an access level buyable adds its amount to the base access level', () => {
    const g = game({ sleeve: { baseAccessLevel: 5 } });
    setCredits(g, num(1000));
    g.buy('access');
    expect(g.sleeveStats().accessLevel).toBe(6);
  });

  it('a repeatable access level buyable stacks: each copy adds its amount, each copy costs more', () => {
    const g = game({
      buyables: [
        {
          id: 'ax',
          name: 'AX',
          description: '',
          cost: num(5),
          costGrowth: 1000,
          maxPurchases: Infinity,
          effect: { kind: 'accessLevel', amount: 1 },
        },
      ],
    });
    setCredits(g, num(5 + 5_000 + 5_000_000));
    expect(g.sleeveStats().accessLevel).toBe(1);
    for (const [owned, level] of [
      [1, 2],
      [2, 3],
      [3, 4],
    ] as const) {
      expect(g.buy('ax')).toBe('purchased');
      expect(g.ownedCount('ax')).toBe(owned);
      expect(g.sleeveStats().accessLevel).toBe(level);
    }
    expect(g.costOf('ax').eq(num(5e9))).toBe(true); // 5, 5K, 5M, then 5B
  });

  it('the access level a copy grants is gated by the actions: a locked action opens at exactly its required level', () => {
    const locked = { ...testConfig.actions[0]!, id: 'locked', requiredAccessLevel: 3 };
    const g = game({
      actions: [locked],
      buyables: [
        { id: 'ax', name: 'AX', description: '', cost: num(1), maxPurchases: Infinity, effect: { kind: 'accessLevel', amount: 1 } },
      ],
    });
    setCredits(g, num(10));
    expect(g.isUnlocked('locked')).toBe(false);
    g.buy('ax');
    expect(g.isUnlocked('locked')).toBe(false);
    g.buy('ax');
    expect(g.isUnlocked('locked')).toBe(true);
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
    expect(g.rewardMultiplier('a').eq(num(1))).toBe(true);
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
    expect(g.getState().wallet.credits.isZero()).toBe(true);
    g.tick(1);
    expect(g.getState().wallet.credits.eq(num(0.5))).toBe(true);
  });

  it('the interface boost speeds actions up: 0.5 + 0.05 = 0.55', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 } });
    setCredits(g, num(100));
    g.buy('speed');
    expect(g.currentSpeed('a')).toBeCloseTo(0.55, 10);
  });

  it('stacks with action level, sleeve level and the global lever', () => {
    const g = game({ sleeve: { baseInterfaceSpeed: 0.5 }, global: { speedMultiplier: 4 } });
    (g.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(110); // action level 3 (10 + 100 XP)
    expect(g.currentSpeed('a')).toBe(3 * 1 * 0.5 * 4);
  });
});

describe('GameEngine - heat tax', () => {
  const taxed = (heat: number) => {
    const g = game();
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = heat;
    return g;
  };

  it('0 heat does nothing', () => {
    const g = taxed(0);
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().wallet.credits.eq(num(0.5))).toBe(true);
  });

  it('13 heat subtracts 13 percent of the credits nodes produce, and nothing from a run reward', () => {
    const g = taxed(13);
    expect(g.creditKeepFactor()).toBeCloseTo(0.87, 10);
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().wallet.credits.toNumber()).toBeCloseTo(0.5, 10); // the run pays in full
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(20);
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(20 * 0.05 * 0.87, 10);
  });

  it('taxes passive network income', () => {
    const g = taxed(50);
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(20);
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(0.5, 10); // 20 * 0.05 * 0.5
    g.tick(1_000);
    expect(g.getState().wallet.credits.toNumber()).toBeCloseTo(0.5, 10);
  });

  it('does not tax network nodes being built or run rewards; 100 heat stops only the credits nodes produce', () => {
    const both = game({ actions: [testConfig.actions[0]!, networkAction] });
    (both.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 100;
    (both.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(20);
    both.startAction('net');
    both.startAction('a');
    both.tick(20_000);
    expect(both.getState().sleeve.network.eq(num(21))).toBe(true); // 20 + 1 built
    expect(both.getState().wallet.credits.toNumber()).toBeCloseTo(0.5, 10); // the run paid in full, the 20 nodes paid nothing
  });

  it('the base heat of the config counts as well', () => {
    const g = game({ sleeve: { baseHeat: 10 } });
    expect(g.creditKeepFactor()).toBeCloseTo(0.9, 10);
  });

  it('re-sleeving resets the heat gained', () => {
    const g = taxed(40);
    g.resleeve();
    expect(g.getState().sleeve.heat).toBe(0);
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
    expect(g.getState().wallet.credits.isZero()).toBe(true);
  });

  it('is not taxed by heat', () => {
    const g = practice();
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 100;
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
    (g.getState() as unknown as { sleeve: { hackingProficiency: ReturnType<typeof num> } }).sleeve.hackingProficiency = num(1);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(0.2, 10);
    (g.getState() as unknown as { sleeve: { hackingProficiency: ReturnType<typeof num> } }).sleeve.hackingProficiency = num(3);
    expect(g.sleeveStats().interfaceSpeed).toBeCloseTo(0.4, 10);
  });

  it('boosts to the base speed scale the earned multiplier too', () => {
    const g = practice({
      sleeve: { baseInterfaceSpeed: 1 },
      buyables: [{ id: 'b', name: 'B', description: '', cost: num(0), effect: { kind: 'interfaceSpeed', amount: 1 } }],
    });
    (g.getState() as unknown as { sleeve: { hackingProficiency: ReturnType<typeof num> } }).sleeve.hackingProficiency = num(1);
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
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = heat;
    return g;
  };

  it('removes 1 heat for every full 60 s that pass', () => {
    const g = hot(5);
    g.tick(59_999);
    expect(g.getState().sleeve.heat).toBe(5);
    g.tick(1);
    expect(g.getState().sleeve.heat).toBe(4);
    g.tick(60_000);
    expect(g.getState().sleeve.heat).toBe(3);
  });

  it('the progress of a cycle builds up over many small ticks and is kept', () => {
    const g = hot(2);
    for (let i = 0; i < 1_199; i++) g.tick(50); // 59.95 s
    expect(g.getState().sleeve.heat).toBe(2);
    expect(g.getState().sleeve.heatCooldownMs).toBeCloseTo(59_950, 6);
    g.tick(50);
    expect(g.getState().sleeve.heat).toBe(1);
    expect(g.getState().sleeve.heatCooldownMs).toBeCloseTo(0, 6);
  });

  it('several cycles in one long tick all count', () => {
    const g = hot(5);
    g.tick(150_000); // 2 full cycles + 30 s
    expect(g.getState().sleeve.heat).toBe(3);
    expect(g.getState().sleeve.heatCooldownMs).toBe(30_000);
  });

  it('stops at 0 and does not go negative or bank time while there is no heat', () => {
    const g = hot(2);
    g.tick(10 * 60_000);
    expect(g.getState().sleeve.heat).toBe(0);
    expect(g.getState().sleeve.heatCooldownMs).toBe(0);
    g.tick(50_000);
    expect(g.getState().sleeve.heat).toBe(0);
    expect(g.getState().sleeve.heatCooldownMs).toBe(0);
  });

  it('starts again once heat rises above 0', () => {
    const g = hot(0);
    g.tick(120_000);
    (g.getState() as unknown as { sleeve: { heat: number } }).sleeve.heat = 1;
    g.tick(59_000);
    expect(g.getState().sleeve.heat).toBe(1);
    g.tick(1_000);
    expect(g.getState().sleeve.heat).toBe(0);
  });

  it('cycle length and amount come from the config', () => {
    const g = hot(10, { sleeve: { heatCooldownMs: 1_000, heatCooldownAmount: 3 } });
    g.tick(2_500);
    expect(g.getState().sleeve.heat).toBe(4);
    expect(g.getState().sleeve.heatCooldownMs).toBe(500);
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
    expect(g.getState().sleeve.heatCooldownMs).toBe(0);
  });
});

describe('GameEngine - the credit multiplier scales credits only', () => {
  const lever = { global: { creditMultiplier: 7 } };
  const everyKind = [
    { kind: 'networkNodes', field: 'network' },
    { kind: 'hackingProficiency', field: 'hackingProficiency' },
    { kind: 'nodePayout', field: 'nodePayoutBonus' },
    { kind: 'iceRating', field: 'iceRating' },
    { kind: 'legend', field: 'legend' },
  ] as const;

  it.each(everyKind)('does not change what a $kind reward pays', ({ kind, field }) => {
    const action = { id: 'x', name: 'X', baseDurationMs: 1_000, reward: num(1), rewardKind: kind, xpPerRun: num(1) };
    const paid = (overrides: object): number => {
      const g = game({ ...overrides, actions: [testConfig.actions[0]!, action] });
      g.startAction('x');
      g.tick(1_000);
      const value = flat<Record<string, { toNumber?: () => number } | number>>(g)[field];
      return typeof value === 'number' ? value : value!.toNumber!();
    };
    expect(paid(lever)).toBe(paid({}));
  });

  it('multiplies credits paid by a run and by passive income', () => {
    const g = game(lever);
    expect(g.rewardPerRun('a').eq(num(3.5))).toBe(true);
    (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(20);
    expect(g.passiveCreditsPerSecond().eq(num(7))).toBe(true);
  });
});
