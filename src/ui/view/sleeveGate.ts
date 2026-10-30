/**
 * @module ui
 *
 * Whether the Sleeve levels unlock is owned: until then the sleeve XP bars and the Re-sleeve button stay hidden.
 *
 * @remarks
 * Called by: `viewModel.ts`, `actionView.ts`, `panelViews.ts`. Pure; reads the same rules as the game (`sleeveLevelsGateId`, `resleeveGateId`).
 */
import { type GameConfig, type GameQueries, resleeveGateId, sleeveLevelsGateId, type StateSliceView } from '../../core';
import type { BuyableView, ResleeveBuyView } from './viewTypes';

/**
 * Whether sleeve levels and re-sleeving are open.
 *
 * Called by: `viewModel.ts`, `actionView.ts`.
 *
 * @param state the game state (reads `purchased`)
 * @param config game configuration (finds the unlock buyable)
 * @returns `true` when sleeve levels and re-sleeving are open: the unlock is owned, or the content has no such unlock
 */
export function sleeveLevelsOpen(state: StateSliceView<'purchased'>, config: Pick<GameConfig, 'buyables'>): boolean {
  const id = sleeveLevelsGateId(config.buyables);
  return id === null || (state.sleeve.purchased[id] ?? 0) > 0;
}

/**
 * Whether the re-sleeve skill trees show: the player has ever earned a re-sleeve point.
 *
 * @remarks
 * Re-sleeve points are `runs.length x resleeve.pointsPerResleeve` (`pointsPerResleeve` >= 1), so a finished sleeve-run is exactly
 * "a point was earned" (the same fact that shows the Stats tab and opens the re-sleeve skill text).
 *
 * Called by: `panelViews.ts`.
 *
 * @param state the game state (reads `runs`)
 * @returns `true` once at least one sleeve-run has finished
 */
export function resleeveSkillsShown(state: StateSliceView<'runs'>): boolean {
  return state.wallet.runs.length > 0;
}

/**
 * The Unlock resleeving purchase as the Re-sleeve button shows it before it is bought (the button itself shows once Sleeve levels is owned).
 *
 * Called by: `viewModel.ts`.
 *
 * @param state the game state (reads `purchased`)
 * @param config game configuration (finds the unlock buyable)
 * @param viewById the view of every buyable
 * @returns the text, tip and affordability to put on the button, or `null` when there is no such unlock, it is owned, or Sleeve levels is not owned yet (the price-reach rule does not apply: owning Sleeve levels is enough)
 */
export function resleeveBuyView(
  state: StateSliceView<'purchased'>,
  config: Pick<GameConfig, 'buyables'>,
  viewById: ReadonlyMap<string, BuyableView>,
): ResleeveBuyView | null {
  const id = resleeveGateId(config.buyables);
  const view = id === null ? undefined : viewById.get(id);
  if (!id || !view || (state.sleeve.purchased[id] ?? 0) > 0 || !sleeveLevelsOpen(state, config)) return null;
  return { id, text: `${view.name}: ${view.costText} ${view.costUnit}`, tip: view.tip, affordable: view.affordable };
}

/**
 * The sleeve levels the next re-sleeve is short of, for the Re-sleeve button's tip.
 *
 * Called by: `viewModel.ts`. Calls: `GameQueries.resleeveRequirement`.
 *
 * @param engine the game's queries
 * @param state the game state (reads `purchased`)
 * @param config game configuration (finds the unlock buyable)
 * @returns what is held and needed, or `null` when the unlock is not owned (nothing about sleeve levels is shown yet), the content has no
 *   level rule, or the levels held are enough
 */
export function resleeveShortfallView(
  engine: Pick<GameQueries, 'resleeveRequirement'>,
  state: StateSliceView<'purchased'>,
  config: Pick<GameConfig, 'buyables'>,
): { readonly held: number; readonly needed: number } | null {
  if (!sleeveLevelsOpen(state, config)) return null;
  const need = engine.resleeveRequirement();
  return need !== null && need.held < need.needed ? need : null;
}
