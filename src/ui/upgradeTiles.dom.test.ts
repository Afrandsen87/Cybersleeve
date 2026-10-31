// @vitest-environment happy-dom
/** Opt-in tile rendering and persistent panel order. */
import { expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { mountTestUi } from '../testing/domMountKit';
import { setCredits, testConfig } from '../testing/testConfig';
import { TipRegistry } from './tooltip';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';
import { renderUpgrades, upgradeRow } from './widgets/upgradeButtons';

it('renders price, MAX, repeatable counts and affordability only in tile mode', () => {
  const view = buildViewModel(createGame({ config: testConfig })).sleeve.buyables[0]!;
  const icons = { urlFor: () => null };
  const row = upgradeRow([view], vi.fn(), icons, uiText.upgradeTiles);
  const button = row.buttons.get(view.id)!;
  const tips = new TipRegistry();
  renderUpgrades(row.buttons, [{ ...view, available: true, affordable: false }], tips);
  expect(button.querySelector('.price')!.textContent).toBe(view.costText);
  expect(button.classList.contains('poor')).toBe(true);
  expect(button.querySelector<HTMLElement>('.own')!.hidden).toBe(true);
  renderUpgrades(
    row.buttons,
    [{ ...view, available: true, affordable: true, clickable: true, owned: 2, ownedText: '2', repeatable: true }],
    tips,
  );
  expect(button.classList.contains('purchasable')).toBe(true);
  expect(button.classList.contains('poor')).toBe(false);
  expect(button.querySelector('.own')!.textContent).toBe('×2');
  expect(button.querySelector<HTMLElement>('.own')!.hidden).toBe(false);
  renderUpgrades(row.buttons, [{ ...view, owned: 3, repeatable: true, maxed: true }], tips);
  expect(button.querySelector('.price')!.textContent).toBe('MAX');
  expect(button.querySelector<HTMLElement>('.own')!.hidden).toBe(false);
  renderUpgrades(row.buttons, [{ ...view, owned: 1, repeatable: false, maxed: true }], tips);
  expect(button.querySelector('.price')!.textContent).toBe('MAX');
  expect(button.querySelector<HTMLElement>('.own')!.hidden).toBe(true);
  const plain = upgradeRow([view], vi.fn(), icons);
  renderUpgrades(plain.buttons, [view], tips);
  expect(plain.element.querySelector('.price')).toBeNull();
  expect(plain.element.querySelector('.own')).toBeNull();
});

it('hides the row label until at least one purchase is revealed', () => {
  const config = createConfig(testConfig, {
    buyables: [testConfig.buyables[0]!, { ...testConfig.buyables[3]!, requires: ['auto'] }],
  });
  const game = createGame({ config });
  const root = document.createElement('div');
  const render = mountTestUi(root, game);
  const row = root.querySelector<HTMLElement>('.shop-row')!;
  expect(row.hidden).toBe(true);
  setCredits(game, num(2000));
  game.buy('auto');
  render();
  expect(row.hidden).toBe(false);
});

it('moves bought one-time buttons without rebuilding and leaves unchanged order untouched', () => {
  const game = createGame({ config: testConfig });
  const root = document.createElement('div');
  const render = mountTestUi(root, game);
  const row = root.querySelector<HTMLElement>('.upgrades-widget .upgrades')!;
  const before = [...row.children];
  const append = vi.spyOn(row, 'append');
  render();
  expect(append).not.toHaveBeenCalled();
  setCredits(game, num(2000));
  game.buy('access');
  render();
  expect([...row.children]).toEqual([before[1], before[0]]);
  expect(append).toHaveBeenCalledTimes(2);
  append.mockClear();
  render();
  expect(append).not.toHaveBeenCalled();
  expect(row.firstElementChild).toBe(before[1]);
});
