/**
 * @module ui
 *
 * The smaller panels: the tabs, the Skills tab, the Automation tab and the Stats tab.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, the text table.
 */
import {
  AUTOMATION_FEATURES,
  AUTO_BURN_SWITCHES,
  type ActionQueries,
  type CorporationQueries,
  type GameConfig,
  type SkillQueries,
  type SleeveStats,
  type GameStateView,
} from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { resumeChecklists } from './autoBurnChecklist';
import { branchMaskedFn } from './branchMask';
import { GENERAL_LANE, buildSkillLanes } from './skillTree';
import { resleeveSkillsShown } from './sleeveGate';
import type { AutomationView, BuyableView, RunRowView, RunsView, SkillLaneView, SkillsView, TabView } from './viewTypes';

/** The latest finished sleeve-runs, newest first. */
export function runsView(runs: GameStateView['wallet']['runs'], config: GameConfig, text: UiText): RunsView {
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
          actionLevelTexts: config.actions.flatMap((a) =>
            run.actionLevels?.[a.id] === undefined ? [] : [text.runs.actionLevel(a.name, formatPlain(run.actionLevels[a.id] ?? 0))],
          ),
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
export function tabsView(engine: SkillQueries & CorporationQueries, state: GameStateView, text: UiText): TabView[] {
  const automation = engine.automation();
  const statsShown = state.wallet.runs.length > 0; // the first re-sleeve writes the first run down
  const skillsShown = engine.skillPointsEarned() > 0 || statsShown; // a finished sleeve-run has earned a re-sleeve point
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
 * @param stats the sleeve stats (for the branches whose text waits for a stat to be revealed)
 * @param text the display text
 * @param revealAll test aid: no skill is masked
 */
export function skillsView(
  engine: SkillQueries,
  state: GameStateView,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  stats: SleeveStats,
  text: UiText,
  revealAll = false,
): SkillsView {
  const owned = (id: string): number => viewById.get(id)?.owned ?? 0;
  const common = { viewById, owned, hiddenText: text.skills.hidden, revealAll };
  const branchTitle = (id: string): string => (id === GENERAL_LANE ? text.skills.generalBranch : (text.skills.branches[id] ?? id));
  const lanes = buildSkillLanes({
    ...common,
    skills: config.buyables.filter((b) => b.currency === 'skillPoints'),
    branchMasked: branchMaskedFn(config, state, stats),
    laneTitle: branchTitle,
    open: true,
  });
  // until the first re-sleeve the player has not seen what the skills do: only their places in the tree show
  const resleeveLanes = buildSkillLanes({
    ...common,
    skills: config.buyables.filter((b) => b.currency === 'resleevePoints'),
    laneTitle: branchTitle,
    open: state.wallet.runs.length > 0,
  });
  const resleeveVisible = resleeveSkillsShown(state);
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
  engine: SkillQueries & Pick<ActionQueries, 'overclockStatus'>,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  revealAll = false,
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
      hint: text.automation.autoBurn.hint,
      switches: AUTO_BURN_SWITCHES.map((name) => ({
        name,
        label: text.automation.autoBurn.switches[name],
        on: burn.rules()[name],
        visible: burn.stepOwned(name),
      })),
      thresholds: {
        visible: burn.stepOwned('thresholds'),
        lower: burn.rules().lower,
        upper: burn.rules().upperAt,
        lowerLabel: text.automation.autoBurn.lower,
        upperLabel: text.automation.autoBurn.upper,
      },
      reserve: { visible: burn.stepOwned('reserve'), value: burn.rules().reserve, label: text.automation.autoBurn.reserve },
      ...resumeChecklists(burn, engine, config, viewById),
    },
    rarities: config.items.rarities.map((r) => ({ id: r.id, name: r.name, on: automation.isAutosaleOn(r.id) })),
    actions: config.actions.map((a) => ({ id: a.id, name: a.name, percent: automation.dispersal(a.id) })),
    shareLabel: text.automation.dispersalShare,
  };
}
