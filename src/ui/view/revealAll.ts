/**
 * @module ui
 *
 * The "show everything" test aid: turns every rule that hides something on the screen off.
 *
 * @remarks
 * Called by: `viewModel.ts` (only while `ViewSelection.revealAll` is set). Pure: no DOM, no state of its own.
 * The purchases, the masked sleeve skills and the Inventory are revealed where they are built (`buildBuyableViews`, `skillsView`,
 * `inventoryView`, which also lists every rarity in the For-sale legend then); the rest is
 * flipped here. Locked actions are shown in full by the `reveal-locked` class that the same switch puts on the page.
 */
import type { StatRowView, ViewModel } from './viewTypes';

/** The same row, shown. */
const shown = (row: StatRowView): StatRowView => (row.hidden ? { ...row, hidden: false } : row);

/**
 * Returns the view model with every hidden part shown: all tabs, the sleeve skills, every stat row, the sleeve XP bars. (The Re-sleeve button shows as the purchase of the sleeve-levels unlock, which is revealed with the
 * other purchases.)
 *
 * Called by: `buildViewModel`.
 *
 * @param vm the view model as the rules of the game build it
 * @returns a copy with the hiding turned off (the input is not modified)
 */
export function revealEverything(vm: ViewModel): ViewModel {
  return {
    ...vm,
    tabs: vm.tabs.map((t) => ({ ...t, visible: true })),
    skills: { ...vm.skills, resleeve: { ...vm.skills.resleeve, visible: true } },
    network: { ...vm.network, stats: vm.network.stats.map(shown) },
    corporation: {
      ...vm.corporation,
      stats: vm.corporation.stats.map(shown),
      holdings: { ...vm.corporation.holdings, stats: vm.corporation.holdings.stats.map(shown) },
    },
    sleeve: { ...vm.sleeve, stats: vm.sleeve.stats.map(shown) },
    actions: vm.actions.map((a) => ({ ...a, sleeveShown: true })),
  };
}
