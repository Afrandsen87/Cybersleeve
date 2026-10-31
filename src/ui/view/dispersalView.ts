/**
 * @module ui
 * Automation-context dispersal projection; rules and capacity stay with the automation owner.
 * Called by: automationView. Calls: Automation queries, ItemQueries.hasSeenItem, ActionQueries.isUnlocked.
 */
import { dispersalSlots, type ActionQueries, type GameConfig, type ItemQueries, type SkillQueries } from '../../core';
import type { DispersalText, DispersalView } from './dispersalViewTypes';

/** Static owner-sourced maximum capacity. Called by: buildDispersalView. Calls: dispersalSlots. */
const maximumSlots = new WeakMap<GameConfig, number>();

/** Projects configured actions and known permissions without mutating game state.
 * Called by: automationView. Calls: automation queries, hasSeenItem, isUnlocked.
 * @param engine narrow automation, action access and inventory queries
 * @param config content used for labels and meter capacity
 * @param text protocol wording
 * @returns immutable panel display data
 */
export function buildDispersalView(
  engine: Pick<SkillQueries, 'automation'> & Pick<ActionQueries, 'isUnlocked'> & Pick<ItemQueries, 'hasSeenItem'>,
  config: GameConfig,
  text: DispersalText,
): DispersalView {
  let maxSlots = maximumSlots.get(config);
  if (maxSlots === undefined) {
    maxSlots = dispersalSlots(config.buyables, Object.fromEntries(config.buyables.map((node) => [node.id, 1])));
    maximumSlots.set(config, maxSlots);
  }
  const automation = engine.automation();
  const targets = automation.dispersalTargets();
  const slots = automation.dispersalSlots();
  const open = automation.isUnlocked('dispersal');
  const augment = config.items.augment;
  const permitted = automation.allowedRarities('dispersal');
  const permits = config.items.rarities.flatMap((rarity, rarityIndex) =>
    augment && permitted.includes(rarity.id) && engine.hasSeenItem(augment.itemId, rarity.id)
      ? [{ id: rarity.id, name: rarity.name, rarityIndex }]
      : [],
  );
  const active = targets.length > 0;
  return {
    active,
    word: active ? text.dispersing : text.standby,
    summary: active ? text.status(permits.length, targets.length) : text.pickAction,
    used: targets.length,
    slots,
    maxSlots,
    count: text.slotCount(targets.length, slots),
    fullSlotsNote: slots > 0 && targets.length >= slots ? text.fullSlots(slots) : '',
    permits,
    rarityOptions: config.items.rarities,
    actions: config.actions.map((action) => ({
      id: action.id,
      name: action.name,
      selected: targets.includes(action.id),
      // Kept targets remain removable when the current sleeve cannot reach their action.
      visible: open && (engine.isUnlocked(action.id) || targets.includes(action.id)),
      disabled: !targets.includes(action.id) && targets.length >= slots,
    })),
  };
}
