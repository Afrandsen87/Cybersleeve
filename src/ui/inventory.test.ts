// @vitest-environment happy-dom
import { hoverText } from '../testing/hover';
import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { createConfig, type BuyableDefinition } from '../core';
import { num } from '../numbers';
import { setCredits, testConfig } from '../testing/testConfig';
import { mountUi, type SpeedControl } from './dom';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

const speed: SpeedControl = { enabled: false, factor: 1, toggle: () => false };

const harvest: BuyableDefinition = {
  id: 'harvest',
  name: 'Harvest',
  description: '',
  actionId: 'a',
  cost: num(5),
  effect: { kind: 'itemDrop', drop: { itemId: 'file', chance: 1, rarityWeights: { common: 1 } } },
};
const config = createConfig(testConfig, { buyables: [...testConfig.buyables, harvest] });

const stock = (g: { getState(): unknown }, inventory: Record<string, Record<string, number>>): void => {
  (g.getState() as { inventory: unknown }).inventory = inventory;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('inventory view model', () => {
  it('has a row per item and rarity, most common first, with the count of each', () => {
    const g = createGame({ config });
    stock(g, { file: { rare: 2 } });
    const rows = buildViewModel(g).inventory.rows;
    expect(rows.map((r) => [r.rarityId, r.count, r.label])).toEqual([
      ['common', 0, 'Common File'],
      ['rare', 2, 'Rare File'],
    ]);
  });

  it('the tip says what one item sells for and what the stack is worth', () => {
    const g = createGame({ config });
    stock(g, { file: { rare: 2 } });
    expect(buildViewModel(g).inventory.rows[1]!.tip).toBe(
      'Rare File\nUsed as blackmail: pays 100 credits each\nHeat and the credit lever leave the payment untouched\n\nOwned = 2\nPayment = 200 credits',
    );
  });

  it('is hidden until something can drop or is held', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).inventory.visible).toBe(false);
    stock(g, { file: { common: 1 } });
    expect(buildViewModel(g).inventory.visible).toBe(true);
    const owner = createGame({ config });
    setCredits(owner, num(10));
    owner.buy('harvest');
    expect(buildViewModel(owner).inventory.visible).toBe(true);
  });

  it('takes its words from the text table', () => {
    const g = createGame({ config });
    const vm = buildViewModel(g, undefined, { ...uiText, titles: { ...uiText.titles, inventory: 'STASH' } });
    expect(vm.inventory.title).toBe('STASH');
    expect(vm.inventory.emptyText).toBe(uiText.inventory.empty);
  });
});

describe('inventory widget', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.append(root);
    const game = createGame({ config });
    const render = mountUi(root, game, speed, () => {});
    const widget = root.querySelector<HTMLElement>('.inventory-widget')!;
    const rows = () => [...widget.querySelectorAll<HTMLElement>('.inventory-row')];
    return { root, game, render, widget, rows };
  };

  it('starts hidden and comes after the Network, Sleeve Improvements and Network Exploitation widgets, in the right-hand part of the top band', () => {
    const { root, widget } = mount();
    const right = [...root.querySelector('.dashboard-right')!.children];
    expect(right.map((e) => e.className.split(' ')[0])).toEqual([
      'network-widget',
      'upgrades-widget',
      'exploitation-widget',
      'inventory-widget',
    ]);
    expect(widget.hidden).toBe(true);
  });

  it('shows only the stacks that are held, with their counts and tips', () => {
    const { game, render, widget, rows } = mount();
    stock(game, { file: { rare: 2 } });
    render();
    expect(widget.hidden).toBe(false);
    expect(rows().map((r) => r.hidden)).toEqual([true, false]);
    expect(rows()[1]!.querySelector('.inventory-count')!.textContent).toBe('2');
    expect(hoverText(rows()[1]!)).toContain('Payment = 200 credits');
    expect((widget.querySelector('.inventory-empty') as HTMLElement).hidden).toBe(true);
  });

  it('says so while nothing is held', () => {
    const { game, render, widget } = mount();
    setCredits(game, num(10));
    game.buy('harvest');
    render();
    expect(widget.hidden).toBe(false);
    expect((widget.querySelector('.inventory-empty') as HTMLElement).hidden).toBe(false);
  });

  it('the sell buttons sell one or all and update the screen', () => {
    const { game, render, root, rows } = mount();
    stock(game, { file: { rare: 3 } });
    render();
    const [sellOne, sellAll] = rows()[1]!.querySelectorAll<HTMLButtonElement>('button');
    sellOne!.click();
    expect(game.getState().inventory['file']!['rare']).toBe(2);
    expect(game.getState().credits.eq(num(100))).toBe(true);
    expect(rows()[1]!.querySelector('.inventory-count')!.textContent).toBe('2');
    expect(root.querySelector('.credits')!.textContent).toBe('Credits: 100');
    sellAll!.click();
    expect(game.getState().credits.eq(num(300))).toBe(true);
    expect(rows()[1]!.hidden).toBe(true);
  });

  it('the Test drop button in the corner drops an item and shows the Inventory', () => {
    const { root, game, widget, rows } = mount();
    const button = root.querySelector<HTMLButtonElement>('.corner-controls .test-drop')!;
    expect(button.textContent).toBe('Test drop');
    expect(widget.hidden).toBe(true);
    button.click();
    expect(widget.hidden).toBe(false);
    expect(rows().filter((r) => !r.hidden)).toHaveLength(1);
    expect(game.getState().inventory['file']!['common']).toBe(1);
  });

  it('the button is left out with the other test aids when they are off', () => {
    const root = document.createElement('div');
    document.body.append(root);
    mountUi(root, createGame({ config }), speed, () => {}, { debugControls: false });
    expect(root.querySelector('.test-drop')).toBeNull();
  });
});
