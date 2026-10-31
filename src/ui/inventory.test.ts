import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { config, stock, see } from '../testing/inventoryKit';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

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
      'Rare File\nUsed as blackmail: pays flat 100 credits each\nClick to select it, then press Sell or Sell all\n\nDrop Chance = 0%\nOwned = 2\nPayment = 200 credits',
    );
  });

  it('the tip says where the stack drops from: the chance per completed run of each action that can drop it', () => {
    const g = createGame({ config });
    setCredits(g, num(10));
    g.buy('harvest'); // chance 1, every drop common
    const [common, rare] = buildViewModel(g).inventory.rows;
    expect(common!.tip).toContain('\nDrop Chance = 100% per A run\n');
    expect(rare!.tip).toContain('\nDrop Chance = 0%\n');
  });

  it('is hidden until an item has been seen or is held; owning a drop source alone does not show it', () => {
    const g = createGame({ config });
    expect(buildViewModel(g).inventory.visible).toBe(false);
    stock(g, { file: { common: 1 } });
    expect(buildViewModel(g).inventory.visible).toBe(true);
    const owner = createGame({ config });
    setCredits(owner, num(10));
    owner.buy('harvest');
    expect(buildViewModel(owner).inventory.visible).toBe(false);
    const seen = createGame({ config });
    see(seen, { file: { common: true } }); // found once, none left
    expect(buildViewModel(seen).inventory.visible).toBe(true);
  });

  it('show-all shows the inventory and every row', () => {
    const vm = buildViewModel(createGame({ config }), undefined, undefined, { augmentRarityId: null, revealAll: true });
    expect(vm.inventory.visible).toBe(true);
    expect(vm.inventory.rows.every((r) => r.unlocked)).toBe(true);
  });

  it('takes its words from the text table', () => {
    const g = createGame({ config });
    const vm = buildViewModel(g, undefined, { ...uiText, titles: { ...uiText.titles, inventory: 'STASH' } });
    expect(vm.inventory.title).toBe('STASH');
    expect(vm.inventory.rows).toHaveLength(2);
  });
});
