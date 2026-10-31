/**
 * @module ui
 *
 * Auto Burn's resume checklists: the owned heat-making Overclocks and Auto-runs the player can tick for the two resume switches.
 *
 * @remarks
 * Called by: `panelViews.ts` (`automationView`). Calls: `AutoBurnControls`, `heatMakingOverclockActions`, `heatMakingAutoRuns`.
 */
import { type ActionQueries, type AutoBurnControls, type GameConfig, heatMakingAutoRuns, heatMakingOverclockActions } from '../../core';
import type { BuyableView, ResumeChecklistView } from './viewTypes';

/**
 * Both checklists. A row exists only for something the player owns (an Overclock with a toggle, an Auto-run bought); the list is shown with its switch's skill.
 *
 * Called by: `automationView`.
 *
 * @param burn the Auto Burn controls (what is ticked, which skills are owned)
 * @param engine says which Overclocks are owned
 * @param config the actions and buyables (names, which make heat)
 * @param viewById the buyable views (ownership of the Auto-runs)
 */
export function resumeChecklists(
  burn: AutoBurnControls,
  engine: Pick<ActionQueries, 'overclockStatus'>,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
): { resumeOverclocks: ResumeChecklistView; resumeAutoRuns: ResumeChecklistView } {
  const rules = burn.rules();
  return {
    resumeOverclocks: {
      visible: burn.stepOwned('onOverclocks'),
      items: heatMakingOverclockActions(config.actions)
        .filter((id) => engine.overclockStatus(id) !== null)
        .map((id) => ({
          id,
          name: config.actions.find((a) => a.id === id)?.name ?? id,
          ticked: rules.resumeOverclocks[id] === true,
        })),
    },
    resumeAutoRuns: {
      visible: burn.stepOwned('onActions'),
      items: heatMakingAutoRuns(config.buyables, config.actions)
        .filter((id) => (viewById.get(id)?.owned ?? 0) > 0)
        .map((id) => ({ id, name: viewById.get(id)?.name ?? id, ticked: rules.resumeAutoRuns[id] === true })),
    },
  };
}
