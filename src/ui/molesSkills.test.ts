/**
 * @module ui
 *
 * Moles and the back channel in the view model: the Moles row, the back channel offer on the inventory, and the tips that name them.
 *
 * @remarks
 * Called by: Vitest. Calls: `buildViewModel`, `skillsTabKit.ts`.
 */
import { describe, expect, it } from 'vitest';
import { loose, pointGame } from '../testing/skillsTabKit';
import { buildViewModel, statRow } from './viewModel';

describe('Moles and the back channel in the view model', () => {
  it('the Moles row is hidden until the Back Channel Deals skill is owned (or Moles are held)', () => {
    const g = pointGame();
    expect(statRow(buildViewModel(g).network.stats, 'moles').hidden).toBe(true);
    g.buy('bc');
    const row = statRow(buildViewModel(g).network.stats, 'moles');
    expect(row.hidden).toBe(false);
    expect(row.text).toBe('0');
    loose(g).moles = 12;
    expect(statRow(buildViewModel(g).network.stats, 'moles').text).toBe('12');
    expect(statRow(buildViewModel(g).network.stats, 'moles').tip).toContain('Moles = 12');
  });

  it('the back channel button is offered on the common stack only, once the skill is owned', () => {
    const g = pointGame();
    loose(g).inventory = { file: { common: 2, rare: 1 } };
    expect(buildViewModel(g).inventory.rows.some((r) => r.backChannel)).toBe(false);
    g.buy('bc');
    const rows = buildViewModel(g).inventory.rows;
    expect(rows.map((r) => [r.rarityId, r.backChannel])).toEqual([
      ['common', true],
      ['rare', false],
    ]);
    expect(rows[0]!.backChannelTip).toContain('Give up one for 5 Moles');
    expect(rows[0]!.backChannelTip).toContain('50% faster');
    expect(rows[1]!.backChannelTip).toBe('');
  });

  it('the heat tip mentions the Moles while there are some', () => {
    const g = pointGame();
    g.buy('bc');
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).not.toContain('Moles make it');
    loose(g).moles = 7;
    expect(statRow(buildViewModel(g).sleeve.stats, 'heat').tip).toContain('7 Moles make it 50% faster');
  });

  it('the interface speed tip lists the skill factor once a skill gives one', () => {
    const g = pointGame();
    expect(statRow(buildViewModel(g).sleeve.stats, 'interfaceSpeed').tip).not.toContain('Skills');
    g.buy('s1');
    const tip = statRow(buildViewModel(g).sleeve.stats, 'interfaceSpeed').tip!;
    expect(tip).toContain('x Skills');
    expect(tip).toContain('Skills = 1.05');
  });
});
