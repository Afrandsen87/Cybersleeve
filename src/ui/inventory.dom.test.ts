// @vitest-environment happy-dom
import { hoverText } from '../testing/hover';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { config, stock, see } from './inventoryKit';
import { buildViewModel } from './viewModel';
import { mountTestUi } from '../testing/domMountKit';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('inventory widget', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountTestUi(root, game);
    const widget = root.querySelector<HTMLElement>('.inventory-widget')!;
    const tiles = () => [...widget.querySelectorAll<HTMLButtonElement>('.item-tile')];
    const button = (label: string) =>
      [...widget.querySelectorAll<HTMLButtonElement>('.inventory-action')].find(
        (b) => (b.querySelector('span')?.textContent ?? b.textContent) === label,
      )!;
    return { root, game, render, widget, tiles, button };
  };

  it('starts hidden and comes after the Network and Upgrades widgets, in the right-hand part of the top band', () => {
    const { root, widget } = mount();
    const right = [...root.querySelector('.dashboard-right')!.children];
    expect(right.map((e) => e.className.split(' ')[0])).toEqual(['network-widget', 'upgrades-widget', 'inventory-widget']);
    expect(widget.hidden).toBe(true);
  });

  it('lists every possible stack as a tile, held or not, with a name and count beside the icon', () => {
    const { game, render, widget, tiles } = mount();
    stock(game, { file: { rare: 2 } });
    render();
    expect(widget.hidden).toBe(false);
    expect(tiles()).toHaveLength(2); // Common File and Rare File
    expect(tiles().map((t) => t.hidden)).toEqual([true, false]); // the common one was never seen
    expect(tiles().map((t) => t.querySelector('.item-count')!.textContent)).toEqual(['0', '2']);
    expect(tiles().map((t) => t.classList.contains('empty'))).toEqual([true, false]);
    // Slots keep the icon, title/caption and count in order.
    expect([...tiles()[1]!.children].map((c) => c.className.split(' ')[0])).toEqual(['item-icon', 'item-name', 'item-count']);
    expect(hoverText(tiles()[1]!)).toContain('Payment = 200 credits');
  });

  it('owning a drop source shows nothing; the first drop shows the rarity that dropped, and it stays when sold', () => {
    const { game, render, widget, tiles } = mount();
    setCredits(game, num(10));
    game.buy('harvest');
    render();
    expect(widget.hidden).toBe(true);
    game.startAction('a');
    game.tick(10_001); // every drop is common
    render();
    expect(widget.hidden).toBe(false);
    expect(tiles().map((t) => t.hidden)).toEqual([false, true]); // the rare one has not been found
    game.sellItems('file', 'common', 'all');
    render();
    expect(tiles().map((t) => [t.hidden, t.querySelector('.item-count')!.textContent])).toEqual([
      [false, '0'],
      [true, '0'],
    ]);
  });

  it('hides an item until one of its rarities is seen, and then only the rarities seen or held', () => {
    const { game, render, widget } = mount();
    render();
    expect(widget.querySelector<HTMLElement>('.item-group')!.hidden).toBe(true);
    expect(buildViewModel(game).inventory.rows.every((r) => !r.unlocked)).toBe(true);
    see(game, { file: { rare: true } });
    render();
    expect(widget.querySelector<HTMLElement>('.item-group')!.hidden).toBe(false);
    expect(buildViewModel(game).inventory.rows.map((r) => r.unlocked)).toEqual([false, true]);
    stock(game, { file: { common: 1 } });
    expect(buildViewModel(game).inventory.rows.map((r) => r.unlocked)).toEqual([true, true]);
    stock(game, { file: {} }); // the last one used: the tile stays
    expect(buildViewModel(game).inventory.rows.map((r) => r.unlocked)).toEqual([true, true]);
  });

  it('an item without rarity is one row, shown by the same rule', () => {
    const none = createConfig(config, {
      items: {
        ...config.items,
        definitions: [...config.items.definitions, { id: 'tool', name: 'Tool', sellable: false, hasRarity: false }],
      },
    });
    const g = createGame({ config: none });
    expect(
      buildViewModel(g)
        .inventory.rows.filter((r) => r.itemId === 'tool')
        .map((r) => r.unlocked),
    ).toEqual([false]);
    see(g, { tool: { common: true } });
    expect(
      buildViewModel(g)
        .inventory.rows.filter((r) => r.itemId === 'tool')
        .map((r) => r.unlocked),
    ).toEqual([true]);
  });

  it('an item held without a drop source (a shard) is shown by being held, in the rarity held', () => {
    const g = createGame({ config });
    stock(g, { file: { rare: 1 } });
    expect(buildViewModel(g).inventory.rows.map((r) => r.unlocked)).toEqual([false, true]);
  });

  it('puts sellable items in their own section to the right of the others', () => {
    const { game, render, widget } = mount();
    see(game, { file: { common: true, rare: true } });
    render();
    const sections = [...widget.querySelectorAll<HTMLElement>('.inventory-section')];
    expect(sections).toHaveLength(2);
    expect(sections[1]!.classList.contains('inventory-for-sale')).toBe(true);
    expect(sections[0]!.hidden).toBe(true); // this content has nothing that is only kept
    expect(sections[1]!.hidden).toBe(false);
    expect(sections[1]!.querySelectorAll('.item-tile')).toHaveLength(2);
  });

  it('keeps item containers in the shared slot grid of their section', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const two = createConfig(config, {
      items: {
        ...config.items,
        definitions: [
          ...config.items.definitions,
          { id: 'gem', name: 'Gem', sellable: false },
          { id: 'tool', name: 'Tool', sellable: false, hasRarity: false },
        ],
      },
    });
    mountTestUi(root, createGame({ config: two }));
    const [kept, forSale] = [...root.querySelectorAll<HTMLElement>('.inventory-section')];
    const groups = (section: HTMLElement) =>
      [...section.querySelectorAll<HTMLElement>('.item-group')].map((g) => g.querySelectorAll('.item-tile').length);
    expect(groups(kept!)).toEqual([2, 1]); // Gem in both rarities, then the Tool with none
    expect(groups(forSale!)).toEqual([2]); // File
    // The stylesheet flows all item containers into the same two-column slot grid.
    expect(kept!.querySelectorAll('.item-grid')).toHaveLength(1);
  });

  it('the sell buttons are beside the sellable tiles and are disabled until a stack is selected', () => {
    const { game, render, widget, button } = mount();
    stock(game, { file: { rare: 3 } });
    render();
    expect(widget.querySelector('.inventory-for-sale .inventory-actions')).not.toBeNull();
    expect(button('Sell').disabled).toBe(true);
    expect(button('Sell all').disabled).toBe(true);
  });

  it('a held stack is selected by clicking its tile and deselected by clicking again; an empty one cannot be selected', () => {
    const { game, render, tiles, button } = mount();
    stock(game, { file: { rare: 3 } });
    render();
    tiles()[0]!.click(); // nothing of it is held
    expect(tiles()[0]!.disabled).toBe(true);
    expect(tiles()[0]!.classList.contains('selected')).toBe(false);
    tiles()[1]!.click();
    expect(tiles()[1]!.classList.contains('selected')).toBe(true);
    expect(button('Sell').disabled).toBe(false);
    tiles()[1]!.click();
    expect(tiles()[1]!.classList.contains('selected')).toBe(false);
    expect(button('Sell').disabled).toBe(true);
  });

  it('Sell sells one of the selected stack and Sell all the rest, and the screen follows', () => {
    const { root, game, render, tiles, button } = mount();
    stock(game, { file: { rare: 3 } });
    render();
    tiles()[1]!.click();
    button('Sell').click();
    expect(game.getState().wallet.inventory['file']!['rare']).toBe(2);
    expect(game.getState().wallet.credits.eq(num(100))).toBe(true);
    expect(tiles()[1]!.querySelector('.item-count')!.textContent).toBe('2');
    expect(root.querySelector('.credits')!.textContent).toBe('100');
    expect(tiles()[1]!.classList.contains('selected')).toBe(true); // still selected: sell more
    button('Sell all').click();
    expect(game.getState().wallet.credits.eq(num(300))).toBe(true);
    expect(tiles()[1]!.querySelector('.item-count')!.textContent).toBe('0');
    expect(tiles()[1]!.classList.contains('selected')).toBe(false); // sold out: the selection is dropped
    expect(button('Sell all').disabled).toBe(true);
  });

  it('selecting another stack moves the selection, and the buttons sell that one', () => {
    const { game, render, tiles, button } = mount();
    stock(game, { file: { common: 1, rare: 1 } });
    render();
    tiles()[0]!.click();
    tiles()[1]!.click();
    expect(tiles().map((t) => t.classList.contains('selected'))).toEqual([false, true]);
    button('Sell').click();
    expect(game.getState().wallet.inventory['file']).toEqual({ common: 1, rare: 0 });
  });

  it('the tile is named for assistive technology and the tip tells how to sell', () => {
    const { game, render, tiles } = mount();
    stock(game, { file: { rare: 1 } });
    render();
    expect(tiles()[1]!.getAttribute('aria-label')).toBe('Rare File');
    expect(hoverText(tiles()[1]!)).toContain('Click to select it, then press Sell or Sell all');
  });

  it('shows the icon of the item on its tile, or its initials without one', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    stock(game, { file: { common: 1 } });
    const icons = { urlFor: (id: string) => (id === 'file' ? 'url("icon-file")' : null) };
    mountTestUi(root, game, { icons });
    const icon = root.querySelector<HTMLElement>('.item-tile .item-icon')!;
    expect(icon.style.getPropertyValue('--icon')).toBe('url("icon-file")');
    document.body.innerHTML = '';
    const plain = mount();
    expect(plain.tiles()[0]!.querySelector('.item-icon')!.textContent).toBe('F');
  });

  it('colours the tile by rarity: the most common has none, the next ones their own', () => {
    const { tiles } = mount();
    expect(tiles()[0]!.className).toContain('rarity-0');
    expect(tiles()[1]!.className).toContain('rarity-1');
  });

  it('the Test drop button in the corner drops an item and shows the Inventory', () => {
    const { root, game, widget, tiles } = mount();
    const button = root.querySelector<HTMLButtonElement>('.debug-bar .test-drop')!;
    expect(button.textContent).toBe('Test drop');
    expect(widget.hidden).toBe(true);
    button.click();
    expect(widget.hidden).toBe(false);
    expect(tiles().filter((t) => !t.classList.contains('empty'))).toHaveLength(1);
    expect(game.getState().wallet.inventory['file']!['common']).toBe(1);
  });

  it('the button is left out with the other test aids when they are off', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountTestUi(root, createGame({ config }), { debugControls: false });
    expect(root.querySelector('.test-drop')).toBeNull();
  });
});
