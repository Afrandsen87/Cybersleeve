// @vitest-environment happy-dom
/**
 * The Re-sleeve button states what it is waiting for: action levels and sleeve levels, in total, beyond the last run.
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
    resleeve: { ...testConfig.resleeve, lockoutMs: 0, progressNeeded: { actionLevels: 1, sleeveLevels: 1 } },
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

  it('once the unlock is owned, a disabled button whose tip names both totals needed and held', () => {
    const { game, render, button, open } = mount();
    open();
    render();
    expect(button().disabled).toBe(true);
    expect(buildViewModel(game).resleeveShortfall.map((r) => [r.kind, r.held, r.needed])).toEqual([
      ['actionLevels', 0, 1],
      ['sleeveLevels', 0, 1],
    ]);
    expect(hoverText(button())).toContain('action levels');
    expect(hoverText(button())).toContain('sleeve levels');
    expect(hoverText(button())).toContain('You have 0');
  });

  it('lists only what is still missing: sleeve levels alone leave the action levels on the tip', () => {
    const { game, render, button, open } = mount();
    open();
    setSleeveXp(game, num(1e6));
    render();
    expect(button().disabled).toBe(true);
    expect(buildViewModel(game).resleeveShortfall.map((r) => r.kind)).toEqual(['actionLevels']);
  });

  it('enables the button and drops the tip when both totals are enough', () => {
    const { game, render, button, open, setActionXp } = mount();
    open();
    setSleeveXp(game, num(1e6));
    setActionXp(1e6);
    render();
    expect(button().disabled).toBe(false);
    expect(buildViewModel(game).resleeveShortfall).toEqual([]);
  });

  it('after a re-sleeve the next one needs more than the last run reached, and the button says so again', () => {
    const { game, render, button, open, setActionXp } = mount();
    open();
    setSleeveXp(game, num(1e6));
    setActionXp(1e6);
    render();
    button().click();
    button().click();
    expect(game.getState().wallet.runs).toHaveLength(1);
    render();
    expect(button().disabled).toBe(true);
    const last = game.getState().wallet.runs[0]!;
    expect(buildViewModel(game).resleeveShortfall.map((r) => r.needed)).toEqual([last.actionLevelsTotal + 1, last.sleeveLevelsTotal + 1]);
  });
});
