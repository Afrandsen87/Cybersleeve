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
import { automationAdds, type AutomationAddition } from './automationAdds';
import type { RevealTracker } from './revealTracker';
import { buildSkillLanes } from './skillTree';
import type { AutomationView, BuyableView, SkillLaneView } from './viewTypes';

/** Config/text-scoped static guidance. Called by: automationView. Calls: automationAdds. */
const additionCache = new WeakMap<GameConfig, WeakMap<UiText, ReadonlyMap<string, AutomationAddition>>>();
/** Builds static guidance once per config and text provider. Called by: automationView. Calls: automationAdds. */
function staticAdditions(config: GameConfig, text: UiText): ReadonlyMap<string, AutomationAddition> {
  let byText = additionCache.get(config);
  if (!byText) {
    byText = new WeakMap();
    additionCache.set(config, byText);
  }
  const cached = byText.get(text);
  if (cached) return cached;
  const additions = new Map<string, AutomationAddition>();
  const rarities = new Map(config.items.rarities.map((rarity) => [rarity.id, rarity.name]));
  const skills = config.buyables.filter((skill) => skill.currency === 'automationPoints');
  for (const skill of skills) {
    const addition = automationAdds(skill, skills, (id) => rarities.get(id) ?? id, text.firmware);
    if (addition) additions.set(skill.id, addition);
  }
  byText.set(text, additions);
  return additions;
}

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
  const staticGuidance = staticAdditions(config, text);
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
      const additions = new Map<string, AutomationAddition>();
      for (const node of lanes.flatMap((lane) => lane.nodes)) {
        const addition = staticGuidance.get(node.view.id);
        if (!node.masked && addition) additions.set(node.view.id, addition);
      }
      return {
        id,
        name: text.automation.features[id].name,
        description: text.automation.features[id].description,
        unlocked: automation.isUnlocked(id),
        lanes,
        additions,
        offlineNote: daemonOfflineNote(lanes, text),
      };
    }),
    autoBurn: autoBurnView(burn, engine, config, viewById, text),
    kompromat,
    dispersal,
  };
}
