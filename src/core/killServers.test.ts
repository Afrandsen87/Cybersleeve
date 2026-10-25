import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { percentKillAction, setCredits, testConfig } from '../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type BuyableDefinition, type GameConfig } from './index';

/**
 * The test action `pkill` takes 1% of the nodes per run and pays +1 ICE Rating. Its Overclock doubles the ICE Rating it pays and holds
 * heat in place. The Kill chain buyable adds a chain (at most 3 links) that adds +50% of the base reward and +50% of the node share per link.
 */
const OVERCLOCK = { rewardBonus: 1, stopsHeatCooling: true };
const CHAIN = { maxLinks: 3, rewardPerLink: 0.5, nodesPerLink: 0.5 };

const buyable = (id: string, effect: BuyableDefinition['effect'], extra: Partial<BuyableDefinition> = {}): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  actionId: 'pkill',
  cost: num(1),
  effect,
  ...extra,
});

function configWith(overclock: GameConfig['actions'][number]['overclock'] = OVERCLOCK): GameConfig {
  return createConfig(testConfig, {
    actions: [testConfig.actions[0]!, { ...percentKillAction, overclock }],
    buyables: [
      ...testConfig.buyables,
      buyable('kill-auto', { kind: 'autoRun' }),
      buyable('kill-oc', { kind: 'overclockUnlock' }),
      buyable('kill-chain', { kind: 'overclockChain', chain: CHAIN }, { requires: ['kill-oc'] }),
      buyable('decom', { kind: 'startCostReduction', perLevel: 0.1 }),
      buyable('siphon', { kind: 'creditSiphon', seconds: 10 }),
    ],
    // Action levels are out of reach unless a test sets the XP; the speed stays at 1 (one second per run).
    progression: { actionLevels: { firstLevelXp: 10, growthFactor: 1e6 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    speed: { actionLevel: { kind: 'linear', perLevel: 1e-9 }, sleeveLevel: { kind: 'linear', perLevel: 1e-9 } },
    network: { creditsPerNodePerSecond: 0.05 },
  });
}

function game(config = configWith(), nodes = 1_000_000) {
  const g = createGame({ config, random: () => 0.5 });
  setCredits(g, num(1e9));
  (g.getState() as { network: unknown }).network = num(nodes);
  return g;
}
type Game = ReturnType<typeof game>;

const own = (g: Game, ...ids: string[]): void => {
  for (const id of ids) g.buy(id);
};
const nodes = (g: Game): number => g.getState().network.toNumber();
const ice = (g: Game): number => g.getState().iceRating.toNumber();
/** Lets one run of `pkill` complete (the next one, when auto-run restarts it, then starts). */
const finishRun = (g: Game): void => g.tick(g.currentDurationMs('pkill') + 1);
const setLevel = (g: Game, level: number): void => {
  // With firstLevelXp 10 and growth 1e6 the XP for level 1 is 10 and for level 2 10 + 1e7; level 1 is all these tests need.
  (g.getState().actions['pkill']!.xp as unknown) = num(level >= 1 ? 10 : 0);
};

describe('Decommission protocol', () => {
  it('without it the share of the nodes is the plain 1%, rounded down', () => {
    const g = game(undefined, 1_000);
    expect(g.startCostOf('pkill')!.toNumber()).toBe(10);
  });

  it('every action level multiplies the share by (1 - perLevel): the first level is the biggest step, the next one is 10% of the new value', () => {
    const g = game(undefined, 100_000);
    own(g, 'decom');
    const base = g.startCostOf('pkill')!.toNumber(); // level 0: 1000
    expect(base).toBe(1_000);
    setLevel(g, 1);
    expect(g.actionLevel('pkill')).toBe(1);
    expect(g.startCostOf('pkill')!.toNumber()).toBe(900); // x0.9
  });

  it('the cost never reaches 0: a node cost that rounds down to 0 is raised to 1 node, so the action stays startable', () => {
    const g = game(undefined, 50); // 1% of 50 rounds down to 0
    expect(g.canStart('pkill')).toBe(false);
    own(g, 'decom');
    expect(g.startCostOf('pkill')!.toNumber()).toBe(1);
    expect(g.canStart('pkill')).toBe(true);
  });

  it('with no nodes the action still cannot start (there is nothing to give up)', () => {
    const g = game(undefined, 0);
    own(g, 'decom');
    expect(g.canStart('pkill')).toBe(false);
  });
});

describe('Credit Siphon', () => {
  it('pays 10 seconds of what a node produces for every node the run destroys, when the run starts', () => {
    const g = game(undefined, 1_000);
    own(g, 'siphon');
    const perNode = g.passiveCreditsPerNode().toNumber(); // 0.05 per second
    const before = g.getState().credits.toNumber();
    expect(g.startAction('pkill')).toBe(true);
    expect(nodes(g)).toBe(990);
    expect(g.getState().credits.toNumber() - before).toBeCloseTo(10 * perNode * 10, 4);
  });

  it('uses the income after the heat tax: a hot sleeve pays less', () => {
    const g = game(undefined, 1_000);
    own(g, 'siphon');
    (g.getState() as { heat: number }).heat = 50;
    const perNode = g.passiveCreditsPerNode().toNumber();
    expect(perNode).toBeCloseTo(0.025, 9);
    const before = g.getState().credits.toNumber();
    g.startAction('pkill');
    expect(g.getState().credits.toNumber() - before).toBeCloseTo(10 * perNode * 10, 4);
  });

  it('pays for each restart of an auto-run, not just the first start', () => {
    const g = game(undefined, 100_000);
    own(g, 'siphon', 'kill-auto');
    const start = g.getState().credits.toNumber();
    g.startAction('pkill');
    finishRun(g);
    finishRun(g);
    // three runs have started by now: the first, and one restart after each completion
    expect(g.getState().credits.toNumber()).toBeGreaterThan(start);
    expect(nodes(g)).toBeLessThan(100_000 - 1_000 - 900);
  });

  it('pays nothing without it', () => {
    const g = game(undefined, 1_000);
    const before = g.getState().credits.toNumber();
    g.startAction('pkill');
    // only the passive income of the nodes can have changed the balance, and no time has passed
    expect(g.getState().credits.toNumber()).toBe(before);
  });
});

describe('Overclock: the Kill chain', () => {
  const overclocked = (g: Game): void => {
    own(g, 'kill-oc', 'kill-chain', 'kill-auto');
    g.toggleOverclock('pkill');
  };

  it('the first run of a chain pays the plain Overclock bonus (double) and takes the plain share', () => {
    const g = game(undefined, 1_000_000);
    overclocked(g);
    expect(g.startCostOf('pkill')!.toNumber()).toBe(10_000);
    expect(g.rewardPerRun('pkill').toNumber()).toBe(2);
  });

  it('every consecutive run adds a link: more ICE Rating per run and a bigger share of the nodes, up to the most links', () => {
    const g = game(undefined, 1_000_000);
    overclocked(g);
    g.startAction('pkill'); // run 1 starts at 0 links
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) {
      const before = ice(g);
      finishRun(g);
      gains.push(ice(g) - before);
    }
    // base 1 x (1 + Overclock 1 + 0.5 per link): 2, 2.5, 3, 3.5, then the chain stays at 3 links
    expect(gains).toEqual([2, 2.5, 3, 3.5, 3.5]);
    expect(g.getState().chains['pkill']).toBe(3);
  });

  it('each link takes more of the nodes: the share is 1% x (1 + 0.5 per link)', () => {
    const g = game(undefined, 1_000_000);
    overclocked(g);
    (g.getState() as { chains: Record<string, number> }).chains['pkill'] = 2;
    expect(g.startCostOf('pkill')!.toNumber()).toBe(20_000); // 1% x 2 = 2%
  });

  it('is broken when a run is not followed by another (a manual action stops)', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-oc', 'kill-chain');
    g.toggleOverclock('pkill');
    (g.getState() as { chains: Record<string, number> }).chains['pkill'] = 2;
    g.startAction('pkill');
    finishRun(g);
    expect(g.getState().actions['pkill']!.running).toBe(false);
    expect(g.getState().chains['pkill']).toBeUndefined();
  });

  it('is broken, and counts for nothing, when Overclock is switched off', () => {
    const g = game(undefined, 1_000_000);
    overclocked(g);
    (g.getState() as { chains: Record<string, number> }).chains['pkill'] = 2;
    g.toggleOverclock('pkill');
    expect(g.startCostOf('pkill')!.toNumber()).toBe(10_000);
    expect(g.rewardPerRun('pkill').toNumber()).toBe(1);
    g.startAction('pkill');
    finishRun(g);
    expect(g.getState().chains['pkill']).toBeUndefined();
  });

  it('shows its links in the Overclock status, with the reward per link scaled by the strength of Overclock', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-oc', 'kill-chain');
    g.toggleOverclock('pkill');
    (g.getState() as { chains: Record<string, number> }).chains['pkill'] = 1;
    expect(g.overclockStatus('pkill')!.chain).toEqual({ links: 1, maxLinks: 3, rewardPerLink: 0.5, nodesPerLink: 0.5 });
  });

  it('keeps the state sound', () => {
    const g = game(undefined, 1_000_000);
    overclocked(g);
    g.startAction('pkill');
    for (let i = 0; i < 6; i++) finishRun(g);
    expect(findInvariantViolations(g.getState(), configWith())).toEqual([]);
  });
});

describe('the Kill chain buyable', () => {
  it('cannot be bought before the Overclock unlock, and adds nothing until it is bought', () => {
    const g = game(undefined, 1_000_000);
    expect(g.isBuyableAvailable('kill-chain')).toBe(false);
    own(g, 'kill-oc', 'kill-auto');
    expect(g.isBuyableAvailable('kill-chain')).toBe(true);
    g.toggleOverclock('pkill');
    expect(g.overclockStatus('pkill')!.chain).toBeNull();
    g.startAction('pkill');
    for (let i = 0; i < 3; i++) finishRun(g);
    expect(g.getState().chains['pkill']).toBeUndefined();
    expect(g.rewardPerRun('pkill').toNumber()).toBe(2);
  });

  it('buying it adds the chain to the Overclock that is already on, from the next run', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-oc', 'kill-auto');
    g.toggleOverclock('pkill');
    g.startAction('pkill');
    finishRun(g);
    own(g, 'kill-chain');
    expect(g.overclockStatus('pkill')!.chain).toEqual({ links: 0, maxLinks: 3, rewardPerLink: 0.5, nodesPerLink: 0.5 });
    finishRun(g);
    expect(g.getState().chains['pkill']).toBe(1);
  });

  it('is saved with the purchase: a chain is only restored for an action that owns it', () => {
    const config = configWith();
    const g = game(config);
    own(g, 'kill-oc');
    (g.getState() as { chains: Record<string, number> }).chains['pkill'] = 2;
    expect(deserializeState(serializeState(g.getState()), config, numberFactory)!.chains).toEqual({});
  });
});

describe('Overclock: holding heat in place', () => {
  const hot = (g: Game): void => {
    (g.getState() as { heat: number }).heat = 10;
  };

  it('heat cools as usual without Overclock', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-auto');
    hot(g);
    g.startAction('pkill');
    g.tick(120_000);
    expect(g.getState().heat).toBeLessThan(10);
  });

  it('heat does not cool at all while the action runs overclocked', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-oc', 'kill-auto');
    g.toggleOverclock('pkill');
    hot(g);
    g.startAction('pkill');
    g.tick(120_000);
    expect(g.getState().heat).toBe(10);
    expect(g.heatCoolingBlocked()).toBe(true);
  });

  it('resumes when the action stops', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-oc'); // manual: the run ends and the action stops
    g.toggleOverclock('pkill');
    hot(g);
    g.startAction('pkill');
    g.tick(5_000);
    expect(g.getState().actions['pkill']!.running).toBe(false);
    expect(g.heatCoolingBlocked()).toBe(false);
    g.tick(120_000);
    expect(g.getState().heat).toBeLessThan(10);
  });

  it('does not hold heat while Overclock is switched off, even with the unlock owned', () => {
    const g = game(undefined, 1_000_000);
    own(g, 'kill-oc', 'kill-auto');
    hot(g);
    g.startAction('pkill');
    expect(g.heatCoolingBlocked()).toBe(false);
  });
});

describe('configuration of the chain and the new effects', () => {
  const problems = (c: GameConfig): string[] => validateConfig(c);

  it('the test content is valid', () => {
    expect(problems(configWith())).toEqual([]);
  });

  it('a chain needs an action with a start cost and an Overclock rule', () => {
    const config = createConfig(testConfig, {
      actions: [testConfig.actions[0]!],
      buyables: [
        ...testConfig.buyables,
        { id: 'c', name: 'c', description: '', actionId: 'a', cost: num(1), effect: { kind: 'overclockChain', chain: CHAIN } },
      ],
    });
    const text = problems(config).join('\n');
    expect(text).toContain('an overclock chain needs an action with a startCost');
    expect(text).toContain('overclockChain needs an action that has an overclock rule');
  });

  it.each([
    [{ maxLinks: 0, rewardPerLink: 0.5, nodesPerLink: 0.5 }, 'chain maxLinks must be an integer >= 1'],
    [{ maxLinks: 3, rewardPerLink: 0, nodesPerLink: 0.5 }, 'chain rewardPerLink must be > 0'],
    [{ maxLinks: 3, rewardPerLink: 0.5, nodesPerLink: -1 }, 'chain nodesPerLink must be >= 0'],
  ])('rejects a bad chain', (chain, message) => {
    const bad = createConfig(configWith(), { buyables: [...configWith().buyables, buyable('c2', { kind: 'overclockChain', chain })] });
    expect(problems(bad).join('\n')).toContain(message);
  });

  it('rejects a bad Decommission protocol and Credit Siphon', () => {
    const bad = createConfig(configWith(), {
      buyables: [
        ...configWith().buyables,
        buyable('d2', { kind: 'startCostReduction', perLevel: 1 }),
        buyable('s2', { kind: 'creditSiphon', seconds: 0 }),
      ],
    });
    const text = problems(bad).join('\n');
    expect(text).toContain('startCostReduction perLevel must be in (0, 1)');
    expect(text).toContain('creditSiphon seconds must be > 0');
  });

  it('an Overclock rule that only holds heat in place is a rule', () => {
    expect(problems(configWith({ stopsHeatCooling: true }))).toEqual([]);
  });
});

describe('saving the chain', () => {
  it('round-trips the links, and clamps them to the rule on loading', () => {
    const config = configWith();
    const g = game(config);
    own(g, 'kill-oc', 'kill-chain');
    (g.getState() as { chains: Record<string, number> }).chains['pkill'] = 2;
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.chains['pkill']).toBe(2);
    const json = JSON.parse(serializeState(g.getState()));
    json.chains = { pkill: 99, a: 1, ghost: 2 };
    const clamped = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(clamped.chains).toEqual({ pkill: 3 });
  });
});
