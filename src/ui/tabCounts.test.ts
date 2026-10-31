/**
 * @module ui
 * Separate tab labels and point badges, without changing attention behavior.
 * Called by: vitest. Calls: game, flat, buildViewModel.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { flat } from '../testing/flatState';
import { game } from '../testing/gameKit';

import { buildViewModel } from './viewModel';

describe('tab counts', () => {
  it('uses plain labels and null counts before points exist', () => {
    const tabs = buildViewModel(game()).tabs;
    expect(tabs.map((tab) => tab.count)).toEqual([null, null, null, null, null]);
    expect(tabs.map((tab) => tab.label)).toEqual(['Character', 'Skills', 'Automation', 'Stats', 'Corporation']);
  });

  it('counts both skill and re-sleeve points separately from the label', () => {
    const g = game();
    g.resleeve();
    flat<{ actions: Record<string, { xp: unknown }> }>(g).actions['a']!.xp = num(10);
    const tab = buildViewModel(g).tabs.find((entry) => entry.id === 'skills')!;
    expect(tab).toMatchObject({ label: 'Skills', count: 2, attention: true });
    expect(buildViewModel(g, undefined, undefined, { activeTab: 'skills', augmentRarityId: null }).tabs[1]!.attention).toBe(false);
  });
});
