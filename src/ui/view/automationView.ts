/**
 * @module ui
 *
 * The Automation tab's view: the feature lanes, the owner-sourced Auto Burn panel, and autosale/dispersal controls.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries.automation`, `buildSkillLanes`, `autoBurnView`.
 */
import { AUTOMATION_FEATURES, type ActionQueries, type GameConfig, type SkillQueries } from '../../core';
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { autoBurnView } from './autoBurnView';
import type { RevealTracker } from './revealTracker';
import { buildSkillLanes } from './skillTree';
import type { AutomationView, BuyableView, SkillLaneView } from './viewTypes';

/**
 * The Automation tab.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.automation`, {@link buildSkillLanes}.
 *
 * Each feature carries its own skill lane (the buyables paid in automation points whose branch is the feature's id), laid out like a
 * skill tree and never masked: the whole lane is shown from the start.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param viewById the view of every buyable, by id
 * @param text the display text
 * @param revealAll test aid: no skill is masked (none is anyway)
 * @param tracker the reveal ledger reader
 */
export function automationView(
  engine: SkillQueries & Pick<ActionQueries, 'overclockStatus' | 'isUnlocked'>,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  revealAll = false,
  tracker?: RevealTracker,
): AutomationView {
  const automation = engine.automation();
  const burn = automation.autoBurn();
  const owned = (id: string): number => viewById.get(id)?.owned ?? 0;
  const laneOf = (feature: string): SkillLaneView[] =>
    buildSkillLanes({
      viewById,
      owned,
      hiddenText: text.skills.hidden,
      revealAll,
      ...(tracker ? { tracker } : {}),
      skills: config.buyables.filter((b) => b.currency === 'automationPoints' && b.branch === feature),
      laneTitle: () => '', // the feature's own heading says it
      open: true,
    });
  return {
    title: text.titles.automation,
    points: automation.pointsAvailable(),
    pointsText: text.automation.points(formatPlain(automation.pointsAvailable())),
    features: AUTOMATION_FEATURES.map((id) => ({
      id,
      name: text.automation.features[id].name,
      description: text.automation.features[id].description,
      unlocked: automation.isUnlocked(id),
      lanes: laneOf(id),
    })),
    autoBurn: autoBurnView(burn, engine, config, viewById, text),
    rarities: config.items.rarities.map((r) => ({ id: r.id, name: r.name, on: automation.isAutosaleOn(r.id) })),
    actions: config.actions.map((a) => ({ id: a.id, name: a.name, percent: automation.dispersal(a.id) })),
    shareLabel: text.automation.dispersalShare,
  };
}
