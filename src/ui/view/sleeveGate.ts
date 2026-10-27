/**
 * @module ui
 *
 * Whether the sleeve-levels unlock is owned: until then the sleeve XP bars, the Re-sleeve button and the re-sleeve skill tree stay hidden.
 *
 * @remarks
 * Called by: `viewModel.ts`, `actionView.ts`, `panelViews.ts`. Pure; reads the same rule as the game (`sleeveLevelsGateId`).
 */
import { type GameConfig, type GameStateView, sleeveLevelsGateId } from '../../core';
import type { BuyableView, ResleeveBuyView } from './viewTypes';

/**
 * Whether sleeve levels and re-sleeving are open.
 *
 * Called by: `viewModel.ts`, `actionView.ts`, {@link resleeveSkillsShown}.
 *
 * @param state the game state (reads `purchased`)
 * @param config game configuration (finds the unlock buyable)
 * @returns `true` when sleeve levels and re-sleeving are open: the unlock is owned, or the content has no such unlock
 */
export function sleeveLevelsOpen(state: Pick<GameStateView, 'purchased'>, config: Pick<GameConfig, 'buyables'>): boolean {
  const id = sleeveLevelsGateId(config.buyables);
  return id === null || (state.purchased[id] ?? 0) > 0;
}

/**
 * Whether the re-sleeve skill tree shows.
 *
 * Called by: `panelViews.ts`.
 *
 * @param state the game state (reads `purchased` and `runs`)
 * @param config game configuration
 * @returns `true` when the re-sleeve skill tree shows: the unlock is owned; in a game without that unlock, once a sleeve-run has finished
 */
export function resleeveSkillsShown(state: Pick<GameStateView, 'purchased' | 'runs'>, config: Pick<GameConfig, 'buyables'>): boolean {
  return sleeveLevelsGateId(config.buyables) === null ? state.runs.length > 0 : sleeveLevelsOpen(state, config);
}

/**
 * The sleeve-levels unlock as the Re-sleeve button shows it before it is bought.
 *
 * Called by: `viewModel.ts`.
 *
 * @param state the game state (reads `purchased`)
 * @param config game configuration (finds the unlock buyable)
 * @param viewById the view of every buyable
 * @returns the text, tip and affordability to put on the button, or `null` when there is no such unlock, it is owned, or it is not in reach yet
 */
export function resleeveBuyView(
  state: Pick<GameStateView, 'purchased'>,
  config: Pick<GameConfig, 'buyables'>,
  viewById: ReadonlyMap<string, BuyableView>,
): ResleeveBuyView | null {
  const id = sleeveLevelsGateId(config.buyables);
  const view = id === null ? undefined : viewById.get(id);
  if (!id || !view || (state.purchased[id] ?? 0) > 0 || !view.available) return null;
  return { id, text: `${view.name}: ${view.costText} ${view.costUnit}`, tip: view.tip, affordable: view.affordable };
}
