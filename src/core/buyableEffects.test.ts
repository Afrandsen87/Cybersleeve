/**
 * Behaviour of the newer purchase mechanics: paying with network nodes, network self-growth, interface speed from the
 * network size, level bonuses between actions and reduced sleeve XP requirements.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { networkAction, setCredits, setSleeveXp, testConfig } from '../testing/testConfig';
import { type BuyableDefinition, createConfig, validateConfig } from './index';

const withBuyables = (buyables: BuyableDefinition[], overrides = {}) =>
  createGame({ config: createConfig(testConfig, { actions: [testConfig.actions[0]!, networkAction], buyables, ...overrides }) });
const setNetwork = (g: { getState(): unknown }, nodes: ReturnType<typeof num>) => {
  (g.getState() as { network: unknown }).network = nodes;
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
    expect(g.getState().network.eq(num(50))).toBe(true);
    expect(g.getState().credits.eq(num(5))).toBe(true);
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
    return g.getState().network.toNumber();
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
    expect(g.getState().network.toNumber()).toBe(1002);
    expect(g.getState().networkRemainder).toBeGreaterThanOrEqual(0);
    expect(g.getState().networkRemainder).toBeLessThan(1);
  });

  it('does nothing without the buyable or without nodes', () => {
    const g = withBuyables([growth]);
    setNetwork(g, num(1000));
    g.tick(10_000);
    expect(g.getState().network.eq(num(1000))).toBe(true);
    const empty = withBuyables([growth]);
    setCredits(empty, num(1));
    empty.buy('grow');
    empty.tick(10_000);
    expect(empty.getState().network.isZero()).toBe(true);
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
    (g.getState() as { interfaceSpeedBonus: ReturnType<typeof num> }).interfaceSpeedBonus = num(bonus);
    return g.sleeveStats();
  };

  it('multiplies the base by 1 + ln(nodes)/100 (e^100 nodes would double it)', () => {
    const stats = speedWith(num(1e10));
    expect(stats.interfaceNetworkFactor).toBeCloseTo(1 + Math.log(1e10) / 100, 8);
    expect(stats.interfaceSpeed).toBeCloseTo(2 * (1 + Math.log(1e10) / 100), 8);
  });

  it('applies before the run multiplier, which multiplies the whole result', () => {
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
    setSleeveXp(g, num(100), 'a'); // sleeve level 3 (thresholds 10 and 100)
    expect(g.sleeveLevel('a')).toBe(3);
    setCredits(g, num(1));
    g.buy('transfer');
    expect(g.levelBonus('net')).toBe(3);
    expect(g.actionLevel('net')).toBe(1);
    expect(g.getState().actions['net']!.xp.isZero()).toBe(true);
    expect(g.currentSpeed('net')).toBeCloseTo(before * (1 + (3 + 1 - 1)), 10); // test config: linear, 1 per level
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
  const study = (perLevel = 0.01, maxReduction = 0.25): BuyableDefinition => ({
    id: 'study',
    name: 'Study',
    description: '',
    actionId: 'a',
    cost: num(1),
    effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel, maxReduction },
  });
  const studied = (sleeveXp: number, perLevel?: number, maxReduction?: number) => {
    const g = withBuyables([study(perLevel, maxReduction)]);
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

  it('reduces the other actions by perLevel per source sleeve level (level 4, 0.01 -> 4% less XP)', () => {
    const g = studied(1000);
    expect(g.sleeveXpReduction('net')).toBeCloseTo(0.04, 10);
    expect(g.nextSleeveLevelXp('net').toNumber()).toBeCloseTo(10_000 * 0.96, 6);
  });

  it('a percentage-sized rate works: 0.0001 per level means level 5 gives 0.05% less XP', () => {
    const g = studied(10_000, 0.0001);
    expect(g.sleeveLevel('a')).toBe(5);
    expect(g.sleeveXpReduction('net')).toBeCloseTo(0.0005, 10);
  });

  it('the source action is not affected by its own reduction', () => {
    const g = studied(1000);
    expect(g.sleeveXpReduction('a')).toBe(0);
    expect(g.nextSleeveLevelXp('a').toNumber()).toBeCloseTo(10_000, 6);
    // 99 XP stays level 2: without the exemption 2% off would lift it to level 3.
    const short = studied(99);
    expect(short.sleeveLevel('a')).toBe(2);
  });

  it('can lift another action over a threshold (99 XP is level 3 when the source is level 2: 2% off 100)', () => {
    const g = studied(99);
    expect(g.sleeveLevel('net')).toBe(3);
  });

  it('never goes beyond the cap (25% at most)', () => {
    expect(studied(1000, 0.01, 0.25).sleeveXpReduction('net')).toBeLessThanOrEqual(0.25);
    expect(studied(1e12, 0.5, 0.25).sleeveXpReduction('net')).toBeCloseTo(0.25, 10);
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
    expect(invalid({ ...base, effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel: 0, maxReduction: 0.2 } })).toContain(
      'perLevel must be > 0',
    );
    expect(invalid({ ...base, effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel: 0.1, maxReduction: 1 } })).toContain(
      'maxReduction',
    );
    expect(invalid({ ...base, effect: { kind: 'networkGrowth', ratePerSecond: -1 } })).toContain('growth rate');
    expect(invalid({ ...base, effect: { kind: 'interfaceSpeedPerLnNodes', perLn: -1 } })).toContain('perLn');
    expect(invalid({ ...base, currency: 'gold' as never, effect: { kind: 'autoRun' }, actionId: 'a' })).toContain('unknown currency');
  });

  it('accepts a sleeve-wide effect that is shown on an action card', () => {
    expect(invalid({ ...base, actionId: 'a', effect: { kind: 'networkGrowth', ratePerSecond: 0.1 } })).toBe('');
  });
});
