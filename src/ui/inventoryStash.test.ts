/** @module testing
 * Stash formatting and reveal contracts. Called by: Vitest. Calls: inventoryView and inventoryKit.
 */
import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../app/createGame';
import { formatBigNum, num } from '../numbers';
import { stock, see, stashConfig } from './inventoryKit';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

describe('stash view', () => {
  it('zero owned still quotes one item and explicitly quotes +0 for the whole stack', () => {
    const game = createGame({ config: stashConfig });
    const row = buildViewModel(game).inventory.rows[0]!;
    expect(row.sellOneText).toBe(uiText.stash.gain(formatBigNum(game.sellValue('common'))));
    expect(row.sellAllText).toBe('+0');
  });

  it.each([1e300, 1e308])('formats %s items with decimal multiplication, never NaN or native overflow', (count) => {
    const game = createGame({ config: stashConfig });
    stock(game, { file: { rare: count } });
    const row = buildViewModel(game).inventory.rows.find((r) => r.itemId === 'file' && r.rarityId === 'rare')!;
    const price = game.sellValue('rare');
    expect(row.sellOneText).toBe(uiText.stash.gain(formatBigNum(price)));
    expect(row.sellAllText).toBe(uiText.stash.gain(formatBigNum(price.mul(num(count)))));
    // Products exceed native JS range yet remain finite scientific text through BigNum.
    expect(row.sellAllText).toBe(count === 1e300 ? '+1e302' : '+1e310');
    expect(row.sellAllText).not.toMatch(/NaN|Infinity/);
  });

  it('kept items return null gains; titles and captions come from item and text data', () => {
    const game = createGame({ config: stashConfig });
    const rows = buildViewModel(game).inventory.rows;
    expect(rows.find((r) => r.itemId === 'file')).toMatchObject({ name: 'File', caption: 'COMMON' });
    expect(rows.find((r) => r.itemId === 'tool')).toMatchObject({ caption: 'CONSUMABLE', sellOneText: null, sellAllText: null });
    expect(rows.filter((r) => !r.sellable).every((r) => r.sellOneText === null && r.sellAllText === null)).toBe(true);
  });

  it('uses custom text and builds gains lazily when read', () => {
    const gain = vi.fn((v: string) => 'gain ' + v);
    const game = createGame({ config: stashConfig });
    const view = buildViewModel(game, undefined, { ...uiText, stash: { consumable: 'TOOL', caption: (r) => 'tier ' + r, gain } });
    expect(gain).not.toHaveBeenCalled();
    expect(view.inventory.rows[0]!.caption).toBe('tier Common');
    expect(view.inventory.rows.find((r) => r.itemId === 'tool')!.caption).toBe('TOOL');
    expect(view.inventory.rows[0]!.sellOneText).toBe('gain 10');
    expect(gain).toHaveBeenCalledOnce();
  });

  it('legend excludes unseen and kept-only rows, orders rarities and deduplicates them', () => {
    const game = createGame({ config: stashConfig });
    expect(buildViewModel(game).inventory.legend).toEqual([]);
    see(game, { kept: { common: true, rare: true } });
    expect(buildViewModel(game).inventory.legend).toEqual([]);
    see(game, { file: { rare: true }, other: { common: true, rare: true } });
    expect(buildViewModel(game).inventory.legend).toEqual([
      { rarityIndex: 0, name: 'Common' },
      { rarityIndex: 1, name: 'Rare' },
    ]);
  });

  it('show-all legend matches its shown sellable rows', () => {
    const game = createGame({ config: stashConfig });
    expect(buildViewModel(game, undefined, undefined, { augmentRarityId: null, revealAll: true }).inventory.legend).toEqual([
      { rarityIndex: 0, name: 'Common' },
      { rarityIndex: 1, name: 'Rare' },
    ]);
  });
});
