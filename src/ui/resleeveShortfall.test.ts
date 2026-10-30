// @vitest-environment happy-dom
/**
 * The Re-sleeve button states what it is waiting for: sleeve levels, in total, for the next re-sleeve.
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

const gate = {
  id: 'levels',
  name: 'Sleeve levels',
  description: 'Opens re-sleeving.',
  cost: num(10),
  effect: { kind: 'unlockSleeveLevels' },
} as const;

function mount(base: number, perResleeve: number) {
  const root = document.createElement('div');
  document.body.append(root);
  const config = createConfig(testConfig, {
    buyables: [...testConfig.buyables, gate],
    resleeve: { ...testConfig.resleeve, lockoutMs: 0, sleeveLevelsNeeded: { base, perResleeve } },
  });
  const game = createGame({ config });
  const render = mountTestUi(root, game);
  const button = () => root.querySelector<HTMLButtonElement>('.sleeve-widget .resleeve')!;
  const open = () => {
    setCredits(game, num(10));
    render();
    button().click();
  };
  return { game, render, button, open };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Re-sleeve button when levels are short', () => {
  it('says nothing about sleeve levels before the unlock is owned', () => {
    const { game, button } = mount(1_000, 1);
    expect(buildViewModel(game).resleeveShortfall).toBeNull();
    expect(hoverText(button())).not.toContain('sleeve levels');
  });

  it('once the unlock is owned, a disabled button whose tip gives the total needed and the total held', () => {
    const { game, render, button, open } = mount(1_000, 1);
    open();
    render();
    expect(button().disabled).toBe(true);
    expect(buildViewModel(game).resleeveShortfall).toEqual({ held: 0, needed: 1_000 });
    expect(hoverText(button())).toContain('1K');
    expect(hoverText(button())).toContain('You have 0');
  });

  it('enables the button and drops the tip when the levels are enough', () => {
    const { game, render, button, open } = mount(1, 1);
    open();
    setSleeveXp(game, num(1e6));
    render();
    expect(button().disabled).toBe(false);
    expect(buildViewModel(game).resleeveShortfall).toBeNull();
  });

  it('after a re-sleeve the next one needs more, and the button says so again', () => {
    const { game, render, button, open } = mount(1, 1e9);
    open();
    setSleeveXp(game, num(1e6));
    render();
    button().click();
    button().click();
    expect(game.getState().wallet.runs).toHaveLength(1);
    render();
    expect(button().disabled).toBe(true);
    expect(buildViewModel(game).resleeveShortfall?.needed).toBe(1_000_000_001);
    expect(hoverText(button())).toContain('sleeve levels');
  });
});
