// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { buildViewModel, statRow } from './viewModel';
import { config, own, state, NOT } from './modesKit';

describe('the Overclock toggle in the view model', () => {
  it('does not exist before the action unlocks it, and the sleeve upgrade alone does not unlock it', () => {
    const g = createGame({ config });
    for (const a of buildViewModel(g).actions) expect(a.overclock).toBeNull();
    own(g, 'ocs');
    for (const a of buildViewModel(g).actions) expect(a.overclock).toBeNull();
  });

  it('exists on the unlocked action, off at first; an action without an effect never has one', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    const [a, net] = buildViewModel(g).actions;
    expect(a!.overclock).toMatchObject({ symbol: 'OV', name: 'Overclock', on: false, clickable: true });
    expect(net!.overclock).toBeNull();
  });

  it('the tip shows the calculation: the strength, the scaled bonus and the heat cost', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    own(g, 'ocs');
    const tip = buildViewModel(g).actions[0]!.overclock!.tip;
    expect(tip.split('\n')[0]).toBe('Overclock (off)');
    expect(tip).toContain('Strength = 1.1');
    expect(tip).toContain('Speed Bonus = 55% (50% x Strength)');
    expect(tip).toContain('Causes 1 heat per minute while this action runs');
    expect(tip).toContain('Click to switch on');
  });

  it('says what it does and never what it does not', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.overclock!.tip).not.toMatch(NOT);
  });

  it('while on, the action speed tip lists the Overclock factor', () => {
    const g = createGame({ config });
    own(g, 'oc-a');
    expect(buildViewModel(g).actions[0]!.speedTip).not.toContain('Overclock');
    g.toggleOverclock('a');
    const tip = buildViewModel(g).actions[0]!.speedTip;
    expect(tip.split('\n')[0]).toBe('Action Speed = Action Level x Sleeve Level x Interface Speed x Overclock');
    expect(tip).toContain('Overclock = 1.5');
  });
});

describe('the Overclock tip of an action with its own effect', () => {
  const tipOf = (rule: object) => {
    const base = createConfig(config, { actions: config.actions.map((a) => (a.id === 'a' ? { ...a, overclock: rule } : a)) });
    const g = createGame({ config: base });
    own(g, 'oc-a');
    own(g, 'ocs', 2);
    return buildViewModel(g).actions[0]!.overclock!.tip;
  };

  it('a reward bonus shows its own formula and numbers, scaled by the strength', () => {
    const tip = tipOf({ rewardBonus: 2 });
    expect(tip).toContain('Reward per Run = Reward per Run x (1 + Reward Bonus)');
    expect(tip).toContain('Reward Bonus = 240% (200% x Strength)');
    expect(tip).not.toContain('Speed Bonus');
    expect(tip).not.toContain('heat');
  });

  it('a node cost, an extra payment and a heat factor are each named, and carry no strength', () => {
    const tip = tipOf({ alsoPays: 'net', heatPerRunFactor: 3, completionEffects: [{ kind: 'removeNodes', amount: 5 }] });
    expect(tip).toContain('Each completed run also pays the nodes of one Net run');
    expect(tip).toContain('Each run makes 3x as much heat');
    expect(tip).toContain('Each completed run costs 5 nodes');
    expect(tip).not.toContain('Strength');
  });

  it('say what things do and never what they do not', () => {
    for (const rule of [
      { rewardBonus: 2 },
      { alsoPays: 'net', heatPerRunFactor: 3 },
      { completionEffects: [{ kind: 'removeNodes', amount: 5 }] },
    ]) {
      expect(tipOf(rule)).not.toMatch(NOT);
    }
  });
});

describe('the Focus toggle in the view model', () => {
  it('does not exist before the action unlocks it, and the slot upgrade alone does not unlock it', () => {
    const g = createGame({ config });
    own(g, 'slots');
    for (const a of buildViewModel(g).actions) expect(a.focus).toBeNull();
  });

  it('exists on the unlocked actions only', () => {
    const g = createGame({ config });
    own(g, 'fo-net');
    const [a, net] = buildViewModel(g).actions;
    expect(a!.focus).toBeNull();
    expect(net!.focus).toMatchObject({ symbol: 'FO', name: 'Focus', on: false, clickable: true });
  });

  it('with every slot taken, only the focused action can be clicked, and the tip says why', () => {
    const g = createGame({ config });
    own(g, 'fo-a');
    own(g, 'fo-net');
    g.toggleFocus('a');
    const [a, net] = buildViewModel(g).actions;
    expect(a!.focus).toMatchObject({ on: true, clickable: true });
    expect(net!.focus).toMatchObject({ on: false, clickable: false });
    expect(net!.focus!.tip).toContain('Focus Slots in use = 1 / 1');
    expect(net!.focus!.tip).toContain('Every slot is in use: switch another action off first');
    expect(a!.focus!.tip).toContain('Focus Bonus = 25%');
    expect(a!.focus!.tip).toContain('Click to switch off');
  });

  it('says what it does and never what it does not', () => {
    const g = createGame({ config });
    own(g, 'fo-a');
    own(g, 'fo-net');
    g.toggleFocus('a');
    for (const a of buildViewModel(g).actions) expect(a.focus!.tip).not.toMatch(NOT);
  });
});

describe('the heat bar with fractions of a point', () => {
  const bar = (g: ReturnType<typeof createGame>) => statRow(buildViewModel(g).sleeve.stats, 'heat').bar!;

  it('says it waits while there is less than a whole point of heat', () => {
    const g = createGame({ config });
    state(g).heat = 0.5;
    expect(bar(g)).toMatchObject({ running: false, label: 'Heat cooldown (paused: needs a whole point of heat)' });
    state(g).heat = 1;
    expect(bar(g)).toMatchObject({ running: true, label: 'Heat cooldown' });
  });

  it('shows heat in fractions', () => {
    const g = createGame({ config });
    state(g).heat = 0.5;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').text).toBe('0.5');
  });

  it('the heat tip says when the cooldown removes heat', () => {
    const g = createGame({ config });
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).toContain('once at least 1 heat is held');
  });
});
