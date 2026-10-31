// @vitest-environment happy-dom
/**
 * The Re-sleeve button states what it is waiting for: sleeve levels held and needed, with a threshold per earlier re-sleeve.
 *
 * Purpose: the shortfall tip follows the reveal rule (nothing about sleeve levels before the unlock is owned), disappears when the levels are
 * enough, and reappears for the next re-sleeve whose threshold is higher.
 * Called by: vitest. Calls: `mountUi`, `buildViewModel`, the test config.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { hoverText } from '../testing/hover';
import { setCredits, setSleeveXp, testConfig } from '../testing/testConfig';
import { buildViewModel } from './viewModel';
import { mountTestUi } from '../testing/domMountKit';

const levels = {
  id: 'levels',
  name: 'Sleeve levels',
  description: 'Sleeve XP starts.',
  cost: num(10),
  effect: { kind: 'unlockSleeveLevels' },
} as const;

const unlock = {
  id: 'unlock',
  name: 'Unlock resleeving',
  description: 'Opens re-sleeving.',
  cost: num(10),
  requires: ['levels'],
  effect: { kind: 'unlockResleeve' },
} as const;

function mount() {
  const root = document.createElement('div');
  document.body.append(root);
  const config = createConfig(testConfig, {
    buyables: [...testConfig.buyables, levels, unlock],
    resleeve: { ...testConfig.resleeve, lockoutMs: 0, progressNeeded: { sleeveLevels: 5, perResleeve: 1 } },
  });
  const game = createGame({ config });
  const render = mountTestUi(root, game);
  const button = () => root.querySelector<HTMLButtonElement>('.sleeve-widget .resleeve')!;
  const open = () => {
    setCredits(game, num(20));
    game.buy('levels');
    render();
    button().click(); // the button is the purchase of Unlock resleeving
  };
  const setActionXp = (xp: number) => {
    (game.getState().sleeve.actions['a'] as { xp: unknown }).xp = num(xp);
  };
  return { game, render, button, open, setActionXp };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Re-sleeve button when progress is short', () => {
  it('says nothing about levels before the unlock is owned', () => {
    const { game, button } = mount();
    expect(buildViewModel(game).resleeveShortfall).toEqual([]);
    expect(hoverText(button())).not.toContain('levels in total');
  });

  it('once the unlock is owned, a disabled button whose tip names only sleeve levels needed and held', () => {
    const { game, render, button, open } = mount();
    open();
    render();
    expect(button().disabled).toBe(true);
    expect(buildViewModel(game).resleeveShortfall.map((r) => [r.kind, r.held, r.needed])).toEqual([['sleeveLevels', 0, 5]]);
    expect(hoverText(button())).not.toContain('action levels');
    expect(hoverText(button())).toContain('Needs 5 sleeve levels');
    expect(hoverText(button())).toContain('sleeve levels');
    expect(hoverText(button())).toContain('You have 0');
  });

  it('requires no action levels once sleeve levels suffice', () => {
    const { game, render, button, open } = mount();
    open();
    setSleeveXp(game, num(111110));
    render();
    expect(button().disabled).toBe(false);
    expect(buildViewModel(game).resleeveShortfall).toEqual([]);
  });

  it('enables the button and drops the tip when sleeve levels are enough', () => {
    const { game, render, button, open, setActionXp } = mount();
    open();
    setSleeveXp(game, num(111110));
    setActionXp(1e6);
    render();
    expect(button().disabled).toBe(false);
    expect(buildViewModel(game).resleeveShortfall).toEqual([]);
  });

  it('after a re-sleeve the next one needs one more sleeve level, and the button says so again', () => {
    const { game, render, button, open, setActionXp } = mount();
    open();
    setSleeveXp(game, num(111110));
    setActionXp(1e6);
    render();
    button().click();
    button().click();
    expect(game.getState().wallet.runs).toHaveLength(1);
    render();
    expect(button().disabled).toBe(true);
    expect(buildViewModel(game).resleeveShortfall.map((r) => r.needed)).toEqual([6]);
  });
});
