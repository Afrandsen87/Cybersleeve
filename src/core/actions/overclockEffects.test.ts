import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num, numberFactory } from '../../numbers';
import { findInvariantViolations } from '../../testing/invariants';
import { networkAction, payoutAction, practiceAction, setCredits, testConfig } from '../../testing/testConfig';
import { createConfig, deserializeState, serializeState, validateConfig, type BuyableDefinition, type GameConfig } from '..';

/** Practice-style rule: pays 200% more, costs 5 nodes per completed run. */
const PRACTICE_RULE = { rewardBonus: 2, completionEffects: [{ kind: 'removeNodes', amount: 5 }] } as const;
/** Push-style rule: each run also pays the nodes of one 'net' run, and makes three times as much heat. */
const PUSH_RULE = { alsoPays: 'net', heatPerRunFactor: 3 } as const;

const unlock = (actionId: string): BuyableDefinition => ({
  id: `oc-${actionId}`,
  name: 'Overclock',
  description: '',
  actionId,
  cost: num(1),
  effect: { kind: 'overclockUnlock' },
});

/** Makes every Overclock 10% stronger per copy. */
const strength = (): BuyableDefinition => ({
  id: 'ocs',
  name: 'Overclock upgrade',
  description: '',
  cost: num(1),
  costGrowth: 10,
  maxPurchases: Infinity,
  effect: { kind: 'overclockStrength', perCopy: 0.1 },
});

const netTwice: BuyableDefinition = {
  id: 'net-x2',
  name: 'x2',
  description: '',
  actionId: 'net',
  cost: num(1),
  effect: { kind: 'rewardMultiplier', factor: 2 },
};

/** Levels are pushed out of reach so that every run takes exactly its base time (1 s for practice and push). */
function configWith(over: { practice?: object; push?: object } = {}): GameConfig {
  const base = createConfig(testConfig, {
    buyables: [...testConfig.buyables, unlock('practice'), unlock('push'), strength(), netTwice],
    progression: { actionLevels: { firstLevelXp: 1e12, growthFactor: 10 }, sleeveLevels: { firstLevelXp: 1e12, growthFactor: 10 } },
    network: { creditsPerNodePerSecond: 0 },
  });
  return createConfig(base, {
    actions: [
      base.actions[0]!,
      { ...networkAction, baseDurationMs: 1_000 },
      { ...practiceAction, overclock: PRACTICE_RULE, ...over.practice },
      { ...payoutAction, overclock: PUSH_RULE, ...over.push },
    ],
  });
}

function game(config = configWith()) {
  const g = createGame({ config });
  setCredits(g, num(1e9));
  return g;
}

type Mutable = { network: unknown; heat: number };
const setNodes = (g: ReturnType<typeof game>, n: number): void => {
  (g.getState() as unknown as Mutable).network = num(n);
};
const nodes = (g: ReturnType<typeof game>): number => g.getState().network.toNumber();
const proficiency = (g: ReturnType<typeof game>): number => g.getState().hackingProficiency.toNumber();
const runs = (g: ReturnType<typeof game>, id: string): number => g.getState().actions[id]!.xp.toNumber();

/** Runs an action for a whole number of its 1 s runs (auto-run, so the batch maths is the one under test). */
function run(g: ReturnType<typeof game>, id: string, seconds: number): void {
  const auto = { practice: 'practice-auto', push: 'push-auto' }[id];
  if (auto) g.buy(auto);
  g.startAction(id);
  g.tick(seconds * 1_000 + 1);
}

function withAuto(config: GameConfig): GameConfig {
  const auto = (id: string): BuyableDefinition => ({
    id: `${id}-auto`,
    name: 'Auto',
    description: '',
    actionId: id,
    cost: num(1),
    effect: { kind: 'autoRun' },
  });
  return createConfig(config, { buyables: [...config.buyables, auto('practice'), auto('push')] });
}

describe('Overclock that pays more and costs nodes (Practice Hacking style)', () => {
  const make = () => {
    const g = game(withAuto(configWith()));
    g.buy('oc-practice');
    setNodes(g, 1_000);
    return g;
  };

  it('off: pays the ordinary reward and costs no nodes', () => {
    const g = make();
    run(g, 'practice', 10);
    expect(runs(g, 'practice')).toBe(10);
    expect(proficiency(g)).toBeCloseTo(10 * 0.001, 9);
    expect(nodes(g)).toBe(1_000);
  });

  it('on: pays 200 percent more (x3) and costs 5 nodes for each completed run', () => {
    const g = make();
    g.toggleOverclock('practice');
    run(g, 'practice', 10);
    expect(runs(g, 'practice')).toBe(10);
    expect(proficiency(g)).toBeCloseTo(10 * 0.003, 9);
    expect(nodes(g)).toBe(1_000 - 50);
  });

  it('does not change the speed, the XP or the counted runs', () => {
    const g = make();
    const speed = g.currentSpeed('practice');
    const xp = g.xpPerRun('practice').toNumber();
    g.toggleOverclock('practice');
    expect(g.currentSpeed('practice')).toBe(speed);
    expect(g.xpPerRun('practice').toNumber()).toBe(xp);
  });

  it('shows the bigger reward: the reward multiplier of the action is x3 while it is on', () => {
    const g = make();
    expect(g.rewardMultiplier('practice').toNumber()).toBe(1);
    g.toggleOverclock('practice');
    expect(g.rewardMultiplier('practice').toNumber()).toBeCloseTo(3, 12);
    expect(g.payoutPerRun('practice').toNumber()).toBeCloseTo(0.003, 12);
  });

  it('never takes the network below 0: 12 nodes and 10 runs leave 0', () => {
    const g = make();
    setNodes(g, 12);
    g.toggleOverclock('practice');
    run(g, 'practice', 10);
    expect(nodes(g)).toBe(0);
    expect(findInvariantViolations(g.getState(), configWith())).toEqual([]);
  });

  it('costs nothing while nothing completes: a switched-on action that has not finished a run keeps its nodes', () => {
    const g = make();
    g.toggleOverclock('practice');
    g.startAction('practice');
    g.tick(500);
    expect(nodes(g)).toBe(1_000);
  });

  it('a stronger Overclock pays more (200% x 1.1 = 220% more) but the node cost stays at 5', () => {
    const g = make();
    g.buy('ocs'); // strength 1.1
    g.toggleOverclock('practice');
    expect(g.rewardMultiplier('practice').toNumber()).toBeCloseTo(3.2, 12);
    run(g, 'practice', 10);
    expect(proficiency(g)).toBeCloseTo(10 * 0.001 * 3.2, 9);
    expect(nodes(g)).toBe(1_000 - 50);
  });

  it('one long tick and many short ones give the same result', () => {
    const one = make();
    one.toggleOverclock('practice');
    run(one, 'practice', 60);
    const many = make();
    many.toggleOverclock('practice');
    many.buy('practice-auto');
    many.startAction('practice');
    for (let i = 0; i < 1_200; i++) many.tick(50);
    expect(nodes(many)).toBe(nodes(one));
    expect(proficiency(many)).toBeCloseTo(proficiency(one), 6);
  });
});

describe('Overclock that also pays another action and multiplies heat (Push malware style)', () => {
  const make = () => {
    const g = game(withAuto(configWith()));
    g.buy('oc-push');
    return g;
  };

  it('off: the action adds its own heat and pays no nodes', () => {
    const g = make();
    run(g, 'push', 5);
    expect(g.getState().heat).toBeCloseTo(5, 9);
    expect(nodes(g)).toBe(0);
  });

  it('on: each run pays the nodes of one Grow-style run, and three times as much heat', () => {
    const g = make();
    g.toggleOverclock('push');
    run(g, 'push', 5);
    expect(runs(g, 'push')).toBe(5);
    expect(nodes(g)).toBe(5);
    expect(g.getState().heat).toBeCloseTo(15, 9);
  });

  it('pays the other action as if it had completed: its reward multipliers count, its XP and runs do not', () => {
    const g = make();
    g.buy('net-x2'); // the other action pays 2 nodes per run
    g.toggleOverclock('push');
    run(g, 'push', 5);
    expect(nodes(g)).toBe(10);
    expect(runs(g, 'net')).toBe(0);
    expect(g.getState().actions['net']!.running).toBe(false);
  });

  it('does not change what the action itself pays or its speed', () => {
    const g = make();
    const speed = g.currentSpeed('push');
    const pay = g.payoutPerRun('push').toNumber();
    g.toggleOverclock('push');
    expect(g.currentSpeed('push')).toBe(speed);
    expect(g.payoutPerRun('push').toNumber()).toBe(pay);
    expect(g.rewardMultiplier('push').toNumber()).toBe(1);
  });

  it('a stronger Overclock does not change the extra payment or the heat factor', () => {
    const g = make();
    g.buy('ocs');
    g.buy('ocs');
    g.toggleOverclock('push');
    run(g, 'push', 5);
    expect(nodes(g)).toBe(5);
    expect(g.getState().heat).toBeCloseTo(15, 9);
  });

  it('switched off again, the next runs are ordinary', () => {
    const g = make();
    g.toggleOverclock('push');
    g.toggleOverclock('push');
    run(g, 'push', 4);
    expect(nodes(g)).toBe(0);
    expect(g.getState().heat).toBeCloseTo(4, 9);
  });

  it('one long tick and many short ones give the same nodes and heat', () => {
    const one = make();
    one.toggleOverclock('push');
    run(one, 'push', 60);
    const many = make();
    many.toggleOverclock('push');
    many.buy('push-auto');
    many.startAction('push');
    for (let i = 0; i < 1_200; i++) many.tick(50);
    expect(nodes(many)).toBe(nodes(one));
    expect(many.getState().heat).toBeCloseTo(one.getState().heat, 4);
  });
});

describe('every action keeps its own Overclock', () => {
  it('switching one on leaves the others as they were', () => {
    const g = game(withAuto(configWith()));
    g.buy('oc-practice');
    g.buy('oc-push');
    g.toggleOverclock('practice');
    expect(g.overclockStatus('push')!.on).toBe(false);
    expect(g.overclockStatus('practice')!.on).toBe(true);
    expect(g.overclockStatus('net')).toBeNull(); // no rule, no toggle
  });

  it('the switches survive a save', () => {
    const config = withAuto(configWith());
    const g = game(config);
    g.buy('oc-push');
    g.toggleOverclock('push');
    const restored = deserializeState(serializeState(g.getState()), config, numberFactory)!;
    expect(restored.overclocked).toEqual({ push: true });
  });
});

describe('validation of the extended Overclock rule', () => {
  const problems = (rule: object): string => {
    const base = configWith();
    return validateConfig(createConfig(base, { actions: [{ ...base.actions[0]!, overclock: rule }, ...base.actions.slice(1)] })).join('|');
  };

  it('the test content is valid', () => {
    expect(validateConfig(configWith())).toEqual([]);
  });

  it.each([
    [{ rewardBonus: 0 }, 'overclock rewardBonus must be > 0'],
    [{ speedBonus: -1 }, 'overclock speedBonus must be > 0'],
    [{ heatPerRunFactor: 0.5 }, 'overclock heatPerRunFactor must be >= 1'],
    [{ heatPerMinute: -1 }, 'overclock heatPerMinute must be >= 0'],
    [{ alsoPays: 'ghost' }, 'alsoPays refers to unknown action "ghost"'],
    [{ alsoPays: 'a' }, 'alsoPays cannot be the action itself'],
    [{ completionEffects: [{ kind: 'removeNodes', amount: 0 }] }, 'removeNodes amount must be an integer >= 1'],
    [{ completionEffects: [{ kind: 'removeNodes', amount: 1.5 }] }, 'removeNodes amount must be an integer >= 1'],
    [{}, 'overclock needs at least one effect'],
  ])('rejects a bad rule %j', (rule, message) => {
    expect(problems(rule)).toContain(message);
  });
});
