/**
 * Behaviour of the newer purchase mechanics: paying with network nodes, network self-growth, interface speed from the
 * network size, level bonuses between actions and reduced sleeve XP requirements.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import { networkAction, setCredits, setSleeveXp, testConfig } from '../../testing/testConfig';
import { type BuyableDefinition, createConfig, validateConfig } from '..';

const withBuyables = (buyables: BuyableDefinition[], overrides = {}) =>
  createGame({ config: createConfig(testConfig, { actions: [testConfig.actions[0]!, networkAction], buyables, ...overrides }) });
const setNetwork = (g: { getState(): unknown }, nodes: ReturnType<typeof num>) => {
  (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = nodes;
};

describe('buyables paid in network nodes', () => {
  const uplink: BuyableDefinition = {
    id: 'uplink',
    name: 'Uplink',
    description: '',
    currency: 'networkNodes',
    cost: num(100),
    costGrowth: 100_000,
    maxPurchases: Infinity,
    effect: { kind: 'interfaceSpeed', amount: 0.1 },
  };

  it('takes the price from the nodes and leaves the credits alone', () => {
    const g = withBuyables([uplink]);
    setCredits(g, num(5));
    setNetwork(g, num(150));
    expect(g.currencyOf('uplink')).toBe('networkNodes');
    expect(g.buy('uplink')).toBe('purchased');
    expect(g.getState().sleeve.network.eq(num(50))).toBe(true);
    expect(g.getState().wallet.credits.eq(num(5))).toBe(true);
    expect(g.sleeveStats().interfaceBase).toBeCloseTo(1.1, 10);
  });

  it('cannot be bought with credits alone, even plenty of them', () => {
    const g = withBuyables([uplink]);
    setCredits(g, num('1e50'));
    expect(g.canBuy('uplink')).toBe(false);
    expect(g.buy('uplink')).toBe('cannot-afford');
  });

  it('each copy costs 100,000 times more (100, 1e7, 1e12 nodes)', () => {
    const g = withBuyables([uplink]);
    setNetwork(g, num('1e30'));
    expect(g.costOf('uplink').eq(num(100))).toBe(true);
    g.buy('uplink');
    expect(g.costOf('uplink').eq(num(1e7))).toBe(true);
    g.buy('uplink');
    expect(g.costOf('uplink').eq(num(1e12))).toBe(true);
  });
});

describe('network self-growth', () => {
  const growth: BuyableDefinition = {
    id: 'grow',
    name: 'Grow',
    description: '',
    actionId: 'net',
    cost: num(1),
    effect: { kind: 'networkGrowth', ratePerSecond: 0.01 },
  };
  const grown = (ms: number, steps: number) => {
    const g = withBuyables([growth], { network: { creditsPerNodePerSecond: 0 } });
    setCredits(g, num(1));
    g.buy('grow');
    setNetwork(g, num(1000));
    for (let i = 0; i < steps; i++) g.tick(ms / steps);
    return g.getState().sleeve.network.toNumber();
  };

  it('compounds the nodes by the rate every second but only whole nodes join (1000 nodes, 1% per second, 10 s -> 1104)', () => {
    expect(grown(10_000, 1)).toBe(Math.floor(1000 * 1.01 ** 10));
  });

  it('gives (almost) the same result for one long tick and many short ones', () => {
    expect(Math.abs(grown(10_000, 100) - grown(10_000, 1))).toBeLessThanOrEqual(2);
  });

  it('carries the fraction between ticks: 0.0001% a second on 1000 nodes still adds about 2 nodes in 2000 s of short ticks', () => {
    const g = withBuyables([{ ...growth, effect: { kind: 'networkGrowth', ratePerSecond: 0.000001 } }], {
      network: { creditsPerNodePerSecond: 0 },
    });
    setCredits(g, num(1));
    g.buy('grow');
    setNetwork(g, num(1000));
    for (let i = 0; i < 100; i++) g.tick(20_000); // each tick alone adds 0.02 nodes, which would round away
    expect(g.getState().sleeve.network.toNumber()).toBe(1002);
    expect(g.getState().sleeve.networkRemainder).toBeGreaterThanOrEqual(0);
    expect(g.getState().sleeve.networkRemainder).toBeLessThan(1);
  });

  it('does nothing without the buyable or without nodes', () => {
    const g = withBuyables([growth]);
    setNetwork(g, num(1000));
    g.tick(10_000);
    expect(g.getState().sleeve.network.eq(num(1000))).toBe(true);
    const empty = withBuyables([growth]);
    setCredits(empty, num(1));
    empty.buy('grow');
    empty.tick(10_000);
    expect(empty.getState().sleeve.network.isZero()).toBe(true);
  });
});

describe('interface speed from the network size', () => {
  const synergy: BuyableDefinition = {
    id: 'syn',
    name: 'Syn',
    description: '',
    actionId: 'net',
    cost: num(1),
    effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.01 },
  };
  const speedWith = (nodes: ReturnType<typeof num>, bonus = 0) => {
    const g = withBuyables([synergy], { sleeve: { baseInterfaceSpeed: 2 } });
    setCredits(g, num(1));
    g.buy('syn');
    setNetwork(g, nodes);
    (g.getState() as unknown as { sleeve: { hackingProficiency: ReturnType<typeof num> } }).sleeve.hackingProficiency = num(bonus);
    return g.sleeveStats();
  };

  it('multiplies the base by 1 + ln(nodes)/100 (e^100 nodes would double it)', () => {
    const stats = speedWith(num(1e10));
    expect(stats.interfaceNetworkFactor).toBeCloseTo(1 + Math.log(1e10) / 100, 8);
    expect(stats.interfaceSpeed).toBeCloseTo(2 * (1 + Math.log(1e10) / 100), 8);
  });

  it('applies before the hacking multiplier, which multiplies the whole result', () => {
    const stats = speedWith(num(1e10), 1);
    expect(stats.interfaceSpeed).toBeCloseTo(2 * (1 + Math.log(1e10) / 100) * 2, 8);
  });

  it('never lowers the speed: 0 or 1 nodes leave the factor at 1', () => {
    expect(speedWith(num(0)).interfaceNetworkFactor).toBe(1);
    expect(speedWith(num(1)).interfaceNetworkFactor).toBe(1);
  });
});

describe('level bonus from another action sleeve level', () => {
  const transfer: BuyableDefinition = {
    id: 'transfer',
    name: 'Transfer',
    description: '',
    actionId: 'a',
    cost: num(1),
    effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: 'a', targetActionId: 'net' },
  };

  it("adds the source action's sleeve level to the target's speed level, not to its XP progress", () => {
    const g = withBuyables([transfer]);
    const before = g.currentSpeed('net');
    setSleeveXp(g, num(110), 'a'); // sleeve level 2 (the levels cost 10 and 100)
    expect(g.sleeveLevel('a')).toBe(2);
    setCredits(g, num(1));
    g.buy('transfer');
    expect(g.levelBonus('net')).toBe(2);
    expect(g.actionLevel('net')).toBe(0);
    expect(g.getState().sleeve.actions['net']!.xp.isZero()).toBe(true);
    expect(g.currentSpeed('net')).toBeCloseTo(before * (1 + 2), 10); // test config: linear, 1 per level, level 0 is worth 1
  });

  it('does not touch other actions', () => {
    const g = withBuyables([transfer]);
    setSleeveXp(g, num(100), 'a');
    setCredits(g, num(1));
    g.buy('transfer');
    expect(g.levelBonus('a')).toBe(0);
  });
});

describe('reduced sleeve XP requirement (other actions only)', () => {
  const study = (perLevel = 1): BuyableDefinition => ({
    id: 'study',
    name: 'Study',
    description: '',
    actionId: 'a',
    cost: num(1),
    effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel },
  });
  const studied = (sleeveXp: number, perLevel?: number) => {
    const g = withBuyables([study(perLevel)]);
    setSleeveXp(g, num(sleeveXp), 'a');
    setSleeveXp(g, num(sleeveXp), 'net');
    setCredits(g, num(1));
    g.buy('study');
    return g;
  };

  it('is 0 until bought', () => {
    const g = withBuyables([study()]);
    setSleeveXp(g, num(1000), 'a');
    expect(g.sleeveXpReduction('net')).toBe(0);
  });

  it('divides the other actions requirement by 1 + source sleeve level (level 3: a quarter of the XP)', () => {
    const g = studied(1110); // sleeve level 3 (the levels cost 10, 100 and 1000)
    expect(g.sleeveLevel('a')).toBe(3);
    expect(g.sleeveXpReduction('net')).toBeCloseTo(0.75, 10);
    expect(g.nextSleeveLevelXp('net').toNumber()).toBeCloseTo(11_110 / 4, 6);
    expect(g.sleeveXpForLevel('net').toNumber()).toBeCloseTo(10_000 / 4, 6); // leaving level 3 costs 10,000 in full, divided by 4
  });

  it('is 1 at source level 0 and half the XP at level 1', () => {
    expect(studied(5).sleeveXpReduction('net')).toBe(0); // level 0: divisor 1
    expect(studied(10).sleeveXpReduction('net')).toBeCloseTo(0.5, 10); // level 1: divisor 2
  });

  it('a smaller perLevel works: 0.01 per level means level 4 divides by 1.04', () => {
    const g = studied(11_110, 0.01);
    expect(g.sleeveLevel('a')).toBe(4);
    expect(g.sleeveXpReduction('net')).toBeCloseTo(1 - 1 / 1.04, 10);
  });

  it('has no ceiling: it grows with every source level, tends to 1 and stays finite at a huge level', () => {
    let last = -1;
    for (const xp of [10, 110, 1110, 1e6, 1e12, 1e100]) {
      const g = studied(xp);
      const reduction = g.sleeveXpReduction('net');
      expect(reduction).toBeGreaterThanOrEqual(last);
      expect(reduction).toBeLessThanOrEqual(1);
      expect(Number.isFinite(g.nextSleeveLevelXp('net').toNumber())).toBe(true);
      expect(g.nextSleeveLevelXp('net').toNumber()).toBeGreaterThan(0);
      expect(Number.isFinite(g.sleeveLevelProgress('net'))).toBe(true);
      last = reduction;
    }
    expect(last).toBeGreaterThanOrEqual(0.99); // level 99: 1 - 1/100
    expect(studied(1e100, 10).sleeveXpReduction('net')).toBeGreaterThan(0.99); // past the 0.99 clamp the flat reductions obey
  });

  it('the source action is not affected by its own reduction', () => {
    const g = studied(1110);
    expect(g.sleeveXpReduction('a')).toBe(0);
    expect(g.nextSleeveLevelXp('a').toNumber()).toBeCloseTo(11_110, 6);
    // 109 XP stays level 1: without the exemption 1% off would lift it to level 2 (110 XP).
    const short = studied(109);
    expect(short.sleeveLevel('a')).toBe(1);
  });

  it('can lift another action over a threshold (109 XP is level 2 when the source is level 1: half the XP needed)', () => {
    const g = studied(109);
    expect(g.sleeveLevel('net')).toBe(2);
  });

  it('keeps the level progress bar within 0..1', () => {
    const p = studied(500).sleeveLevelProgress('net');
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe('validation of the newer effects', () => {
  const invalid = (buyable: BuyableDefinition) => validateConfig(createConfig(testConfig, { buyables: [buyable] })).join('|');
  const base = { id: 'x', name: 'X', description: '', cost: num(1) };

  it('rejects unknown actions, bad numbers and unknown currencies', () => {
    expect(invalid({ ...base, effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: 'ghost', targetActionId: 'a' } })).toContain(
      'unknown action "ghost"',
    );
    expect(invalid({ ...base, effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel: 0 } })).toContain('perLevel must be > 0');
    expect(invalid({ ...base, effect: { kind: 'networkGrowth', ratePerSecond: -1 } })).toContain('growth rate');
    expect(invalid({ ...base, effect: { kind: 'interfaceSpeedPerLnNodes', perLn: -1 } })).toContain('perLn');
    expect(invalid({ ...base, currency: 'gold' as never, effect: { kind: 'autoRun' }, actionId: 'a' })).toContain('unknown currency');
  });

  it('accepts a sleeve-wide effect that is shown on an action card', () => {
    expect(invalid({ ...base, actionId: 'a', effect: { kind: 'networkGrowth', ratePerSecond: 0.1 } })).toBe('');
  });
});

describe('reward multiplier on an action that pays network nodes', () => {
  const parallel: BuyableDefinition = {
    id: 'parallel',
    name: 'Parallel',
    description: '',
    actionId: 'net',
    cost: num(1),
    costGrowth: 10,
    maxPurchases: Infinity,
    effect: { kind: 'rewardMultiplier', factor: 2 },
  };
  const runOnce = (copies: number) => {
    const g = withBuyables([parallel]);
    (g.getState() as unknown as { sleeve: { purchased: Record<string, number> } }).sleeve.purchased['parallel'] = copies;
    g.startAction('net');
    g.tick(20_000); // exactly one run of the 20 s action
    return g;
  };

  it('doubles the nodes paid per copy owned', () => {
    expect(runOnce(0).getState().sleeve.network.eq(num(1))).toBe(true);
    expect(runOnce(1).getState().sleeve.network.eq(num(2))).toBe(true);
    expect(runOnce(3).getState().sleeve.network.eq(num(8))).toBe(true);
  });

  it('changes nothing else a run does: same XP, same counted runs, same heat, same duration', () => {
    const plain = runOnce(0);
    const boosted = runOnce(3);
    const a = plain.getState().sleeve.actions['net']!;
    const b = boosted.getState().sleeve.actions['net']!;
    expect(b.xp.eq(a.xp)).toBe(true);
    expect(b.runsTowardSleeveXp).toBe(a.runsTowardSleeveXp);
    expect(boosted.getState().sleeve.heat).toBe(plain.getState().sleeve.heat);
    expect(boosted.currentDurationMs('net')).toBe(plain.currentDurationMs('net'));
    expect(boosted.xpPerRun('net').eq(plain.xpPerRun('net'))).toBe(true);
  });

  it('does not touch the credits of another action', () => {
    const g = withBuyables([parallel]);
    (g.getState() as unknown as { sleeve: { purchased: Record<string, number> } }).sleeve.purchased['parallel'] = 4;
    expect(g.rewardPerRun('a').eq(testConfig.actions[0]!.reward)).toBe(true);
  });
});

describe('network growth that depends on an action level', () => {
  // percentPerLevel 1: the network grows by (action level)% of its size per second.
  const levelGrowth: BuyableDefinition = {
    id: 'lg',
    name: 'Level growth',
    description: '',
    actionId: 'net',
    cost: num(1),
    maxPurchases: 3,
    effect: { kind: 'networkGrowthFromActionLevel', sourceActionId: 'net', percentPerLevel: 1 },
  };
  const grownAt = (opts: { netXp?: number; copies?: number; ms?: number; steps?: number } = {}) => {
    const g = withBuyables([levelGrowth], { network: { creditsPerNodePerSecond: 0 } });
    setCredits(g, num(10));
    for (let i = 0; i < (opts.copies ?? 1); i++) g.buy('lg');
    (g.getState().sleeve.actions['net'] as { xp: unknown }).xp = num(opts.netXp ?? 0);
    setNetwork(g, num(1000));
    const steps = opts.steps ?? 1;
    for (let i = 0; i < steps; i++) g.tick((opts.ms ?? 10_000) / steps);
    return g.getState().sleeve.network.toNumber();
  };

  it('grows by level x percentPerLevel percent per second: level 0 does not grow, level 1 is 1% a second, level 2 is 2%', () => {
    expect(grownAt()).toBe(1000);
    expect(grownAt({ netXp: 10 })).toBe(Math.floor(1000 * 1.01 ** 10)); // level 1 at 10 XP
    expect(grownAt({ netXp: 110 })).toBe(Math.floor(1000 * 1.02 ** 10)); // level 2 at 110 XP
  });

  it('stacks per copy owned', () => {
    expect(grownAt({ copies: 2, netXp: 10 })).toBe(Math.floor(1000 * 1.02 ** 10));
  });

  it('uses the plain action level of the source, not a level bonus from purchases', () => {
    const g = withBuyables(
      [
        levelGrowth,
        {
          id: 'bonus',
          name: 'Bonus',
          description: '',
          cost: num(1),
          effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: 'net', targetActionId: 'net' },
        },
      ],
      { network: { creditsPerNodePerSecond: 0 } },
    );
    setCredits(g, num(10));
    g.buy('lg');
    g.buy('bonus');
    (g.getState().sleeve.actions['net'] as { xp: unknown }).xp = num(10); // level 1
    setNetwork(g, num(1000));
    g.tick(10_000);
    expect(g.getState().sleeve.network.toNumber()).toBe(Math.floor(1000 * 1.01 ** 10));
  });

  it('gives (almost) the same result for one long tick and many short ones', () => {
    expect(Math.abs(grownAt({ steps: 100 }) - grownAt({ steps: 1 }))).toBeLessThanOrEqual(2);
  });

  it('does nothing without the buyable', () => {
    const g = withBuyables([levelGrowth]);
    setNetwork(g, num(1000));
    g.tick(10_000);
    expect(g.getState().sleeve.network.eq(num(1000))).toBe(true);
  });

  it('is validated: a negative percent and an unknown source action are rejected', () => {
    const problems = (effect: BuyableDefinition['effect']) =>
      validateConfig(createConfig(testConfig, { buyables: [{ ...levelGrowth, effect }] })).join();
    expect(problems({ kind: 'networkGrowthFromActionLevel', sourceActionId: 'net', percentPerLevel: -1 })).toContain('percent per level');
    expect(problems({ kind: 'networkGrowthFromActionLevel', sourceActionId: 'ghost', percentPerLevel: 1 })).toContain(
      'unknown action "ghost"',
    );
  });
});
