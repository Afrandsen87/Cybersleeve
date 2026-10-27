// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { hoverText } from '../testing/hover';
import { testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { buildViewModel } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

/** Test content: a purchase that opens the corporation and one corporation action of 30 seconds that upgrades files. */
const config = createConfig(testConfig, {
  buyables: [...testConfig.buyables, { id: 'inc', name: 'Inc', description: '', cost: num(1), effect: { kind: 'unlocksCorporation' } }],
  corporation: {
    actions: [
      {
        id: 'c1',
        name: 'Backstab',
        baseDurationMs: 30_000,
        effects: [{ kind: 'upgradeRandomItem', itemId: 'file', chance: 0.01 }],
      },
    ],
  },
});

const own = (g: ReturnType<typeof createGame>): void => {
  (g.getState().purchased as Record<string, number>)['inc'] = 1;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Corporation tab in the view model', () => {
  it('is hidden until the unlock is owned, and no other tab is shown for it alone', () => {
    const g = createGame({ config });
    const tab = () => buildViewModel(g).tabs.find((t) => t.id === 'corporation')!;
    expect(tab()).toEqual({ id: 'corporation', label: 'Corporation', visible: false, attention: false });
    own(g);
    expect(tab().visible).toBe(true);
    expect(buildViewModel(g).tabs.find((t) => t.id === 'character')!.visible).toBe(true); // the tabs show once there is a second one
  });

  it('lists the corporation actions with their run time, and has no figures of its own yet', () => {
    const g = createGame({ config });
    own(g);
    const view = buildViewModel(g).corporation;
    expect(view.title).toBe('Corporation');
    expect(view.stats).toEqual([]);
    expect(view.actions).toHaveLength(1);
    expect(view.actions[0]).toMatchObject({
      id: 'c1',
      name: 'Backstab',
      running: false,
      progressPercent: 0,
      startable: true,
      infoText: 'Run time 30s',
    });
  });

  it('the hover text says what the action does and its run time', () => {
    const g = createGame({ config });
    own(g);
    const tip = buildViewModel(g).corporation.actions[0]!.tip;
    expect(tip.split('\n')[0]).toBe('Backstab');
    expect(tip).toContain('Run Time = 30s');
    expect(tip).toContain('Each run has a 1% chance to upgrade one random File you hold to the next rarity');
  });

  it('an action cannot be started while the corporation is closed', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).corporation.actions[0]!.startable).toBe(false);
  });
});

describe('the Corporation tab on the screen', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    own(game);
    const render = mountUi(root, game, speed, () => {});
    const tabButton = (): HTMLButtonElement =>
      [...root.querySelectorAll<HTMLButtonElement>('.tab')].find((t) => t.textContent === 'Corporation')!;
    const panel = (): HTMLElement => root.querySelector<HTMLElement>('.corporation-panel')!;
    return { root, game, render, tabButton, panel };
  };

  it('has its own tab and panel, shown only while that tab is open', () => {
    const { root, tabButton, panel } = mount();
    expect(tabButton().hidden).toBe(false);
    expect(panel().hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('.character-panel')!.hidden).toBe(false);
    tabButton().click();
    expect(panel().hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('.character-panel')!.hidden).toBe(true);
    expect(tabButton().classList.contains('active')).toBe(true);
  });

  it('is laid out like the Character tab: the corporation widget, the other four widgets (empty), and the action grid', () => {
    const { panel } = mount();
    expect(panel().querySelector('.corporation-widget h2')!.textContent).toBe('Corporation');
    expect(panel().querySelectorAll('.corporation-widget .stat')).toHaveLength(0);
    const empty = [...panel().querySelectorAll('.dashboard-right > aside')];
    expect(empty.map((w) => w.querySelector('h2')!.textContent)).toEqual([
      'Network',
      'Sleeve Improvements',
      'Network Exploitation',
      'Inventory',
    ]);
    for (const widget of empty) expect(widget.children).toHaveLength(1); // the heading and nothing else
    expect(panel().querySelector('.divider')).not.toBeNull();
    // the action grid has the same number of cells as the Character tab: the action and empty ones
    expect(panel().querySelectorAll('.actions > .action')).toHaveLength(6);
    expect(panel().querySelectorAll('.actions > .action.empty')).toHaveLength(5);
  });

  it('a card has the title, the run time and the bar, and clicking it starts the run', () => {
    const { game, render, panel } = mount();
    const card = panel().querySelector<HTMLElement>('.corporation-action')!;
    expect(card.querySelector('.action-title')!.textContent).toBe('Backstab');
    expect(card.querySelector('.action-info')!.textContent).toBe('Run time 30s');
    card.querySelector<HTMLButtonElement>('.action-main')!.click();
    expect(game.getState().corporation.actions['c1']!.running).toBe(true);
    game.tick(15_000);
    render();
    expect(card.classList.contains('running')).toBe(true);
    expect(card.querySelector<HTMLElement>('.bar-fill')!.dataset['fill']).toBe('50');
    expect(card.querySelector<HTMLButtonElement>('.start-run')!.disabled).toBe(true); // greyed out until the run is over
    game.tick(15_000);
    render();
    expect(card.classList.contains('running')).toBe(false);
    expect(card.querySelector<HTMLButtonElement>('.start-run')!.disabled).toBe(false);
    card.querySelector<HTMLButtonElement>('.start-run')!.click();
    expect(game.getState().corporation.actions['c1']!.running).toBe(true);
  });

  it('shows the hover text of the action', () => {
    const { panel } = mount();
    expect(hoverText(panel().querySelector<HTMLElement>('.corporation-action .action-info')!)).toContain('Run Time =');
  });

  it('gives way to the Character tab when the corporation closes again (a new game)', () => {
    const { game, render, tabButton, panel } = mount();
    tabButton().click();
    expect(panel().hidden).toBe(false);
    game.newGame();
    render();
    expect(tabButton().hidden).toBe(true);
    expect(panel().hidden).toBe(true);
  });
});
