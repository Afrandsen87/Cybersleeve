/**
 * The "Show all" test aid: with `revealAll` set the view model hides nothing.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { config } from './modesKit';
import { buildViewModel } from './viewModel';
import { skillViews } from '../testing/skillViews';

describe('revealAll (view model)', () => {
  const plain = () => buildViewModel(createGame({ config }));
  const revealed = () => buildViewModel(createGame({ config }), undefined, undefined, { augmentRarityId: null, revealAll: true });

  it('shows every tab and the re-sleeve skills on a fresh game, where the rules hide them', () => {
    expect(plain().tabs.every((t) => t.visible)).toBe(false);
    expect(revealed().tabs.every((t) => t.visible)).toBe(true);
    expect(revealed().skills.resleeve.visible).toBe(true);
  });

  it('shows every purchase and every stat row and the inventory', () => {
    const vm = revealed();
    const all = [...vm.actions.flatMap((a) => a.buyables), ...vm.sleeve.buyables, ...skillViews(vm.skills.lanes)];
    expect(all.every((b) => b.available)).toBe(true);
    expect([...vm.sleeve.stats, ...vm.network.stats].some((s) => s.hidden)).toBe(false);
    expect(vm.inventory.visible).toBe(true);
    expect(vm.inventory.rows.every((r) => r.unlocked)).toBe(true);
    expect(vm.actions.every((a) => a.sleeveShown)).toBe(true);
  });

  it('does not change the game rules view when off', () => {
    expect(buildViewModel(createGame({ config }), undefined, undefined, { augmentRarityId: null, revealAll: false })).toEqual(plain());
  });
});
