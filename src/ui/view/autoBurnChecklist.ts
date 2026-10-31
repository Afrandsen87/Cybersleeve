/**
 * @module ui
 *
 * Auto Burn's resume checklists: the heat-making Overclocks and Auto-runs the player can tick for the two resume switches.
 *
 * @remarks
 * Called by: `autoBurnView.ts`. Calls: `AutoBurnControls`, `ActionQueries.isUnlocked`, `.overclockStatus`, `heatMakingOverclockActions`, `heatMakingAutoRuns`.
 */
import { type ActionQueries, type AutoBurnControls, type GameConfig, heatMakingAutoRuns, heatMakingOverclockActions } from '../../core';
import type { BuyableView, ResumeChecklistView } from './viewTypes';

/**
 * Both checklists. A row exists for every heat-making Overclock and Auto-run of an action the player can reach (its access level is met);
 * one the player does not own yet is `locked` (shown, not tickable). Each list is shown with its switch's skill.
 *
 * Called by: `autoBurnView`. Calls: `heatMakingOverclockActions`, `heatMakingAutoRuns`, `AutoBurnControls`, `ActionQueries`.
 *
 * @param burn the Auto Burn controls (what is ticked, which skills are owned)
 * @param engine says which actions are reachable and which Overclocks are owned
 * @param config the actions and buyables (names, which make heat)
 * @param viewById the buyable views (ownership of the Auto-runs)
 */
export function resumeChecklists(
  burn: AutoBurnControls,
  engine: Pick<ActionQueries, 'overclockStatus' | 'isUnlocked'>,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
): { resumeOverclocks: ResumeChecklistView; resumeAutoRuns: ResumeChecklistView } {
  const rules = burn.rules();
  const actionName = (id: string | undefined): string => config.actions.find((a) => a.id === id)?.name ?? id ?? '';
  return {
    resumeOverclocks: {
      visible: burn.stepOwned('onOverclocks'),
      items: heatMakingOverclockActions(config.actions)
        .filter((id) => engine.isUnlocked(id))
        .map((id) => ({
          id,
          name: actionName(id),
          ticked: rules.resumeOverclocks[id] === true,
          locked: engine.overclockStatus(id) === null,
        })),
    },
    resumeAutoRuns: {
      visible: burn.stepOwned('onActions'),
      items: heatMakingAutoRuns(config.buyables, config.actions)
        .map((id) => ({ id, actionId: config.buyables.find((b) => b.id === id)?.actionId }))
        .filter(({ actionId }) => actionId !== undefined && engine.isUnlocked(actionId))
        .map(({ id, actionId }) => ({
          id,
          name: actionName(actionId),
          ticked: rules.resumeAutoRuns[id] === true,
          locked: (viewById.get(id)?.owned ?? 0) <= 0,
        })),
    },
  };
}
