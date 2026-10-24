/**
 * Circumvention, Infamy, action unlock rules and start costs, completion effects, toggleable auto-run and the node payout
 * multiplier. Expected outcomes are stated explicitly so the maths can change later without regressions.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num, numberFactory } from '../numbers';
import { killAction, legendAction, networkAction, setCredits, testConfig } from '../testing/testConfig';
import {
  Economy,
  type BuyableDefinition,
  applyCompletionEffects,
  createConfig,
  createInitialState,
  deserializeState,
  heatTaxFactor,
  serializeState,
  validateConfig,
} from './index';

const free = (id: string, actionId: string | undefined, effect: BuyableDefinition['effect'], extra = {}): BuyableDefinition => ({
  id,
  name: id,
  description: '',
  actionId,
  cost: num(1),
  effect,
  ...extra,
});
const autoOn = (actionId: string) => free('auto-' + actionId, actionId, { kind: 'autoRun' });

const game = (actions: (typeof testConfig.actions)[number][], buyables: BuyableDefinition[] = [], overrides = {}) =>
  createGame({ config: createConfig(testConfig, { actions, buyables, ...overrides }) });
const mutable = (g: { getState(): unknown }) =>
  g.getState() as {
    network: ReturnType<typeof num>;
    heat: number;
    infamy: number;
    circumvention: ReturnType<typeof num>;
    unlockedActions: Record<string, boolean>;
    autoRunOff: Record<string, boolean>;
  };

describe('heat tax with Circumvention', () => {
  it('removes a share of the heat effect: at 50% reduction credits stop at 200 heat, not 100', () => {
    expect(heatTaxFactor(100, 0)).toBe(0);
    expect(heatTaxFactor(100, 0.5)).toBeCloseTo(0.5, 10);
    expect(heatTaxFactor(150, 0.5)).toBeCloseTo(0.25, 10);
    expect(heatTaxFactor(200, 0.5)).toBe(0);
    expect(heatTaxFactor(250, 0.5)).toBe(0);
  });

  it('at 100% reduction heat never costs credits, however high', () => {
    expect(heatTaxFactor(1e9, 1)).toBe(1);
  });

  const economy = new Economy(testConfig, numberFactory);
  const sequential = (runs: number, heat: number, perRun: number, reduction: number) => {
    let total = 0;
    for (let i = 0; i < runs; i++) total += 10 * heatTaxFactor(heat + i * perRun, reduction);
    return total;
  };
  it.each([
    [50, 0, 1, 0.5],
    [300, 10, 1, 0.5],
    [10, 180, 2, 0.5],
    [100, 0, 3, 0.25],
    [40, 0, 5, 1],
  ])('closed-form credits for %i runs (heat %f, +%f per run, reduction %f) match paying run by run', (runs, heat, perRun, r) => {
    expect(economy.creditsForRuns(num(10), runs, heat, perRun, r).toNumber()).toBeCloseTo(sequential(runs, heat, perRun, r), 6);
  });

  it('credits still flow above 100 heat once reduced: heat 150 with a 50% reduction keeps 25%', () => {
    const g = game([testConfig.actions[0]!]);
    mutable(g).heat = 150;
    mutable(g).circumvention = num('1e100'); // 100 orders x 0.5% = 50% reduction
    expect(g.sleeveStats().heatReduction).toBeCloseTo(0.5, 10);
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.toNumber()).toBeCloseTo(0.125, 10); // 0.5 credits x 25%
  });

  it('and at 250 heat a 50% reduction earns nothing', () => {
    const g = game([testConfig.actions[0]!]);
    mutable(g).heat = 250;
    mutable(g).circumvention = num('1e100');
    g.startAction('a');
    g.tick(10_000);
    expect(g.getState().credits.isZero()).toBe(true);
  });
});

describe('Circumvention stat', () => {
  const boost = free('boost', 'a', { kind: 'circumventionMultiplier', factor: 2 }, { maxPurchases: Infinity, costGrowth: 100 });

  it('starts at 1 with no reduction', () => {
    const g = game([testConfig.actions[0]!], [boost]);
    expect(g.sleeveStats().circumvention.eq(num(1))).toBe(true);
    expect(g.sleeveStats().heatReduction).toBe(0);
  });

  it('is multiplied by every copy of the buyable (x2 each: 3 copies give 8)', () => {
    const g = game([testConfig.actions[0]!], [boost]);
    setCredits(g, num(1e6));
    for (let i = 0; i < 3; i++) expect(g.buy('boost')).toBe('purchased');
    expect(g.sleeveStats().circumvention.eq(num(8))).toBe(true);
    expect(g.sleeveStats().heatReduction).toBeCloseTo(0.005 * Math.log10(8), 10);
  });

  it('gives 0.5% per order of magnitude and is capped at 100% (1e200 and above)', () => {
    const g = game([testConfig.actions[0]!]);
    mutable(g).circumvention = num('1e100');
    expect(g.sleeveStats().heatReduction).toBeCloseTo(0.5, 10);
    mutable(g).circumvention = num('1e200');
    expect(g.sleeveStats().heatReduction).toBeCloseTo(1, 10);
    mutable(g).circumvention = num('1e300');
    expect(g.sleeveStats().heatReduction).toBe(1);
  });

  it('also lowers the tax on passive income', () => {
    const g = game([testConfig.actions[0]!]);
    mutable(g).network = num(100);
    mutable(g).heat = 50;
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.05 * 0.5, 10);
    mutable(g).circumvention = num('1e100');
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.05 * 0.75, 10);
  });
});

describe('action with a node-count unlock and a start cost (Kill servers)', () => {
  const kill = (buyables: BuyableDefinition[] = []) => game([testConfig.actions[0]!, killAction], buyables);

  it('is locked until the network reaches the node count', () => {
    const g = kill();
    mutable(g).network = num(999);
    expect(g.isUnlocked('kill')).toBe(false);
    expect(g.startAction('kill')).toBe(false);
    mutable(g).network = num(1000);
    expect(g.isUnlocked('kill')).toBe(true);
  });

  it('stays unlocked once reached, even when the network shrinks afterwards', () => {
    const g = kill();
    mutable(g).network = num(1000);
    g.tick(1);
    mutable(g).network = num(60);
    expect(g.isUnlocked('kill')).toBe(true);
  });

  it('pays 50 nodes when a run starts, once, and adds 1 Circumvention on completion', () => {
    const g = kill();
    mutable(g).unlockedActions['kill'] = true;
    mutable(g).network = num(60);
    expect(g.startAction('kill')).toBe(true);
    expect(g.getState().network.eq(num(10))).toBe(true);
    expect(g.startAction('kill')).toBe(true); // already running: nothing more is charged
    expect(g.getState().network.eq(num(10))).toBe(true);
    g.tick(1_000);
    expect(g.getState().circumvention.eq(num(2))).toBe(true);
  });

  it('does not start without enough nodes and then charges nothing', () => {
    const g = kill();
    mutable(g).unlockedActions['kill'] = true;
    mutable(g).network = num(49);
    expect(g.startAction('kill')).toBe(false);
    expect(g.getState().network.eq(num(49))).toBe(true);
    expect(g.getState().actions['kill']!.running).toBe(false);
  });

  it('with auto-run pays for every run and stops when the nodes run out', () => {
    const g = kill([autoOn('kill')]);
    mutable(g).unlockedActions['kill'] = true;
    mutable(g).network = num(120);
    setCredits(g, num(1));
    g.buy('auto-kill');
    g.tick(1_000); // pays 50, completes run 1, pays 50 for run 2
    expect(g.getState().circumvention.eq(num(2))).toBe(true);
    expect(g.getState().network.eq(num(20))).toBe(true);
    g.tick(1_000); // completes run 2, cannot pay for run 3
    expect(g.getState().circumvention.eq(num(3))).toBe(true);
    expect(g.getState().actions['kill']!.running).toBe(false);
    expect(g.getState().network.eq(num(20))).toBe(true);
  });

  it('completes one run per batch with auto-run: 3 s of auto-running costs 3 runs of nodes', () => {
    const g = kill([autoOn('kill')]);
    mutable(g).unlockedActions['kill'] = true;
    mutable(g).network = num(500);
    setCredits(g, num(1));
    g.buy('auto-kill');
    g.tick(3_000);
    expect(g.getState().circumvention.eq(num(4))).toBe(true);
    expect(g.getState().network.eq(num(500 - 4 * 50))).toBe(true); // 3 completed + 1 paid for the next
  });

  it('re-sleeving resets Circumvention and the remembered unlock', () => {
    const g = kill();
    mutable(g).network = num(1000);
    g.tick(1);
    mutable(g).circumvention = num(50);
    g.resleeve();
    expect(g.getState().circumvention.eq(num(1))).toBe(true);
    expect(g.isUnlocked('kill')).toBe(false);
  });
});

describe('action unlocked by a buyable with completion effects (Legend)', () => {
  const unlock = free('unlock', undefined, { kind: 'unlock' });
  const legend = (buyables: BuyableDefinition[] = []) => game([testConfig.actions[0]!, legendAction], [unlock, ...buyables]);

  it('is locked until the buyable is owned', () => {
    const g = legend();
    expect(g.isUnlocked('legend')).toBe(false);
    expect(g.startAction('legend')).toBe(false);
    setCredits(g, num(1));
    g.buy('unlock');
    expect(g.isUnlocked('legend')).toBe(true);
  });

  it('a run removes 25% of the nodes, adds 50 heat and adds 1 Infamy', () => {
    const g = legend();
    setCredits(g, num(1));
    g.buy('unlock');
    mutable(g).network = num(1000);
    mutable(g).heat = 10;
    g.startAction('legend');
    g.tick(1_000);
    expect(g.getState().network.toNumber()).toBeCloseTo(750, 8);
    expect(g.getState().heat).toBe(60); // 10 + 50
    expect(g.getState().infamy).toBeCloseTo(1, 4); // minus the tiny decay of the tick
  });

  it('several runs in one batch apply the effects that many times (2 runs: 1000 -> 750 -> 563 whole nodes)', () => {
    const g = legend([autoOn('legend')]);
    setCredits(g, num(2));
    g.buy('unlock');
    g.buy('auto-legend');
    mutable(g).network = num(1000);
    g.tick(2_000);
    expect(g.getState().network.toNumber()).toBe(563);
    expect(g.getState().infamy).toBe(2);
    expect(g.getState().heat).toBe(100); // 2 runs x 50
  });

  it('adds heat on top of whatever there already is, however high', () => {
    const g = legend();
    setCredits(g, num(1));
    g.buy('unlock');
    mutable(g).heat = 900;
    g.startAction('legend');
    g.tick(1_000);
    expect(g.getState().heat).toBe(950);
  });
});

describe('applyCompletionEffects', () => {
  it('applies the listed effects in closed form for several runs', () => {
    const state = { network: num(1000), heat: 3 };
    applyCompletionEffects(legendAction.completionEffects, state, 2, numberFactory);
    expect(state.network.toNumber()).toBe(563);
    expect(state.heat).toBe(103); // 3 + 2 runs x 50
  });

  it('does nothing without effects', () => {
    const state = { network: num(10), heat: 3 };
    applyCompletionEffects(undefined, state, 5, numberFactory);
    expect(state.network.eq(num(10))).toBe(true);
    expect(state.heat).toBe(3);
  });
});

describe('Infamy', () => {
  const idle = () => game([testConfig.actions[0]!]);

  it('slows heat cooldown by 10% per point: 5 Infamy turns a 60 s cycle into 90 s', () => {
    const g = idle();
    mutable(g).heat = 5;
    mutable(g).infamy = 5;
    g.tick(60_000);
    expect(g.getState().heat).toBe(5);
    g.tick(30_000);
    expect(g.getState().heat).toBe(4);
  });

  it('without Infamy a cycle is the normal 60 s', () => {
    const g = idle();
    mutable(g).heat = 5;
    g.tick(60_000);
    expect(g.getState().heat).toBe(4);
  });

  it('falls by exactly 1 each time a 10 minute cycle completes, never gradually', () => {
    const g = idle();
    mutable(g).infamy = 3;
    g.tick(599_999);
    expect(g.getState().infamy).toBe(3);
    expect(g.getState().infamyCooldownMs).toBe(599_999);
    g.tick(1);
    expect(g.getState().infamy).toBe(2);
    expect(g.getState().infamyCooldownMs).toBe(0);
  });

  it('does not run the cycle while Infamy is 0', () => {
    const g = idle();
    g.tick(900_000);
    expect(g.getState().infamyCooldownMs).toBe(0);
  });

  it('falls by 1 every 10 minutes and never below 0', () => {
    const g = idle();
    mutable(g).infamy = 3;
    g.tick(600_000);
    expect(g.getState().infamy).toBe(2);
    g.tick(600_000 * 10);
    expect(g.getState().infamy).toBe(0);
  });

  it('is reset by re-sleeving', () => {
    const g = idle();
    mutable(g).infamy = 4;
    g.resleeve();
    expect(g.getState().infamy).toBe(0);
  });
});

describe('toggleable auto-run', () => {
  const auto = free('auto', 'a', { kind: 'autoRun' });
  const bought = () => {
    const g = game([testConfig.actions[0]!], [auto, free('plain', 'a', { kind: 'outputMultiplier', factor: 2 })]);
    setCredits(g, num(5));
    g.buy('auto');
    return g;
  };

  it('is on after purchase and can be switched off and on again', () => {
    const g = bought();
    expect(g.isAutoRun('a')).toBe(true);
    expect(g.toggleAutoRun('auto')).toBe(false);
    expect(g.isAutoRun('a')).toBe(false);
    expect(g.isAutoRunEnabled('auto')).toBe(false);
    expect(g.toggleAutoRun('auto')).toBe(true);
    expect(g.isAutoRun('a')).toBe(true);
  });

  it('switched off, the action stops after a run instead of restarting', () => {
    const g = bought();
    g.toggleAutoRun('auto');
    g.startAction('a');
    g.tick(25_000);
    expect(g.getState().actions['a']!.running).toBe(false);
    expect(g.getState().credits.toNumber()).toBeCloseTo(4 + 0.5, 8); // 5 - 1 for auto, one run paid 0.5
  });

  it('switched on, the action keeps running by itself', () => {
    const g = bought();
    g.tick(25_000);
    expect(g.getState().actions['a']!.running).toBe(true);
  });

  it('refuses to toggle what is not owned or not an auto-run, and changes nothing', () => {
    const g = game([testConfig.actions[0]!], [auto, free('plain', 'a', { kind: 'outputMultiplier', factor: 2 })]);
    expect(g.toggleAutoRun('auto')).toBe(false);
    expect(mutable(g).autoRunOff).toEqual({});
    setCredits(g, num(5));
    g.buy('plain');
    expect(g.toggleAutoRun('plain')).toBe(false);
    expect(mutable(g).autoRunOff).toEqual({});
  });

  it('re-sleeving removes the purchase and its switch', () => {
    const g = bought();
    g.toggleAutoRun('auto');
    g.resleeve();
    expect(mutable(g).autoRunOff).toEqual({});
    expect(g.ownedCount('auto')).toBe(0);
  });
});

describe('node payout multiplier', () => {
  const payout = free('payout', undefined, { kind: 'nodePayoutMultiplier', factor: 1.5 }, { costGrowth: 100_000, maxPurchases: Infinity });

  it('compounds per copy: 2 copies give x2.25 credits per node', () => {
    const g = game([testConfig.actions[0]!], [payout]);
    setCredits(g, num(1e6));
    g.buy('payout');
    g.buy('payout');
    mutable(g).network = num(100);
    expect(g.sleeveStats().nodePayoutMultiplier).toBeCloseTo(2.25, 10);
    expect(g.passiveCreditsPerSecond().toNumber()).toBeCloseTo(100 * 0.05 * 2.25, 10);
  });

  it('each copy costs 100,000x more', () => {
    const g = game([testConfig.actions[0]!], [payout]);
    setCredits(g, num(1e6));
    g.buy('payout');
    expect(g.costOf('payout').eq(num(1e5))).toBe(true);
  });
});

describe('saving the newer stats', () => {
  const config = createConfig(testConfig, {
    actions: [testConfig.actions[0]!, killAction],
    buyables: [autoOn('a')],
  });
  const withState = () => {
    const state = createInitialState(config, numberFactory);
    state.circumvention = num(7);
    state.infamy = 3;
    state.unlockedActions['kill'] = true;
    state.purchased['auto-a'] = 1;
    state.autoRunOff['auto-a'] = true;
    return state;
  };

  it('round-trips Circumvention, Infamy, unlocked actions and auto-run switches', () => {
    const restored = deserializeState(serializeState(withState()), config, numberFactory)!;
    expect(restored.circumvention.eq(num(7))).toBe(true);
    expect(restored.infamy).toBe(3);
    expect(restored.unlockedActions).toEqual({ kill: true });
    expect(restored.autoRunOff).toEqual({ 'auto-a': true });
  });

  it('an older save without them loads with fresh-game values', () => {
    const json = JSON.parse(serializeState(withState()));
    for (const key of ['circumvention', 'infamy', 'unlockedActions', 'autoRunOff']) delete json[key];
    const restored = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(restored.circumvention.eq(num(1))).toBe(true);
    expect(restored.infamy).toBe(0);
    expect(restored.unlockedActions).toEqual({});
    expect(restored.autoRunOff).toEqual({});
  });

  it('sanitises tampered values', () => {
    const json = JSON.parse(serializeState(withState()));
    json.infamy = -3;
    json.circumvention = '0.5';
    json.unlockedActions = { kill: true, a: true, ghost: true }; // only actions with a node-count rule can be remembered
    json.autoRunOff = { 'auto-a': true, ghost: true };
    const restored = deserializeState(JSON.stringify(json), config, numberFactory)!;
    expect(restored.infamy).toBe(0);
    expect(restored.circumvention.eq(num(1))).toBe(true);
    expect(restored.unlockedActions).toEqual({ kill: true });
    expect(restored.autoRunOff).toEqual({ 'auto-a': true });
  });
});

describe('validation of the newer settings', () => {
  const invalid = (overrides: object) => validateConfig(createConfig(testConfig, overrides)).join('|');

  it('rejects bad unlock rules, start costs and completion effects', () => {
    const action = (extra: object) => ({ ...testConfig.actions[0]!, ...extra });
    expect(invalid({ actions: [action({ unlock: { kind: 'nodes', amount: 0 } })] })).toContain('unlock node count');
    expect(invalid({ actions: [action({ unlock: { kind: 'buyable', buyableId: 'ghost' } })] })).toContain('unknown buyable "ghost"');
    expect(invalid({ actions: [action({ startCost: { currency: 'gold', amount: num(1) } })] })).toContain('unknown currency');
    expect(invalid({ actions: [action({ startCost: { currency: 'credits', amount: num(-1) } })] })).toContain('startCost amount');
    expect(invalid({ actions: [action({ completionEffects: [{ kind: 'removeNodesFraction', fraction: 2 }] })] })).toContain(
      'between 0 and 1',
    );
    expect(invalid({ actions: [action({ completionEffects: [{ kind: 'addHeat', heat: -1 }] })] })).toContain('addHeat');
    expect(invalid({ actions: [action({ rewardKind: 'gold' })] })).toContain('unknown rewardKind');
  });

  it('rejects bad multipliers and sleeve settings', () => {
    const buyable = (effect: BuyableDefinition['effect']) => ({ buyables: [free('x', undefined, effect)] });
    expect(invalid(buyable({ kind: 'nodePayoutMultiplier', factor: 0.5 }))).toContain('factor must be >= 1');
    expect(invalid(buyable({ kind: 'circumventionMultiplier', factor: 0 }))).toContain('factor must be >= 1');
    const sleeve = {
      ...testConfig.sleeve,
      baseCircumvention: 0,
      infamyHeatSlowdown: -1,
      infamyDecayPeriodMs: 0,
      circumventionReductionPerOrder: -1,
    };
    const text = invalid({ sleeve });
    for (const part of ['baseCircumvention', 'infamyHeatSlowdown', 'infamyDecayPeriodMs', 'circumventionReductionPerOrder']) {
      expect(text).toContain(part);
    }
  });

  it('accepts the test actions', () => {
    expect(
      invalid({
        actions: [testConfig.actions[0]!, killAction, legendAction, networkAction],
        buyables: [free('unlock', undefined, { kind: 'unlock' })],
      }),
    ).toBe('');
  });
});
