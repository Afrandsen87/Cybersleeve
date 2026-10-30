// @vitest-environment happy-dom
/**
 * The Re-sleeve button sits at the bottom of the Sleeve widget. It shows once Sleeve levels is owned; until Unlock resleeving is owned it IS
 * that purchase; one click buys it and the button turns into the Re-sleeve action, disabled for the lockout.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { hoverText } from '../testing/hover';
import { setCredits, testConfig } from '../testing/testConfig';
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
    resleeve: { ...testConfig.resleeve, lockoutMs: 5_000 },
  });
  const game = createGame({ config });
  const render = mountTestUi(root, game);
  const button = () => root.querySelector<HTMLButtonElement>('.sleeve-widget .resleeve')!;
  const row = () => root.querySelector<HTMLElement>('.sleeve-widget .resleeve-row')!;
  /** Buys Sleeve levels (credits for it only), so the button shows. */
  const buyLevels = () => {
    setCredits(game, num(10));
    game.buy('levels');
    setCredits(game, num(0));
    render();
  };
  return { root, game, render, button, row, buyLevels };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Re-sleeve button', () => {
  it('is hidden until Sleeve levels is owned', () => {
    const { row } = mount();
    expect(row().hidden).toBe(true);
  });

  it('is the last thing in the Sleeve widget, and Unlock resleeving is not listed with the other purchases', () => {
    const { root, buyLevels } = mount();
    buyLevels();
    const widget = root.querySelector('.sleeve-widget')!;
    expect(widget.lastElementChild?.classList.contains('resleeve-row')).toBe(true);
    expect(root.querySelector('.upgrades-widget')?.textContent).not.toContain('Unlock resleeving');
  });

  it('starts as the purchase of Unlock resleeving: shows its name and price, is greyed out until affordable, and has its tip', () => {
    const { game, render, button, row, buyLevels } = mount();
    buyLevels();
    expect(row().hidden).toBe(false);
    expect(button().textContent).toContain('Unlock resleeving');
    expect(button().textContent).toContain('10');
    expect(button().disabled).toBe(true);
    setCredits(game, num(10));
    render();
    expect(button().disabled).toBe(false);
    expect(hoverText(button())).toContain('Opens re-sleeving.');
  });

  it('one click buys the unlock; the button then turns into a disabled Re-sleeve button until the lockout is over', () => {
    const { game, render, button, buyLevels } = mount();
    buyLevels();
    setCredits(game, num(10));
    render();
    button().click();
    expect(game.ownedCount('unlock')).toBe(1);
    expect(button().textContent).toBe('Re-sleeve');
    expect(button().disabled).toBe(true);
    button().click(); // a double click does nothing
    expect(game.getState().wallet.runs).toHaveLength(0);
    game.tick(5_000);
    render();
    expect(button().disabled).toBe(false);
  });

  it('then re-sleeves with a confirming second click', () => {
    const { game, render, button, buyLevels } = mount();
    buyLevels();
    setCredits(game, num(10));
    render();
    button().click();
    game.tick(5_000);
    render();
    button().click();
    expect(game.getState().wallet.runs).toHaveLength(0);
    expect(button().classList.contains('armed')).toBe(true);
    button().click();
    expect(game.getState().wallet.runs).toHaveLength(1);
  });
});
