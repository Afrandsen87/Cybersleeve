/**
 * Network nodes are whole numbers, percentage start costs (Kill servers), and the node payout bonus (Push malware).
 * Expected outcomes are stated explicitly so the maths can change later without regressions.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { legendAction, networkAction, payoutAction, percentKillAction, setCredits, testConfig } from '../../testing/testConfig';
import {
  type BuyableDefinition,
  applyCompletionEffects,
  createConfig,
  createInitialState,
  deserializeState,
  serializeState,
  validateConfig,
} from '..';

const free = (id: string, actionId: string | undefined, effect: BuyableDefinition['effect'], extra = {}): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  actionId,
  cost: num(1),
  effect,
  ...extra,
});
const game = (actions: (typeof testConfig.actions)[number][], buyables: BuyableDefinition[] = [], overrides = {}) =>
  createGame({ config: createConfig(testConfig, { actions, buyables, ...overrides }) });
const state = (g: { getState(): unknown }) =>
  g.getState() as { network: ReturnType<typeof num>; nodePayoutBonus: ReturnType<typeof num>; heat: number };

describe('percentage start cost (Kill servers: 1% of nodes, rounded down)', () => {
  const pkill = (nodes: number, buyables: BuyableDefinition[] = []) => {
    const g = game([testConfig.actions[0]!, percentKillAction], buyables);
    state(g).network = num(nodes);
    return g;
  };

  it.each([
    [99, 0],
    [100, 1],
    [150, 1],
    [199, 1],
    [200, 2],
    [12_345, 123],
  ])('with %i nodes a run costs %i node(s)', (nodes, cost) => {
    expect(pkill(nodes).startCostOf('pkill')!.toNumber()).toBe(cost);
  });

  it('cannot start below 100 nodes because the cost rounds to 0 (no free runs)', () => {
    const g = pkill(99);
    expect(g.startAction('pkill')).toBe(false);
    expect(state(g).network.toNumber()).toBe(99);
    expect(g.getState().actions['pkill']!.running).toBe(false);
  });

  it('cannot start with 0 nodes', () => {
    expect(pkill(0).startAction('pkill')).toBe(false);
  });

  it('at exactly 100 nodes it starts and takes 1 node', () => {
    const g = pkill(100);
    expect(g.startAction('pkill')).toBe(true);
    expect(state(g).network.toNumber()).toBe(99);
    g.tick(1_000);
    expect(g.getState().iceRating.eq(num(2))).toBe(true);
  });

  it('takes 1% of whatever is held when each run starts (auto-run: 1000 -> 990 -> 981)', () => {
    const g = pkill(1000, [free('auto', 'pkill', { kind: 'autoRun' })]);
    setCredits(g, num(1));
    g.buy('auto');
    g.tick(1_000); // pays 10 (990), completes, pays 9 (981)
    expect(state(g).network.toNumber()).toBe(981);
    expect(g.getState().iceRating.eq(num(2))).toBe(true);
  });

  it('stops auto-running once the nodes fall below 100', () => {
    const g = pkill(100, [free('auto', 'pkill', { kind: 'autoRun' })]);
    setCredits(g, num(1));
    g.buy('auto');
    g.tick(1_000); // pays 1 (99), completes; 99 nodes cannot pay for another run
    expect(g.getState().actions['pkill']!.running).toBe(false);
    expect(state(g).network.toNumber()).toBe(99);
  });
});

describe('nodes gained are whole numbers', () => {
  const generous = { ...networkAction, reward: num(2.7) };

  it('a run pays the rounded-down amount (2.7 -> 2 nodes)', () => {
    const g = game([generous]);
    expect(g.payoutPerRun('net').toNumber()).toBe(2);
    g.startAction('net');
    g.tick(20_000);
    expect(state(g).network.toNumber()).toBe(2);
  });

  it('a batch of runs gives that whole amount per run (3 runs: 6, not 8)', () => {
    const g = game([{ ...generous, baseDurationMs: 1_000 }], [free('auto', 'net', { kind: 'autoRun' })]);
    setCredits(g, num(1));
    g.buy('auto');
    g.tick(3_000);
    expect(state(g).network.toNumber()).toBe(6);
  });
});

describe('prices in nodes are whole numbers', () => {
  const uplink = free('uplink', undefined, { kind: 'interfaceSpeed', amount: 0.1 }, { currency: 'networkNodes', cost: num(100) });

  it('are rounded up after the cost lever (100 x 1.005 = 100.5 -> 101)', () => {
    const g = game([testConfig.actions[0]!], [uplink], { global: { costMultiplier: 1.005 } });
    expect(g.costOf('uplink').toNumber()).toBe(101);
    state(g).network = num(100);
    expect(g.canBuy('uplink')).toBe(false);
    state(g).network = num(101);
    expect(g.canBuy('uplink')).toBe(true);
  });

  it('credit prices are not rounded', () => {
    const g = game([testConfig.actions[0]!], [free('c', undefined, { kind: 'accessLevel', amount: 1 }, { cost: num(100) })], {
      global: { costMultiplier: 1.005 },
    });
    expect(g.costOf('c').toNumber()).toBeCloseTo(100.5, 10);
  });
});

describe('Legend removes whole nodes, run by run', () => {
  const remove = (nodes: number, runs: number) => {
    const s = { network: num(nodes), heat: 0 };
    applyCompletionEffects(legendAction.completionEffects, s, runs, numberFactory);
    return s.network.toNumber();
  };

  it('each run removes floor(25%) of what is left (1000 -> 750 -> 563 -> 423 -> 318 -> 239)', () => {
    expect(remove(1000, 1)).toBe(750);
    expect(remove(1000, 2)).toBe(563);
    expect(remove(1000, 5)).toBe(239);
  });

  it('never removes a fraction of a node: 4 nodes lose 1, 3 nodes lose none', () => {
    expect(remove(4, 1)).toBe(3);
    expect(remove(3, 1)).toBe(3);
    expect(remove(3, 1_000_000)).toBe(3);
  });

  it('a huge number of runs settles at 3 nodes without looping forever', () => {
    expect(remove(1000, 1e9)).toBe(3);
  });

  it('leaves the network alone at 0 nodes', () => {
    expect(remove(0, 5)).toBe(0);
  });
});

describe('node payout bonus (Push malware)', () => {
  const push = (buyables: BuyableDefinition[] = []) => game([testConfig.actions[0]!, payoutAction], buyables);

  it('each run adds 0.001 credits per second to the BASE of every node (not to a multiplier) and 1 heat, and pays no credits', () => {
    const g = push();
    g.startAction('push');
    g.tick(1_000);
    expect(state(g).nodePayoutBonus.toNumber()).toBeCloseTo(0.001, 10);
    expect(g.sleeveStats().nodePayoutBonus).toBeCloseTo(0.001, 10);
    expect(g.sleeveStats().nodePayoutMultiplier).toBe(1); // the multiplier is untouched: only buyables change it
    state(g).network = num(100);
    expect(g.passiveCreditsPerNode().toNumber()).toBeCloseTo(0.05 + 0.001, 10); // test config base 0.05; the heat tax is not part of the payout per node
    expect(state(g).heat).toBe(1);
    expect(g.getState().credits.isZero()).toBe(true);
  });

  it('is not taxed by heat', () => {
    const g = push();
    state(g).heat = 100;
    expect(g.payoutPerRun('push').toNumber()).toBeCloseTo(0.001, 10);
  });

  it('adds up linearly to the base: every run is worth the same, however many came before', () => {
    const g = push();
    state(g).nodePayoutBonus = num(1);
    expect(g.passiveCreditsPerNode().toNumber()).toBeCloseTo(0.05 + 1, 10);
    state(g).nodePayoutBonus = num(3);
    expect(g.passiveCreditsPerNode().toNumber()).toBeCloseTo(0.05 + 3, 10);
  });

  it('the Node payout buyable multiplies the sum of the base and the bonus (1.05 x 1.5) and raises passive income', () => {
    const g = push([free('np', undefined, { kind: 'nodePayoutMultiplier', factor: 1.5 })]);
    setCredits(g, num(1));
    g.buy('np');
    state(g).nodePayoutBonus = num(1);
    state(g).network = num(100);
    expect(g.sleeveStats().nodePayoutMultiplier).toBeCloseTo(1.5, 10);
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(100 * (0.05 + 1) * 1.5, 10);
  });

  it('is reset by re-sleeving', () => {
    const g = push();
    state(g).nodePayoutBonus = num(0.5);
    g.resleeve();
    expect(state(g).nodePayoutBonus.isZero()).toBe(true);
  });
});

describe('saving whole nodes and the newer fields', () => {
  const config = createConfig(testConfig, { actions: [testConfig.actions[0]!] });
  const base = () => JSON.parse(serializeState(createInitialState(config, numberFactory)));

  it('round-trips the Legend cycle, the growth carry and the node payout bonus', () => {
    const s = createInitialState(config, numberFactory);
    s.legend = 2;
    s.legendCooldownMs = 123_000;
    s.networkRemainder = 0.25;
    s.nodePayoutBonus = num(0.042);
    const restored = deserializeState(serializeState(s), config, numberFactory)!;
    expect(restored.legend).toBe(2);
    expect(restored.legendCooldownMs).toBe(123_000);
    expect(restored.networkRemainder).toBe(0.25);
    expect(restored.nodePayoutBonus.toNumber()).toBeCloseTo(0.042, 12);
  });

  it('older saves without them load with fresh-game values', () => {
    const json = base();
    for (const key of ['legendCooldownMs', 'networkRemainder', 'nodePayoutBonus']) delete json[key];
    const restored = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect([restored.legendCooldownMs, restored.networkRemainder, restored.nodePayoutBonus.toNumber()]).toEqual([0, 0, 0]);
  });

  it('floors a saved fractional node count and rejects nonsense values', () => {
    const json = base();
    json.network = '12.75';
    json.networkRemainder = 1.5;
    json.nodePayoutBonus = -1;
    json.legendCooldownMs = -5;
    const restored = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(restored.network.toNumber()).toBe(12);
    expect(restored.networkRemainder).toBe(0);
    expect(restored.nodePayoutBonus.isZero()).toBe(true);
    expect(restored.legendCooldownMs).toBe(0);
  });
});

describe('validation of start costs and the new reward kind', () => {
  const invalid = (extra: object) =>
    validateConfig(createConfig(testConfig, { actions: [{ ...testConfig.actions[0]!, ...extra }] })).join('|');

  it('needs an amount or a share, and the share must be between 0 and 1', () => {
    expect(invalid({ startCost: { currency: 'networkNodes' } })).toContain('needs an amount or a fractionOfBalance');
    expect(invalid({ startCost: { currency: 'networkNodes', fractionOfBalance: 0 } })).toContain('between 0 and 1');
    expect(invalid({ startCost: { currency: 'networkNodes', fractionOfBalance: 1.5 } })).toContain('between 0 and 1');
    expect(invalid({ startCost: { currency: 'networkNodes', fractionOfBalance: 0.01 } })).toBe('');
    expect(invalid({ startCost: { currency: 'credits', amount: num(5), fractionOfBalance: 0.5 } })).toBe('');
  });

  it('accepts nodePayout rewards but not per network node', () => {
    expect(invalid({ rewardKind: 'nodePayout' })).toBe('');
    expect(invalid({ rewardKind: 'nodePayout', rewardPerNetworkNode: true })).toContain('network would compound');
  });
});
