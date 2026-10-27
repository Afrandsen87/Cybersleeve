import { describe, expect, it } from 'vitest';
import { buy, creditsOf, cyberneticsConfig, cyberneticsGame, nodesOf } from '../testing/cyberneticsKit';
import { validateConfig } from './index';
import { LinkedPayouts } from './linkedPayouts';
import type { PaysActionRule } from './types';

describe('LinkedPayouts', () => {
  const rule = (chance: number): PaysActionRule => ({ sourceActionId: 'a', targetActionId: 'net', chance });
  const rulesOf = (...rules: PaysActionRule[]) => ({ paysActions: (id: string) => rules.filter((r) => r.sourceActionId === id) });

  it('pays nothing and draws nothing for an action without a rule', () => {
    let draws = 0;
    const linked = new LinkedPayouts(rulesOf(), () => {
      draws++;
      return 0.5;
    });
    expect(linked.settle('a', 100)).toEqual([]);
    expect(draws).toBe(0);
  });

  it('at 100% pays one reward per run', () => {
    expect(new LinkedPayouts(rulesOf(rule(1)), () => 0.5).settle('a', 7)).toEqual([{ targetActionId: 'net', count: 7 }]);
  });

  it('draws once per batch, a whole number of rewards between 0 and the runs', () => {
    const linked = new LinkedPayouts(rulesOf(rule(0.25)), Math.random);
    for (let i = 0; i < 50; i++) {
      const count = linked.settle('a', 40)[0]?.count ?? 0;
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
      expect(count).toBeLessThanOrEqual(40);
    }
  });

  it('only pays for the rules of the action that completed', () => {
    const other: PaysActionRule = { sourceActionId: 'net', targetActionId: 'a', chance: 1 };
    expect(new LinkedPayouts(rulesOf(rule(1), other), () => 0.5).settle('net', 3)).toEqual([{ targetActionId: 'a', count: 3 }]);
  });
});

describe('Fiber Tap (paysActionReward)', () => {
  const tap = (chance: number) =>
    buy({ id: 'tap', effect: { kind: 'paysActionReward', sourceActionId: 'a', targetActionId: 'net', chance } });
  const FOUR_RUNS_MS = 10_000 * 4 + 1;

  it('at 100% every run of the source also pays one node of the target: four runs pay 4 nodes and the usual credits', () => {
    const g = cyberneticsGame(cyberneticsConfig([tap(1)]));
    g.buy('auto');
    g.buy('tap');
    const credits = creditsOf(g);
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(nodesOf(g)).toBe(4);
    expect(creditsOf(g) - credits).toBeCloseTo(2, 9);
  });

  it('does nothing before it is bought', () => {
    const g = cyberneticsGame(cyberneticsConfig([tap(1)]));
    g.buy('auto');
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(nodesOf(g)).toBe(0);
  });

  it('is never critical: the linked reward stays 1 node per run while the source runs are critical', () => {
    const g = cyberneticsGame(cyberneticsConfig([tap(1)]));
    g.buy('crit');
    g.buy('auto');
    g.buy('tap');
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(nodesOf(g)).toBe(4);
  });

  it('pays the target with its own multipliers: a doubler on the target makes each linked reward 2 nodes', () => {
    const doubler = buy({ id: 'x2', actionId: 'net', effect: { kind: 'rewardMultiplier', factor: 2 } });
    const g = cyberneticsGame(cyberneticsConfig([tap(1), doubler]));
    g.buy('auto');
    g.buy('tap');
    g.buy('x2');
    g.startAction('a');
    g.tick(FOUR_RUNS_MS);
    expect(nodesOf(g)).toBe(8);
  });

  it('pays only whole rewards: at 25% over 1000 runs the nodes are a whole number near 250', () => {
    const g = cyberneticsGame(cyberneticsConfig([tap(0.25)]));
    g.buy('auto');
    g.buy('tap');
    g.startAction('a');
    g.tick(10_000 * 1000 + 1);
    const nodes = nodesOf(g);
    expect(Number.isInteger(nodes)).toBe(true);
    expect(nodes).toBeGreaterThan(190);
    expect(nodes).toBeLessThan(310);
  });

  it('many short ticks give the same rate as one long tick (both near 250 nodes of 1000 runs at 25%)', () => {
    const g = cyberneticsGame(cyberneticsConfig([tap(0.25)]), 7);
    g.buy('auto');
    g.buy('tap');
    g.startAction('a');
    for (let i = 0; i < 1000; i++) g.tick(10_000);
    g.tick(1);
    expect(nodesOf(g)).toBeGreaterThan(190);
    expect(nodesOf(g)).toBeLessThan(310);
  });

  it('is rejected with an unknown action or a chance outside (0, 1]', () => {
    const unknown = buy({ id: 'bad', effect: { kind: 'paysActionReward', sourceActionId: 'a', targetActionId: 'nope', chance: 0.5 } });
    expect(validateConfig(cyberneticsConfig([unknown])).join('|')).toContain('paysActionReward refers to unknown action "nope"');
    expect(validateConfig(cyberneticsConfig([tap(0)])).join('|')).toContain('paysActionReward chance must be in (0, 1]');
    expect(validateConfig(cyberneticsConfig([tap(2)])).join('|')).toContain('paysActionReward chance must be in (0, 1]');
  });
});
