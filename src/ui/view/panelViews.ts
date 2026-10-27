/**
 * @module ui
 *
 * The smaller panels: the tabs, the Skills tab, the Automation tab and the Stats tab.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, the text table.
 */
import { AUTOMATION_FEATURES, type GameConfig, type SkillQueries, type GameStateView } from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { resleeveTiers } from './buyableViews';
import type { AutomationView, BuyableView, RunRowView, RunsView, SkillsView, TabView } from './viewTypes';

/** The latest finished sleeve-runs, newest first. */
export function runsView(runs: GameStateView['runs'], config: GameConfig, text: UiText): RunsView {
  const shown = runs.slice(-config.resleeve.runsShown);
  const firstNumber = runs.length - shown.length + 1;
  return {
    title: text.titles.stats,
    rows: shown
      .map(
        (run, i): RunRowView => ({
          label: text.runs.label(firstNumber + i),
          incomeText: text.format.income(formatBigNum(run.creditsPerSecond)),
          levelsText: formatPlain(run.actionLevelsTotal),
        }),
      )
      .reverse(),
  };
}

/**
 * The tabs at the top. None shows until something is worth a tab: a skill point, an automation point or a finished sleeve-run.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.skillPoints`, `resleevePoints`, `automation`.
 *
 * @param engine the engine to read from
 * @param state the game state
 * @param text the display text
 */
export function tabsView(engine: SkillQueries, state: GameStateView, text: UiText): TabView[] {
  const automation = engine.automation();
  const statsShown = state.runs.length > 0; // the first re-sleeve writes the first run down
  const skillsShown = engine.skillPointsEarned() > 0 || statsShown; // the re-sleeve skills are on the Skills tab
  const automationShown = automation.pointsEarned() > 0;
  const tabsShown = skillsShown || automationShown || statsShown;
  return [
    { id: 'character', label: text.tabs.character, visible: tabsShown, attention: false },
    {
      id: 'skills',
      label: text.tabs.skills(engine.skillPoints() + engine.resleevePoints()),
      visible: skillsShown,
      attention: engine.skillPoints() + engine.resleevePoints() > 0,
    },
    {
      id: 'automation',
      label: text.tabs.automation(automation.pointsAvailable()),
      visible: automationShown,
      attention: automation.pointsAvailable() > 0,
    },
    { id: 'stats', label: text.tabs.stats, visible: statsShown, attention: false },
  ];
}

/**
 * The Skills tab, with the group of re-sleeve skills.
 *
 * Called by: {@link buildViewModel}. Calls: {@link resleeveTiers}.
 *
 * @param engine the engine to read from
 * @param state the game state
 * @param config game configuration
 * @param buyableViews the view of every buyable
 * @param viewById the same views by id
 * @param text the display text
 */
export function skillsView(
  engine: SkillQueries,
  state: GameStateView,
  config: GameConfig,
  buyableViews: readonly BuyableView[],
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
): SkillsView {
  return {
    title: text.titles.skills,
    points: engine.skillPoints(),
    pointsText: text.skills.points(formatPlain(engine.skillPoints())),
    buyables: buyableViews.filter((b) => config.buyables.find((d) => d.id === b.id)?.currency === 'skillPoints'),
    resleeve: {
      title: text.titles.resleeveSkills,
      visible: state.runs.length > 0,
      points: engine.resleevePoints(),
      pointsText: text.skills.resleevePoints(formatPlain(engine.resleevePoints())),
      tiers: resleeveTiers(config, viewById),
    },
  };
}

/**
 * The Automation tab.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.automation`.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param text the display text
 */
export function automationView(engine: SkillQueries, config: GameConfig, text: UiText): AutomationView {
  const automation = engine.automation();
  return {
    title: text.titles.automation,
    points: automation.pointsAvailable(),
    pointsText: text.automation.points(formatPlain(automation.pointsAvailable())),
    features: AUTOMATION_FEATURES.map((id) => ({
      id,
      name: text.automation.features[id].name,
      description: text.automation.features[id].description,
      unlocked: automation.isUnlocked(id),
      canUnlock: !automation.isUnlocked(id) && automation.pointsAvailable() >= 1,
    })),
    autoBurn: {
      on: automation.isAutoBurnOn(),
      switchText: text.automation.autoBurnSwitch(automation.isAutoBurnOn()),
      ceiling: automation.autoBurnCeiling(),
      ceilingLabel: text.automation.autoBurnCeiling,
    },
    rarities: config.items.rarities.map((r) => ({ id: r.id, name: r.name, on: automation.isAutosaleOn(r.id) })),
    actions: config.actions.map((a) => ({ id: a.id, name: a.name, percent: automation.dispersal(a.id) })),
    shareLabel: text.automation.dispersalShare,
  };
}
