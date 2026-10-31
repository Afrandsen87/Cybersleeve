/**
 * @module ui
 *
 * The Automation tab's view: the feature lanes, the owner-sourced Auto Burn panel, and autosale/dispersal controls.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries.automation`, `buildSkillLanes`, `autoBurnView`.
 */
import {
  AUTOMATION_FEATURES,
  type ActionQueries,
  type GameConfig,
  type ItemQueries,
  type SkillQueries,
  type StateQueries,
} from '../../core';
import { formatPlain } from '../../numbers';
import type { UiText } from '../uiText';
import { kompromatView } from './kompromatView';
import { buildDispersalView } from './dispersalView';
import { daemonOfflineNote } from './daemonView';
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
 * skill tree: every node is shown from the start, while text follows its manual-concept reveal gates.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param viewById the view of every buyable, by id
 * @param text the display text
 * @param revealAll test aid: no skill text is masked
 * @param firmwareLanes existing Firmware tree masking for dependency guidance
 * @param tracker the reveal ledger reader
 */
export function automationView(
  engine: SkillQueries &
    Pick<ActionQueries, 'overclockStatus' | 'isUnlocked'> &
    Pick<ItemQueries, 'backChannel' | 'hasSeenItem'> &
    Pick<StateQueries, 'getState'>,
  config: GameConfig,
  viewById: ReadonlyMap<string, BuyableView>,
  text: UiText,
  revealAll = false,
  tracker?: RevealTracker,
  firmwareLanes: readonly SkillLaneView[] = [],
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
      laneTitle: () => text.automation.firmwareTitle,
      open: true,
      conceptKnown: (skill) => {
        const effect = skill.effect;
        const rarity =
          effect.kind === 'allowsDispersal'
            ? effect.rarity
            : effect.kind === 'unlocksAutomation' && effect.feature === 'dispersal'
              ? effect.allowsDispersal
              : undefined;
        return rarity === undefined || !config.items.augment || engine.hasSeenItem(config.items.augment.itemId, rarity);
      },
    });
  const dispersal = buildDispersalView(engine, config, text.automation.dispersal);
  const kompromat = kompromatView(engine, config, viewById, text, firmwareLanes);
  return {
    title: text.titles.automation,
    points: automation.pointsAvailable(),
    pointsText: text.automation.points(formatPlain(automation.pointsAvailable())),
    pointsValueText: formatPlain(automation.pointsAvailable()),
    features: AUTOMATION_FEATURES.map((id) => {
      const lanes = laneOf(id);
      return {
        id,
        name: text.automation.features[id].name,
        description: text.automation.features[id].description,
        unlocked: automation.isUnlocked(id),
        lanes,
        offlineNote: daemonOfflineNote(lanes, text),
      };
    }),
    autoBurn: autoBurnView(burn, engine, config, viewById, text),
    kompromat,
    dispersal,
    rarities: kompromat.rows.find((row) => row.id === 'autosale')?.chips ?? [],
    backchannelRarities: kompromat.rows.find((row) => row.id === 'backchannel')?.chips ?? [],
    actions: dispersal.actions,
    dispersalCount: text.automation.dispersalCount(dispersal.used, dispersal.slots),
    dispersalRarities: dispersal.permits.length ? text.automation.dispersalRarities(dispersal.permits.map((rarity) => rarity.name)) : '',
  };
}
