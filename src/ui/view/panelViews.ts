/**
 * @module ui
 *
 * The smaller panels: the tabs, the Skills tab, the Automation tab and the Stats tab.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, the text table.
 */
import type { TAB_IDS, CorporationQueries, GameConfig, SkillQueries, SleeveStats, GameStateView } from '../../core';
import { formatBigNum, formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { branchMaskedFn } from './branchMask';
import type { RevealTracker } from './revealTracker';
import { GENERAL_LANE, buildSkillLanes } from './skillTree';
import { resleeveSkillsShown } from './sleeveGate';
import { TabAttention } from './tabAttention';
import type { BuyableView, RunRowView, RunsView, SkillLaneView, SkillsView, TabView } from './viewTypes';

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
 * The Skills tab, with the group of sleeve skills.
 *
 * Both trees show every node and every branch title from the start; what a skill says stays hidden until it is readable (see
 * `skillTree.ts`). The sleeve skills are all hidden until the first re-sleeve.
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
    parentsMustBeOwned: true,
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
