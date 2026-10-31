/**
 * @module ui
 *
 * The Automation tab's view: the feature lanes, the owner-sourced Auto Burn panel, and autosale/dispersal controls.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries.automation`, `buildSkillLanes`, `autoBurnView`.
 */
import { AUTOMATION_FEATURES, type ActionQueries, type GameConfig, type ItemQueries, type SkillQueries } from '../../core';
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
 * skill tree: every node is shown from the start, while text follows its manual-concept reveal gates.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param viewById the view of every buyable, by id
 * @param text the display text
 * @param revealAll test aid: no skill text is masked
 * @param tracker the reveal ledger reader
 */
export function automationView(
  engine: SkillQueries & Pick<ActionQueries, 'overclockStatus' | 'isUnlocked'> & Pick<ItemQueries, 'backChannel' | 'hasSeenItem'>,
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
  const targets = automation.dispersalTargets();
  const slots = automation.dispersalSlots();
  const dispersalOpen = automation.isUnlocked('dispersal');
  const augment = config.items.augment;
  const dispersedRarities = config.items.rarities
    .filter((r) => augment && automation.allowedRarities('dispersal').includes(r.id) && engine.hasSeenItem(augment.itemId, r.id))
    .map((r) => r.name);
  const channel = engine.backChannel();
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
    rarities: config.items.rarities.map((r) => ({
      id: r.id,
      name: r.name,
      on: automation.isAutosaleOn(r.id),
      visible: automation.allowedRarities('autosale').includes(r.id),
    })),
    backchannelRarities: config.items.rarities.map((r) => ({
      id: r.id,
      name: text.automation.autoBackchannel(r.name),
      on: automation.isAutoBackchannelOn(r.id),
      visible: automation.allowedRarities('autoBackchannel').includes(r.id) && channel?.molesByRarity[r.id] !== undefined,
    })),
    actions: config.actions.map((a) => ({
      id: a.id,
      name: a.name,
      selected: targets.includes(a.id),
      visible: dispersalOpen && (engine.isUnlocked(a.id) || targets.includes(a.id)), // a kept target the sleeve cannot reach now (after a re-sleeve) stays listed so it can be unticked
      disabled: !targets.includes(a.id) && targets.length >= slots,
    })),
    dispersalCount: text.automation.dispersalCount(targets.length, slots),
    dispersalRarities: dispersedRarities.length > 0 ? text.automation.dispersalRarities(dispersedRarities) : '',
  };
}
