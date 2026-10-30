/**
 * @module ui
 *
 * The Inventory widget: one tile per item and rarity, with the tooltip that fits the item.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, `itemCount`, the text table.
 */
import { type ItemQueries, type ShopQueries, type StateQueries, itemCount } from '../../core';
import { formatBigNum, formatPlain, type NumberFactory } from '../../numbers';
import type { DropChanceParts, UiText } from '../uiText';
import { DROP_CHANCE_DECIMALS, HEAT_DECIMALS, initials } from './viewFormat';
import type { InventoryRowView, InventoryView } from './viewTypes';

/**
 * Where one stack of items drops from, for its tooltip: the name of each action that can drop it and the chance, in percent, that
 * one completed run of it does.
 *
 * Called by: {@link inventoryView}. Calls: `GameQueries.dropSources`.
 *
 * @param engine the engine to read from
 * @param itemId the item
 * @param rarityId the rarity of the stack
 */
function dropChances(engine: ItemQueries & ShopQueries & StateQueries, itemId: string, rarityId: string): readonly DropChanceParts[] {
  const actions = engine.getConfig().actions;
  return engine.dropSources(itemId, rarityId).map((source) => ({
    action: actions.find((a) => a.id === source.actionId)?.name ?? source.actionId,
    percent: formatPlain(source.chance * 100, DROP_CHANCE_DECIMALS),
  }));
}

/**
 * The Inventory widget: one row per item and rarity.
 *
 * Called by: {@link buildViewModel}. Calls: `itemCount`, the text table.
 *
 * @param engine the engine to read from
 * @param factory number factory (for stack values)
 * @param text the display text
 */
export function inventoryView(engine: ItemQueries & ShopQueries & StateQueries, factory: NumberFactory, text: UiText): InventoryView {
  const state = engine.getState();
  const { items } = engine.getConfig();
  const channel = engine.backChannel();
  const burnLead = items.burnLead;
  const zeroDay = items.zeroDay;
  const adminKey = items.adminKey;
  const skillShard = items.skillShard;
  const augment = items.augment;
  const nameOf = (id: string): string => items.definitions.find((d) => d.id === id)?.name ?? id;
  const actionNameOf = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : engine.getConfig().actions.find((a) => a.id === id)?.name;
  const zeroDayAction = actionNameOf(zeroDay?.actionId);
  const adminKeyAction = actionNameOf(adminKey?.actionId);
  const rows = items.definitions.flatMap((item) =>
    // An item without rarity is one stack (kept under the most common rarity) and is named by the item alone.
    (item.hasRarity === false ? items.rarities.slice(0, 1) : items.rarities).map((rarity): InventoryRowView => {
      const count = itemCount(state, item.id, rarity.id);
      const price = engine.sellValue(rarity.id); // the one owner of the sale price
      const label = item.hasRarity === false ? item.name : text.inventory.label(rarity.name, item.name);
      const channelMoles = channel?.itemId === item.id ? channel.molesByRarity[rarity.id] : undefined;
      const backChannel = channelMoles !== undefined;
      const isZeroDay = zeroDay?.itemId === item.id;
      const isAdminKey = adminKey?.itemId === item.id;
      const isShard = skillShard?.itemId === item.id;
      const usable = burnLead?.itemId === item.id || isShard;
      const toggleable = isZeroDay || isAdminKey;
      return {
        itemId: item.id,
        rarityId: rarity.id,
        label,
        symbol: initials(item.name),
        rarityIndex: item.hasRarity === false ? null : items.rarities.indexOf(rarity),
        count,
        unlocked: engine.hasSeenItem(item.id, rarity.id), // seen once (loading a save marks what it holds)
        countText: formatBigNum(factory.fromNumber(count)),
        augmentable: augment?.itemId === item.id,
        sellable: item.sellable !== false,
        usable,
        canUse:
          (usable && !isShard && engine.canUseBurnLead(rarity.id)) ||
          (isShard && engine.canUseSkillShard()) ||
          (isZeroDay && engine.canToggleZeroDays()) ||
          (isAdminKey && engine.canToggleAdminKeys()),
        toggleable,
        on: (isZeroDay && state.sleeve.keyToggles['zeroDay'] === true) || (isAdminKey && state.sleeve.keyToggles['adminKey'] === true),
        backChannel,
        get backChannelTip() {
          return backChannel && channel && channelMoles !== undefined
            ? text.tips.backChannel({
                label,
                molesPerItem: formatPlain(channelMoles),
                boostPercent: formatPlain(channel.cooldownBoost * 100),
              })
            : '';
        },
        get tip() {
          const drops = dropChances(engine, item.id, rarity.id);
          if (isShard && skillShard && adminKey) {
            return text.tips.skillShard({
              label,
              levels: formatPlain(skillShard.levelsDelayed),
              count: formatBigNum(factory.fromNumber(count)),
              canUse: engine.canUseSkillShard(),
              drops:
                adminKey.shard && adminKeyAction && engine.dropSources(adminKey.itemId, rarity.id).length > 0
                  ? [
                      {
                        action: `${nameOf(adminKey.itemId)}-assisted ${adminKeyAction}`,
                        percent: formatPlain(adminKey.shard.chance * 100, DROP_CHANCE_DECIMALS),
                      },
                    ]
                  : [],
            });
          }
          if (usable && burnLead) {
            return text.tips.burnLead({
              label,
              drops,
              sharePercent: formatPlain(burnLead.heatFraction * 100),
              heat: formatPlain(state.sleeve.heat, HEAT_DECIMALS),
              heatAfter: formatPlain(state.sleeve.heat * (1 - burnLead.heatFraction), HEAT_DECIMALS),
              count: formatBigNum(factory.fromNumber(count)),
              canUse: state.sleeve.heat > 0,
            });
          }
          if (isAdminKey && adminKey && adminKeyAction) {
            return text.tips.adminKey({
              label,
              drops,
              actionName: adminKeyAction,
              count: formatBigNum(factory.fromNumber(count)),
              on: state.sleeve.keyToggles['adminKey'] === true,
              canToggle: engine.canToggleAdminKeys(),
              bonusName: adminKey.shard ? nameOf(adminKey.shard.itemId) : null,
              bonusPercent: formatPlain((adminKey.shard?.chance ?? 0) * 100),
            });
          }
          if (isZeroDay && zeroDayAction) {
            return text.tips.zeroDay({
              label,
              drops,
              actionName: zeroDayAction,
              count: formatBigNum(factory.fromNumber(count)),
              on: state.sleeve.keyToggles['zeroDay'] === true,
              canToggle: engine.canToggleZeroDays(),
            });
          }
          return item.sellable === false
            ? text.tips.stackKept({ label, count: formatBigNum(factory.fromNumber(count)), drops })
            : text.tips.stack({
                label,
                drops,
                sellValue: formatBigNum(price),
                count: formatBigNum(factory.fromNumber(count)),
                total: formatBigNum(price.mul(factory.fromNumber(count))),
                unit: text.costUnits.credits,
              });
        },
      };
    }),
  );
  return {
    title: text.titles.inventory,
    visible: rows.some((r) => r.unlocked), // nothing shows until an item has been seen or is held
    rows,
  };
}
