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
  type AutoBurnSwitch,
  type ActionQueries,
  type TAB_IDS,
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
import type { RevealTracker } from './revealTracker';
import { GENERAL_LANE, buildSkillLanes } from './skillTree';
import { resleeveSkillsShown } from './sleeveGate';
import { TabAttention } from './tabAttention';
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
 * The tabs at the top. None shows until something is worth a tab: a skill point, an automation point or a finished sleeve-run. A tab the reveal
 * ledger holds stays shown. The Skills and Automation tabs blink while they have earned points the player has not looked at (`TabAttention`).
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.skillPoints`, `resleevePoints`, `automation`, `RevealTracker.reveals`, `TabAttention.blinks`.
 *
 * @param engine the engine to read from
 * @param state the game state
 * @param text the display text
 * @param tracker the reveal ledger reader (default: tabs show by their own rule only)
 * @param attention which points the player has seen (default: a fresh memory, so a tab blinks while it has unspent points)
 * @param activeTab the tab the player is looking at; looking at a tab counts its points as seen
 */
export function tabsView(
  engine: SkillQueries & CorporationQueries,
  state: GameStateView,
  text: UiText,
  tracker?: RevealTracker,
  attention: TabAttention = new TabAttention(),
  activeTab?: string,
): TabView[] {
  const automation = engine.automation();
  const statsShown = state.wallet.runs.length > 0; // the first re-sleeve writes the first run down
  const shown = (id: (typeof TAB_IDS)[number], natural: boolean): boolean => (tracker ? tracker.reveals('tab', id, natural) : natural);
  const skillsNatural = engine.skillPointsEarned() > 0 || statsShown; // a finished sleeve-run has earned a re-sleeve point
  const automationNatural = automation.pointsEarned() > 0;
  const corporationNatural = engine.isCorporationUnlocked();
  const skillsShown = shown('skills', skillsNatural);
  const automationShown = shown('automation', automationNatural);
  const statsTab = shown('stats', statsShown);
  const corporationShown = shown('corporation', corporationNatural);
  const tabsShown = shown('character', skillsNatural || automationNatural || statsShown || corporationNatural);
  const skillPoints = engine.skillPoints() + engine.resleevePoints();
  const skillBlink = attention.blinks(
    'skills',
    engine.skillPointsEarned() + engine.resleevePointsEarned(),
    skillPoints,
    activeTab === 'skills',
  );
  const automationBlink = attention.blinks(
    'automation',
    automation.pointsEarned(),
    automation.pointsAvailable(),
    activeTab === 'automation',
  );
  return [
    { id: 'character', label: text.tabs.character, visible: tabsShown, attention: false },
    { id: 'skills', label: text.tabs.skills(skillPoints), visible: skillsShown, attention: skillBlink },
    { id: 'automation', label: text.tabs.automation(automation.pointsAvailable()), visible: automationShown, attention: automationBlink },
    { id: 'stats', label: text.tabs.stats, visible: statsTab, attention: false },
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
 * @param tracker the reveal ledger reader (a skill it holds stays readable)
 */
export function skillsView(
  engine: SkillQueries,
  state: GameStateView,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  stats: SleeveStats,
  text: UiText,
  revealAll = false,
  tracker?: RevealTracker,
): SkillsView {
  const owned = (id: string): number => viewById.get(id)?.owned ?? 0;
  const common = { viewById, owned, hiddenText: text.skills.hidden, revealAll, ...(tracker ? { tracker } : {}) };
  const branchTitle = (id: string): string => (id === GENERAL_LANE ? text.skills.generalBranch : (text.skills.branches[id] ?? id));
  const lanes = buildSkillLanes({
    ...common,
    skills: config.buyables.filter((b) => b.currency === 'skillPoints'),
    branchMasked: branchMaskedFn(config, state, stats, tracker),
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
 * @param tracker the reveal ledger reader
 */
export function automationView(
  engine: SkillQueries & Pick<ActionQueries, 'overclockStatus'>,
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
    autoBurn: {
      hint: text.automation.autoBurn.hint,
      switches: AUTO_BURN_SWITCHES.map((name) => ({
        name,
        label: autoBurnSwitchLabel(name, burn.rules(), text),
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

/**
 * The label of an Auto Burn switch. The Hold and Switch-on switches show the heat threshold in force (from the rules, so the
 * player's own thresholds once the skill makes them editable); the others have fixed text.
 *
 * Called by: {@link automationView}.
 * Calls: `formatPlain`, the `autoBurn` text.
 *
 * @param name the switch
 * @param rules the Auto Burn rules in force
 * @param text the display text
 * @returns the label to show
 */
function autoBurnSwitchLabel(name: AutoBurnSwitch, rules: { lower: number; upperAt: number }, text: UiText): string {
  const t = text.automation.autoBurn;
  if (name === 'hold') return t.holdAt(formatPlain(rules.lower));
  if (name === 'upper') return t.upperAt(formatPlain(rules.upperAt));
  return t.switches[name];
}
