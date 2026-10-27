/**
 * @module ui
 *
 * The smaller panels: the tabs, the Skills tab, the Automation tab and the Stats tab.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, the text table.
 */
import { AUTOMATION_FEATURES, type CorporationQueries, type GameConfig, type SkillQueries, type GameStateView } from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { GENERAL_LANE, buildSkillLanes } from './skillTree';
import { resleeveSkillsShown } from './sleeveGate';
import type { AutomationView, BuyableView, RunRowView, RunsView, SkillLaneView, SkillsView, TabView } from './viewTypes';

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
export function tabsView(engine: SkillQueries & CorporationQueries, state: GameStateView, config: GameConfig, text: UiText): TabView[] {
  const automation = engine.automation();
  const statsShown = state.runs.length > 0; // the first re-sleeve writes the first run down
  const skillsShown = engine.skillPointsEarned() > 0 || statsShown || resleeveSkillsShown(state, config); // the re-sleeve skills are on the Skills tab
  const automationShown = automation.pointsEarned() > 0;
  const corporationShown = engine.isCorporationUnlocked();
  const tabsShown = skillsShown || automationShown || statsShown || corporationShown;
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
    { id: 'corporation', label: text.tabs.corporation, visible: corporationShown, attention: false },
  ];
}

/**
 * The Skills tab, with the group of re-sleeve skills.
 *
 * Both trees show every node and every branch title from the start; what a skill says stays hidden until it is readable (see
 * `skillTree.ts`). The re-sleeve skills are all hidden until the first re-sleeve.
 *
 * Called by: {@link buildViewModel}. Calls: {@link buildSkillLanes}.
 *
 * @param engine the engine to read from
 * @param state the game state
 * @param config game configuration
 * @param viewById the view of every buyable, by id
 * @param text the display text
 * @param revealAll test aid: no skill is masked
 */
export function skillsView(
  engine: SkillQueries,
  state: GameStateView,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  revealAll = false,
): SkillsView {
  const owned = (id: string): number => viewById.get(id)?.owned ?? 0;
  const common = { viewById, owned, hiddenText: text.skills.hidden, revealAll };
  const branchTitle = (id: string): string => (id === GENERAL_LANE ? text.skills.generalBranch : (text.skills.branches[id] ?? id));
  const lanes = buildSkillLanes({
    ...common,
    skills: config.buyables.filter((b) => b.currency === 'skillPoints'),
    laneTitle: branchTitle,
    open: true,
  });
  // until the first re-sleeve the player has not seen what the skills do: only their places in the tree show
  const resleeveLanes = buildSkillLanes({
    ...common,
    skills: config.buyables.filter((b) => b.currency === 'resleevePoints'),
    laneTitle: branchTitle,
    open: state.runs.length > 0,
  });
  const resleeveVisible = resleeveSkillsShown(state, config);
  const anyMasked = (l: readonly SkillLaneView[]): boolean => l.some((lane) => lane.nodes.some((n) => n.masked));
  return {
    title: text.titles.skills,
    points: engine.skillPoints(),
    pointsText: text.skills.points(formatPlain(engine.skillPoints())),
    note: text.skills.note,
    noteVisible: anyMasked(lanes) || (resleeveVisible && anyMasked(resleeveLanes)),
    lanes,
    resleeve: {
      title: text.titles.resleeveSkills,
      visible: resleeveVisible,
      points: engine.resleevePoints(),
      pointsText: text.skills.resleevePoints(formatPlain(engine.resleevePoints())),
      lanes: resleeveLanes,
    },
  };
}

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
 */
export function automationView(
  engine: SkillQueries,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  revealAll = false,
): AutomationView {
  const automation = engine.automation();
  const owned = (id: string): number => viewById.get(id)?.owned ?? 0;
  const laneOf = (feature: string): SkillLaneView[] =>
    buildSkillLanes({
      viewById,
      owned,
      hiddenText: text.skills.hidden,
      revealAll,
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
