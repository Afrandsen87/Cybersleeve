// @vitest-environment happy-dom
/**
 * The action card as a process window on the screen: title bar and state LED, the action colour hook, the labelled LED toggles,
 * the price strip of a purchase cell, the MODS row and that an unchanged frame touches nothing.
 *
 * Called by: vitest. Calls: `mountTestUi`, the modes kit.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { type GameConfig, createConfig } from '../core';
import { num } from '../numbers';
import { mountTestUi } from '../testing/domMountKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { config, own } from './modesKit';

const mount = () => {
  const root = document.createElement('div');
  document.body.append(root);
  const game = createGame({ config });
  const render = mountTestUi(root, game);
  const card = () => root.querySelector<HTMLElement>('.action.process')!;
  const led = () => card().querySelector<HTMLElement>('.proc-led')!;
  return { root, game, render, card, led };
};

describe('process window title bar', () => {
  it('shows the name, the process id and the action id as the colour hook', () => {
    const { card } = mount();
    expect(card().dataset.action).toBe('a');
    expect(card().querySelector('.action-title')!.textContent).toBe('A');
    expect(card().querySelector('.proc-id')!.textContent).toBe('a');
  });

  it('the LED reads IDLE, then RUNNING for a manual run, then AUTO once Auto-run is on', () => {
    const { game, render, led } = mount();
    expect([led().dataset.state, led().textContent]).toEqual(['idle', 'IDLE']);
    game.startAction('a');
    render();
    expect([led().dataset.state, led().textContent]).toEqual(['running', 'RUNNING']);
    own(game, 'auto');
    render();
    expect(buildViewModel(game).actions[0]!.state).toBe('auto');
    expect([led().dataset.state, led().textContent]).toEqual(['auto', 'AUTO']);
  });

  it('marks a running card for the glow and an idle card for the desaturation', () => {
    const { game, render, card } = mount();
    expect(card().classList.contains('running')).toBe(false);
    game.startAction('a');
    render();
    expect(card().classList.contains('running')).toBe(true);
  });

  it('keeps the critical mark in the title bar, hidden until there is a critical success', () => {
    const { card } = mount();
    const crit = card().querySelector<HTMLElement>('.proc-bar .crit-badge')!;
    expect(crit).not.toBeNull();
    expect(crit.hidden).toBe(true);
  });
});

describe('process window controls', () => {
  it('labels each cell and shows the price strip only on a purchase cell', () => {
    const { game, render, card } = mount();
    own(game, 'auto');
    setCredits(game, num(100));
    render();
    const cell = (id: string) => card().querySelector<HTMLElement>(`.cell-${id}`)!;
    expect(['autoRun', 'overclock', 'focus', 'augment'].map((id) => cell(id).querySelector('.cell-label')!.textContent)).toEqual([
      'AUTO',
      'OC',
      'FOCUS',
      'AUG',
    ]);
    // Overclock is still a purchase: it shows its price; the owned Auto-run toggle shows none
    expect(cell('overclock').querySelector<HTMLElement>('.cell-price')!.hidden).toBe(false);
    expect(cell('overclock').querySelector('.cell-price')!.textContent).not.toBe('');
    expect(cell('autoRun').querySelector<HTMLElement>('.cell-price')!.hidden).toBe(true);
  });

  it('lights the LED of an owned toggle only while it is on, and keeps an empty cell in place', () => {
    const { game, render, card } = mount();
    own(game, 'auto');
    render();
    const led = () => card().querySelector('.cell-autoRun .cell-led')!;
    expect(led().classList.contains('on')).toBe(true);
    game.activateBuyable('auto');
    render();
    expect(led().classList.contains('on')).toBe(false);
    const augment = card().querySelector<HTMLElement>('.cell-augment')!;
    expect(augment.classList.contains('empty')).toBe(true);
    expect(card().querySelector('.square-grid')!.children).toHaveLength(4);
  });
});

describe('process window MODS row', () => {
  const modsOf = (cfg: GameConfig) => {
    const root = document.createElement('div');
    document.body.append(root);
    mountTestUi(root, createGame({ config: cfg }));
    return root.querySelector<HTMLElement>('.action.process .mods')!;
  };

  it('is hidden while the action has no purchase to show besides its square', () => {
    expect(modsOf(createConfig(testConfig, { buyables: [testConfig.buyables[0]!] })).hidden).toBe(true);
  });

  it('shows the label and price-strip tiles once an action purchase shows', () => {
    const mods = modsOf(testConfig);
    expect(mods.hidden).toBe(false);
    expect(mods.querySelector('.mods-label')!.textContent).toBe('MODS');
    expect(mods.querySelector('.upgrade.tile .price')).not.toBeNull();
  });
});

describe('process window refresh', () => {
  it('touches no text or attribute on an unchanged frame', () => {
    const { root, render } = mount();
    render();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-tip', 'style'],
    });
    render();
    render();
    expect(observer.takeRecords()).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
