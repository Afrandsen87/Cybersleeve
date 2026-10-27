// @vitest-environment happy-dom
import { hoverText } from '../testing/hover';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { mountUi, showNotice, type SpeedControl } from './dom';
import { uiText, type UiText } from './uiText';
import { buildViewModel, statRow } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };
const state = (g: { getState(): unknown }) => g.getState() as { heat: number; legend: number; network: unknown };

/** A complete text table whose every entry is recognisable, to prove that nothing is spelled out in logic. */
const shouting: UiText = {
  ...uiText,
  credits: (amount) => `<<${amount} CR>>`,
  titles: { ...uiText.titles, sleeve: 'SLEEVE!', network: 'NETWORK!' },
  statLabels: { ...uiText.statLabels, heat: 'HEAT!' },
  action: { ...uiText.action, levelBar: (level) => `LEVEL ${level}`, reward: ({ amount }) => `PAYS ${amount}` },
  resleeve: { idle: 'IDLE', armed: 'ARMED', cancel: 'NEVERMIND' },
  controls: { ...uiText.controls, resetSave: 'WIPE', speedToggle: (f) => `FAST ${f}` },
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('display text comes from the text table', () => {
  it('the view model uses the injected text for every line it builds', () => {
    const g = createGame({ config: testConfig });
    const vm = buildViewModel(g, undefined, shouting);
    expect(vm.creditsLine).toBe('<<0 CR>>');
    expect(vm.sleeve.title).toBe('SLEEVE!');
    expect(vm.network.title).toBe('NETWORK!');
    expect(statRow(vm.sleeve.stats, 'heat').label).toBe('HEAT!');
    expect(vm.actions[0]!.levelBarText).toBe('LEVEL 0');
    expect(vm.actions[0]!.rewardLine).toBe('PAYS 0.5');
  });

  it('the screen shows the injected text, chrome included', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountUi(root, createGame({ config: testConfig }), speed, () => {}, { text: shouting });
    expect(root.querySelector('.credits')?.textContent).toBe('<<0 CR>>');
    expect(root.querySelector('.resleeve')?.textContent).toBe('IDLE');
    expect(root.querySelector('.resleeve-cancel')?.textContent).toBe('NEVERMIND');
    expect(root.querySelector('.reset-save')?.textContent).toBe('WIPE');
    expect(root.querySelector('.speed-toggle')?.textContent).toBe('FAST 1');
    expect(root.querySelector('.sleeve-widget h2')?.textContent).toBe('SLEEVE!');
    expect(root.textContent).toContain('HEAT!');
  });

  it('the default table still reads like the game', () => {
    const vm = buildViewModel(createGame({ config: testConfig }));
    expect(vm.creditsLine).toBe('Credits: 0');
    expect(vm.sleeve.stats.filter((s) => !s.hidden).map((s) => s.label)).toEqual([
      'Access level',
      'Interface speed',
      'Hacking Proficiency',
    ]); // Heat, ICE Rating and Legend stay hidden until something makes or boosts them
    expect(vm.network.stats.filter((s) => !s.hidden).map((s) => s.label)).toEqual(['Nodes', 'Payout per node', 'Credits per second']);
  });
});

describe('stat rows', () => {
  it('only heat and Legend have a cycle bar, and every Sleeve row has a tip', () => {
    const vm = buildViewModel(createGame({ config: testConfig }));
    const withBar = [...vm.sleeve.stats, ...vm.network.stats].filter((s) => s.bar).map((s) => s.id);
    expect(withBar).toEqual(['heat', 'legend']);
    for (const row of vm.sleeve.stats) expect(row.tip, `${row.id} has no tip`).toBeTruthy();
    expect(statRow(vm.network.stats, 'nodes').tip).toBeNull();
  });

  it('statRow refuses an unknown row', () => {
    const vm = buildViewModel(createGame({ config: testConfig }));
    expect(() => statRow(vm.sleeve.stats, 'nodes')).toThrow('No stat row nodes');
  });

  it('the heat explanation follows the configured tax rate, not a fixed 1% per point', () => {
    const g = createGame({ config: createConfig(testConfig, { sleeve: { heatTaxPerPoint: 0.02 } }) });
    state(g).heat = 10;
    const tip = statRow(buildViewModel(g).sleeve.stats, 'heat').tip!;
    expect(tip).toContain('Heat = 10');
    expect(tip).toContain('Tax per Point = 2%');
    expect(tip).toContain('Heat Tax = 20% of all credits earned from nodes');
    expect(tip).toContain('Node credits stop at 50 heat');
  });

  it('with no tax per point credits never stop', () => {
    const g = createGame({ config: createConfig(testConfig, { sleeve: { heatTaxPerPoint: 0 } }) });
    state(g).heat = 500;
    const tip = statRow(buildViewModel(g).sleeve.stats, 'heat').tip!;
    expect(tip).toContain('Heat Tax = 0% of all credits earned from nodes');
    expect(tip).not.toContain('Node credits stop');
  });

  it('the bars say when their cycle is paused', () => {
    const g = createGame({ config: testConfig });
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').bar).toEqual({
      label: 'Heat cooldown (paused: needs a whole point of heat)',
      percent: 0,
      running: false,
    });
    state(g).heat = 3;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').bar!.label).toBe('Heat cooldown');
  });
});

describe('the screen renders stat rows from data', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config: testConfig });
    const render = mountUi(root, game, speed, () => {});
    return { root, game, render };
  };

  it('every row of the view model is on the screen, with its label, value and (when it has one) tip', () => {
    const { root, game, render } = mount();
    state(game).heat = 7;
    render();
    const vm = buildViewModel(game);
    const labels = [...root.querySelectorAll('.stat-label')].map((e) => e.textContent);
    expect(labels).toEqual([...vm.sleeve.stats, ...vm.network.stats].map((s) => s.label));
    const heatRow = [...root.querySelectorAll<HTMLElement>('.stat')].find((r) => r.textContent?.startsWith('Heat'))!;
    expect(heatRow.textContent).toBe('Heat7');
    expect(hoverText(heatRow)).toContain('Heat Tax = 7% of all credits earned from nodes');
  });

  it('a row without a tip carries no tip attribute', () => {
    const { root } = mount();
    const nodes = [...root.querySelectorAll<HTMLElement>('.stat')].find((r) => r.textContent?.startsWith('Nodes'))!;
    expect(nodes.hasAttribute('data-tip')).toBe(false);
  });

  it('shows the passive income with its plus sign', () => {
    const { root, game, render } = mount();
    state(game).network = num(40);
    render();
    const income = [...root.querySelectorAll<HTMLElement>('.stat')].find((r) => r.textContent?.startsWith('Credits per second'))!;
    expect(income.textContent).toBe('Credits per second+2');
  });
});

describe('test aids and notices', () => {
  it('the corner controls are left out when debug controls are off', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountUi(root, createGame({ config: testConfig }), speed, () => {}, { debugControls: false });
    expect(root.querySelector('.reset-save')).toBeNull();
    expect(root.querySelector('.speed-toggle')).toBeNull();
    expect(root.querySelector('.credits')).not.toBeNull();
  });

  it('showNotice puts an alert over the game', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountUi(root, createGame({ config: testConfig }), speed, () => {});
    showNotice(root, 'hello');
    const notice = root.firstElementChild!;
    expect(notice.textContent).toBe('hello');
    expect(notice.getAttribute('role')).toBe('alert');
  });

  it('a purchase button follows the text table for its tip', () => {
    const g = createGame({ config: testConfig });
    setCredits(g, num(100));
    const auto = buildViewModel(g).actions[0]!.buyables.find((b) => b.id === 'auto')!;
    expect(auto.tip).toBe('Auto\n\nCost = 10 credits');
  });
});
