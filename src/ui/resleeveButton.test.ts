// @vitest-environment happy-dom
/**
 * The Re-sleeve button sits at the bottom of the Sleeve widget. Until the sleeve-levels unlock is owned it IS that purchase; one click buys
 * it and the button turns into the Re-sleeve action, disabled for the lockout.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { hoverText } from '../testing/hover';
import { setCredits, testConfig } from '../testing/testConfig';
import { type SpeedControl, mountUi } from './dom';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };
const gate = {
  id: 'levels',
  name: 'Sleeve levels',
  description: 'Opens re-sleeving.',
  cost: num(10),
  effect: { kind: 'unlockSleeveLevels' },
} as const;

function mount() {
  const root = document.createElement('div');
  document.body.append(root);
  const config = createConfig(testConfig, {
    buyables: [...testConfig.buyables, gate],
    resleeve: { ...testConfig.resleeve, lockoutMs: 5_000 },
  });
  const game = createGame({ config });
  const render = mountUi(root, game, speed, () => {});
  const button = () => root.querySelector<HTMLButtonElement>('.sleeve-widget .resleeve')!;
  return { root, game, render, button };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('the Re-sleeve button', () => {
  it('is the last thing in the Sleeve widget, and the unlock is not listed with the other purchases', () => {
    const { root } = mount();
    const widget = root.querySelector('.sleeve-widget')!;
    expect(widget.lastElementChild?.classList.contains('resleeve-row')).toBe(true);
    expect(root.querySelector('.upgrades-widget')?.textContent).not.toContain('Sleeve levels');
  });

  it("starts as the purchase of the unlock: shows its name and price, is greyed out until affordable, and has the unlock's tip", () => {
    const { game, render, button } = mount();
    expect(button().textContent).toContain('Sleeve levels');
    expect(button().textContent).toContain('10');
    expect(button().disabled).toBe(true);
    setCredits(game, num(10));
    render();
    expect(button().disabled).toBe(false);
    expect(hoverText(button())).toContain('Opens re-sleeving.');
  });

  it('one click buys the unlock; the button then turns into a disabled Re-sleeve button until the lockout is over', () => {
    const { game, render, button } = mount();
    setCredits(game, num(10));
    render();
    button().click();
    expect(game.ownedCount('levels')).toBe(1);
    expect(button().textContent).toBe('Re-sleeve');
    expect(button().disabled).toBe(true);
    button().click(); // a double click does nothing
    expect(game.getState().wallet.runs).toHaveLength(0);
    game.tick(5_000);
    render();
    expect(button().disabled).toBe(false);
  });

  it('then re-sleeves with a confirming second click', () => {
    const { game, render, button } = mount();
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
