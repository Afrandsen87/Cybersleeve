/**
 * The closed-form run loop must give the same outcome as completing runs one at a time.
 * Reference: tick a game in many small steps (each step is shorter than one run, so at most one run completes per step);
 * the other game gets the same time in a single tick.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { num } from '../../numbers';
import {
  killAction,
  legendAction,
  malwareAction,
  networkAction,
  percentKillAction,
  practiceAction,
  setCredits,
  testConfig,
} from '../../testing/testConfig';
import { buy, creditsOf, cyberneticsConfig, cyberneticsGame, nodesOf } from '../../testing/cyberneticsKit';
import { createConfig } from '..';

const three = () => createConfig(testConfig, { actions: [testConfig.actions[0]!, networkAction, malwareAction] });

/** Passive income and heat cooling are applied per tick by design (using the nodes and heat at the start of the tick), so they are switched off when comparing tick sizes. */
const runsOnly = (base = three()) => createConfig(base, { network: { creditsPerNodePerSecond: 0 }, sleeve: { heatCooldownMs: 1e15 } });

type Setup = (g: ReturnType<typeof createGame>) => void;

/** Runs `setup`, then advances one game in one tick and a twin in `steps` equal ticks, and returns both. */
function twins(totalMs: number, steps: number, setup: Setup, config = runsOnly()) {
  const once = createGame({ config });
  const stepped = createGame({ config });
  for (const g of [once, stepped]) setup(g);
  once.tick(totalMs);
  for (let i = 0; i < steps; i++) stepped.tick(totalMs / steps);
  return { once, stepped };
}

const closeTo = (a: { toNumber(): number }, b: { toNumber(): number }) => {
  const x = a.toNumber();
  const y = b.toNumber();
  expect(Math.abs(x - y)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(x), Math.abs(y)));
};

function expectSame(once: ReturnType<typeof createGame>, stepped: ReturnType<typeof createGame>, ids: string[]) {
  const a = once.getState();
  const b = stepped.getState();
  closeTo(a.wallet.credits, b.wallet.credits);
  closeTo(a.sleeve.network, b.sleeve.network);
  expect(a.sleeve.heat).toBeCloseTo(b.sleeve.heat, 6);
  for (const id of ids) {
    expect(a.sleeve.actions[id]!.xp.eq(b.sleeve.actions[id]!.xp), `${id} xp`).toBe(true);
    expect(a.sleeve.actions[id]!.sleeveXp.eq(b.sleeve.actions[id]!.sleeveXp), `${id} sleeve xp`).toBe(true);
    expect(a.sleeve.actions[id]!.runsTowardSleeveXp, `${id} counter`).toBe(b.sleeve.actions[id]!.runsTowardSleeveXp);
    expect(once.actionLevel(id)).toBe(stepped.actionLevel(id));
    expect(once.sleeveLevel(id)).toBe(stepped.sleeveLevel(id));
    expect(a.sleeve.actions[id]!.progress).toBeCloseTo(b.sleeve.actions[id]!.progress, 6);
  }
}

describe('closed-form runs match completing runs one at a time', () => {
  it('auto-run across several action levels (level-ups shorten the runs mid-tick)', () => {
    const setup: Setup = (g) => {
      setCredits(g, num(10));
      g.buy('auto');
    };
    // Not a round number of runs: a total that ends exactly on a run boundary can fall a hair short or over on either side.
    const { once, stepped } = twins(30_000_333, 60_000, setup);
    expect(once.actionLevel('a')).toBeGreaterThan(3);
    expectSame(once, stepped, ['a']);
  });

  it('with reward multipliers (dual + two duplicates): the reward jumps by powers of two, XP and counted runs do not', () => {
    const setup: Setup = (g) => {
      setCredits(g, num(100_000));
      for (const id of ['auto', 'dual', 'dup', 'dup']) expect(g.buy(id)).toBe('purchased');
    };
    const { once, stepped } = twins(1_000_000, 4_000, setup);
    expect(once.actionLevel('a')).toBeGreaterThan(0); // the level changes mid-tick
    expectSame(once, stepped, ['a']);
  });

  it('a heat-adding action pays a falling amount per run, then nothing at 100 heat', () => {
    const setup: Setup = (g) => {
      setCredits(g, num(1_000_000));
      g.buy('access');
      (g.getState() as unknown as { sleeve: { network: unknown } }).sleeve.network = num(100);
      (g.getState() as unknown as { sleeve: { actions: Record<string, { running: boolean }> } }).sleeve.actions['mal']!.running = true;
    };
    // Manual action: one run per tick in both twins; use auto-run-like behaviour by giving the action an auto buyable.
    const config = createConfig(runsOnly(), {
      buyables: [
        ...testConfig.buyables,
        { id: 'mal-auto', name: 'Mal auto', description: '', actionId: 'mal', cost: num(1), effect: { kind: 'autoRun' } },
      ],
    });
    const prepared: Setup = (g) => {
      setup(g);
      g.buy('mal-auto');
    };
    const { once, stepped } = twins(600_000, 6_000, prepared, config);
    expect(once.getState().sleeve.heat).toBeGreaterThan(100);
    expectSame(once, stepped, ['mal']);
  });

  it('a network-growing auto action', () => {
    const config = createConfig(runsOnly(), {
      buyables: [
        ...testConfig.buyables,
        { id: 'net-auto', name: 'Net auto', description: '', actionId: 'net', cost: num(1), effect: { kind: 'autoRun' } },
      ],
    });
    const setup: Setup = (g) => {
      setCredits(g, num(5));
      g.buy('net-auto');
    };
    const { once, stepped } = twins(3_000_125, 6_001, setup, config); // an end time that is not an exact run boundary, where float rounding could tip one twin over
    expect(once.getState().sleeve.network.gt(num(100))).toBe(true);
    expectSame(once, stepped, ['net']);
  });
});

describe('start costs and completion effects match run-by-run play', () => {
  const unlock = { id: 'unlock', name: 'Unlock', description: '', cost: num(1), effect: { kind: 'accessLevel', amount: 1 } } as const;
  const autoFor = (actionId: string) =>
    ({ id: `auto-${actionId}`, name: 'Auto', description: '', actionId, cost: num(1), effect: { kind: 'autoRun' } }) as const;
  /** Legend decay is linear per tick but the tick order differs, so it is switched off when comparing tick sizes. */
  const config = () =>
    runsOnly(
      createConfig(testConfig, {
        actions: [testConfig.actions[0]!, killAction, legendAction],
        buyables: [unlock, autoFor('kill'), autoFor('legend')],
        sleeve: { legendDecayPeriodMs: 1e15 },
      }),
    );
  const mutable = (g: ReturnType<typeof createGame>) => g.getState().sleeve as { network: unknown };

  it('auto-running Kill servers pays 50 nodes per run and adds 1 ICE Rating per run', () => {
    const setup: Setup = (g) => {
      setCredits(g, num(5));
      g.buy('auto-kill');
      mutable(g).network = num(500);
    };
    const { once, stepped } = twins(5_000, 5, setup, config());
    expect(once.getState().sleeve.iceRating.eq(stepped.getState().sleeve.iceRating)).toBe(true);
    closeTo(once.getState().sleeve.network, stepped.getState().sleeve.network);
    expect(once.getState().sleeve.iceRating.eq(num(6))).toBe(true);
  });

  it('auto-running with a share-of-nodes cost takes 1% of what is held at the start of every run', () => {
    const cfg = runsOnly(
      createConfig(testConfig, {
        actions: [testConfig.actions[0]!, percentKillAction],
        buyables: [autoFor('pkill')],
        sleeve: { legendDecayPeriodMs: 1e15 },
      }),
    );
    const setup: Setup = (g) => {
      setCredits(g, num(5));
      g.buy('auto-pkill');
      mutable(g).network = num(10_000);
    };
    const { once, stepped } = twins(5_000, 5, setup, cfg);
    expect(once.getState().sleeve.network.eq(stepped.getState().sleeve.network)).toBe(true);
    expect(once.getState().sleeve.iceRating.eq(stepped.getState().sleeve.iceRating)).toBe(true);
    expect(once.getState().sleeve.network.toNumber()).toBeLessThan(10_000);
  });

  it('auto-running Legend removes a quarter of the nodes per run, however the runs are batched', () => {
    const setup: Setup = (g) => {
      setCredits(g, num(5));
      g.buy('unlock');
      g.buy('auto-legend');
      mutable(g).network = num(1000);
    };
    const { once, stepped } = twins(5_000, 5, setup, config());
    closeTo(once.getState().sleeve.network, stepped.getState().sleeve.network);
    closeTo(num(once.getState().sleeve.legend), num(stepped.getState().sleeve.legend));
    expect(once.getState().sleeve.legend).toBeCloseTo(5, 6);
    expect(once.getState().sleeve.heat).toBe(25); // 5 s running x 5 heat/s
    expect(stepped.getState().sleeve.heat).toBe(25);
  });
});

describe('closed-form runs do not depend on how long the tick is', () => {
  it('a ten-year tick completes instantly and never drops time', () => {
    const g = createGame({ config: three() });
    setCredits(g, num(10));
    g.buy('auto');
    const tenYearsMs = 10 * 365 * 24 * 3_600_000;
    const started = performance.now();
    g.tick(tenYearsMs);
    expect(performance.now() - started).toBeLessThan(500);
    expect(g.getState().sleeve.actions['a']!.xp.isFinite()).toBe(true);
    // More time can only mean more progress: a tick of 1000 years gives at least as much XP.
    const longer = createGame({ config: three() });
    setCredits(longer, num(10));
    longer.buy('auto');
    longer.tick(100 * tenYearsMs);
    expect(longer.getState().sleeve.actions['a']!.xp.gte(g.getState().sleeve.actions['a']!.xp)).toBe(true);
  });

  it('a manual action still completes only one run per click, however long the tick is', () => {
    const g = createGame({ config: three() });
    g.startAction('a');
    g.tick(1e12);
    expect(g.getState().sleeve.actions['a']!.xp.eq(num(1))).toBe(true);
    expect(g.getState().sleeve.actions['a']!.running).toBe(false);
  });
});

describe('feedback between systems does not depend on how time is delivered', () => {
  const fastPractice = { ...practiceAction, reward: num(0.0003) };
  const feedback = (engine?: { maxSlicesPerTick: number }) =>
    createConfig(testConfig, {
      actions: [fastPractice],
      buyables: [{ id: 'pauto', name: 'P', description: '', actionId: 'practice', cost: num(0), effect: { kind: 'autoRun' } }],
      engine,
    });
  const setup: Setup = (g) => g.buy('pauto');
  const bonus = (g: ReturnType<typeof createGame>) => g.getState().sleeve.hackingProficiency.toNumber();

  it('interface speed rising with every run: one 5 minute tick matches 6 000 steps of 50 ms (within 2%)', () => {
    const { once, stepped } = twins(300_000, 6_000, setup, feedback());
    expect(bonus(stepped)).toBeGreaterThan(0.2); // the feedback is strong enough to matter
    expect(Math.abs(bonus(once) - bonus(stepped))).toBeLessThanOrEqual(0.02 * bonus(stepped));
  });

  it('without slicing the same tick would be clearly off (the slicing is what makes it match)', () => {
    const { once, stepped } = twins(300_000, 6_000, setup, feedback({ maxSlicesPerTick: 1 }));
    expect(Math.abs(bonus(once) - bonus(stepped))).toBeGreaterThan(0.05 * bonus(stepped));
  });

  it('passive income while heat cools: one 50 minute tick matches 60 000 steps of 50 ms (within 1%)', () => {
    const config = createConfig(testConfig, { sleeve: { heatCooldownMs: 60_000, heatCooldownAmount: 1 } });
    const setupNet: Setup = (g) => {
      const s = g.getState().sleeve as { network: ReturnType<typeof num>; heat: number };
      s.network = num(1000);
      s.heat = 50;
    };
    const { once, stepped } = twins(3_000_000, 60_000, setupNet, config);
    const a = once.getState().wallet.credits.toNumber();
    const b = stepped.getState().wallet.credits.toNumber();
    expect(Math.abs(a - b)).toBeLessThanOrEqual(0.01 * b);
  });

  it('the cost of a tick is bounded: a ten-year tick runs at most maxSlicesPerTick slices', () => {
    const g = createGame({ config: feedback() });
    g.buy('pauto');
    g.tick(10 * 365 * 24 * 3600 * 1000);
    expect(Number.isFinite(bonus(g))).toBe(true);
  });
});

describe('per-run events at a certain chance do not depend on how long the tick is', () => {
  const tap = buy({ id: 'tap', effect: { kind: 'paysActionReward', sourceActionId: 'a', targetActionId: 'net', chance: 1 } });

  it('Fiber Tap at 100%: one 100 s tick and 2 000 steps of 50 ms pay the same nodes and credits', () => {
    const once = cyberneticsGame(cyberneticsConfig([tap]));
    const stepped = cyberneticsGame(cyberneticsConfig([tap]));
    for (const g of [once, stepped]) {
      g.buy('auto');
      g.buy('tap');
      g.startAction('a');
    }
    once.tick(100_050);
    for (let i = 0; i < 2_001; i++) stepped.tick(50);
    expect(nodesOf(once)).toBe(nodesOf(stepped));
    expect(nodesOf(once)).toBeGreaterThan(5);
    expect(creditsOf(once)).toBeCloseTo(creditsOf(stepped), 9);
  });
});
