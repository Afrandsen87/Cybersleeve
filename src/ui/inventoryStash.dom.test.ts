// @vitest-environment happy-dom
/** @module testing
 * Stash markup and stable legend rendering. Called by: Vitest. Calls: domMountKit, inventoryKit.
 */
import { expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { mountTestUi } from '../testing/domMountKit';
import { stock, see, stashConfig } from './inventoryKit';

it('shows selected stack gains, updates them after selling, and clears dropped selection', () => {
  const game = createGame({ config: stashConfig });
  stock(game, { file: { rare: 3 } });
  const root = document.createElement('div');
  const render = mountTestUi(root, game);
  const tile = root.querySelector<HTMLButtonElement>('[aria-label="Rare File"]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('.inventory-action')].slice(0, 2);
  const gains = () => buttons.map((b) => b.querySelector('.gain')!.textContent);
  expect(gains()).toEqual(['', '']);
  tile.click();
  expect(gains()).toEqual(['+100', '+300']);
  expect(tile.querySelector('.item-name')!.firstChild!.textContent).toBe('File');
  expect(tile.querySelector('.item-caption')!.textContent).toBe('RARE');
  buttons[0]!.click();
  expect(gains()).toEqual(['+100', '+200']);
  tile.click();
  expect(gains()).toEqual(['', '']);
  tile.click();
  buttons[1]!.click();
  expect(gains()).toEqual(['', '']);
  expect(buttons.every((b) => b.disabled)).toBe(true);
  render();
});

it('kept items show no sell gain or legend and cannot select a sale stack', () => {
  const game = createGame({ config: stashConfig });
  stock(game, { kept: { common: 1 } });
  const root = document.createElement('div');
  mountTestUi(root, game);
  root.querySelector<HTMLButtonElement>('[aria-label="Common Kept"]')!.click();
  expect([...root.querySelectorAll('.gain')].map((e) => e.textContent)).toEqual(['', '']);
  expect(root.querySelector('.rarity-legend')!.children).toHaveLength(0);
  expect(root.querySelector<HTMLElement>('.inventory-for-sale')!.hidden).toBe(true);
});

it('only replaces legend entries when their rarity-index sequence changes', () => {
  const game = createGame({ config: stashConfig });
  stock(game, { file: { rare: 1 } });
  const root = document.createElement('div');
  const render = mountTestUi(root, game);
  const legend = root.querySelector<HTMLElement>('.rarity-legend')!;
  expect(legend.textContent).toBe('Rare');
  expect(legend.firstElementChild!.className).toBe('rarity-1');
  const first = legend.firstElementChild;
  const replace = vi.spyOn(legend, 'replaceChildren');
  render();
  stock(game, { file: { rare: 2 }, other: { rare: 3 } });
  render();
  expect(replace).not.toHaveBeenCalled();
  expect(legend.firstElementChild).toBe(first);
  see(game, { file: { common: true, rare: true } });
  render();
  expect(replace).toHaveBeenCalledOnce();
  expect([...legend.children].map((e) => e.textContent)).toEqual(['Common', 'Rare']);
  render();
  expect(replace).toHaveBeenCalledOnce();
});
