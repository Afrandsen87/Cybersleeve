/**
 * @module ui
 *
 * The buttons on an action card that are not purchases: Augment, Overclock and Focus.
 *
 * @remarks
 * Called by: `actionView.ts`, `squareView.ts`. Calls: `GameQueries`, the text table.
 */
import { type ActionQueries, type StateQueries, itemCount } from '../../core';
import { formatBigNum, formatPlain, numberFactory } from '../../numbers';
import type { UiText } from '../uiText';
import { AUGMENT_BONUS_DECIMALS, AUGMENT_XP_DECIMALS, MODE_DECIMALS } from './viewFormat';
import type { AugmentButtonView, ModeButtonView, ViewSelection } from './viewTypes';

/**
 * The Augment button of one action.
 *
 * Called by: {@link buildViewModel}. Calls: `itemCount`, `GameQueries.xpPerRun`, the text table.
 *
 * @param engine the engine to read from
 * @param actionId the action
 * @param text the display text
 * @param selection what the player has selected in the Inventory (the button is enabled only while a held rarity is selected)
 * @returns the button, or `null` when the content has no schematic to apply
 */
export function augmentView(
  engine: ActionQueries & StateQueries,
  actionId: string,
  text: UiText,
  selection: ViewSelection,
): AugmentButtonView | null {
  const config = engine.getConfig();
  const augment = config.items.augment;
  if (!augment) return null;
  const state = engine.getState();
  const chosen = config.items.rarities.find((r) => r.id === selection.augmentRarityId);
  const held = chosen ? itemCount(state, augment.itemId, chosen.id) : 0;
  const appliedByRarity = state.sleeve.actions[actionId]?.augments ?? {};
  const applied = config.items.rarities.flatMap((r) =>
    (appliedByRarity[r.id] ?? 0) > 0 ? [{ rarity: r.name, count: String(appliedByRarity[r.id]) }] : [],
  );
  const total = config.items.rarities.reduce((sum, r) => sum + (appliedByRarity[r.id] ?? 0), 0);
  const item = config.items.definitions.find((d) => d.id === augment.itemId)?.name ?? augment.itemId;
  const definition = config.actions.find((a) => a.id === actionId);
  const baseXp = definition ? definition.xpPerRun.mul(numberFactory.fromNumber(config.global.xpMultiplier)) : engine.xpPerRun(actionId);
  return {
    label: text.action.augment,
    enabled: held > 0,
    applied: total,
    get tip() {
      return text.tips.augment({
        xpPerRun: formatBigNum(engine.xpPerRun(actionId), AUGMENT_XP_DECIMALS),
        baseXp: formatBigNum(baseXp, AUGMENT_XP_DECIMALS),
        bonus: formatPlain(augment.xpBonusPerItem, AUGMENT_BONUS_DECIMALS),
        bonusPercent: formatPlain(augment.xpBonusPerItem * 100),
        applied,
        held: String(held),
        selected: chosen?.name ?? null,
        item,
      });
    },
  };
}

/**
 * The Overclock toggle of one action.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.overclockStatus`, the text table.
 *
 * @param engine the engine to read from
 * @param actionId the action
 * @param text the display text
 * @returns the toggle, or `null` while there is none to show (Overclock not owned, or no effect for this action)
 */
export function overclockView(engine: ActionQueries & StateQueries, actionId: string, text: UiText): ModeButtonView | null {
  const status = engine.overclockStatus(actionId);
  if (!status) return null;
  return {
    ...text.action.modes.overclock,
    on: status.on,
    clickable: true,
    get tip() {
      const bonus = (scaled: number): { basePercent: string; percent: string } | null =>
        scaled > 0 ? { basePercent: formatPlain((scaled / status.strength) * 100), percent: formatPlain(scaled * 100) } : null;
      const nodesLost = status.completionEffects.reduce((sum, e) => (e.kind === 'removeNodes' ? sum + e.amount : sum), 0);
      return text.tips.overclock({
        on: status.on,
        strength: formatPlain(status.strength, MODE_DECIMALS),
        speed: bonus(status.speedBonus),
        reward: bonus(status.rewardBonus),
        heatPerMinute: status.heatPerMinute > 0 ? formatPlain(status.heatPerMinute, MODE_DECIMALS) : null,
        heatPerRunFactor: status.heatPerRunFactor > 1 ? formatPlain(status.heatPerRunFactor, MODE_DECIMALS) : null,
        heatChanceFactor: status.heatChanceFactor > 1 ? formatPlain(status.heatChanceFactor, MODE_DECIMALS) : null,
        nodesLost: nodesLost > 0 ? formatPlain(nodesLost) : null,
        holdsHeat: status.blocksHeatCooling,
        chain: status.chain
          ? {
              links: formatPlain(status.chain.links),
              maxLinks: formatPlain(status.chain.maxLinks),
              rewardPercent: formatPlain(status.chain.rewardPerLink * 100, MODE_DECIMALS),
              nodesPercent: formatPlain(status.chain.nodesPerLink * 100, MODE_DECIMALS),
            }
          : null,
        alsoPays:
          status.alsoPays === null ? null : (engine.getConfig().actions.find((a) => a.id === status.alsoPays)?.name ?? status.alsoPays),
      });
    },
  };
}

/**
 * The Focus toggle of one action.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.focusStatus`, the text table.
 *
 * @param engine the engine to read from
 * @param actionId the action
 * @param text the display text
 * @returns the toggle, or `null` while no Focus slot is owned
 */
export function focusView(engine: ActionQueries & StateQueries, actionId: string, text: UiText): ModeButtonView | null {
  const status = engine.focusStatus(actionId);
  if (!status) return null;
  const tip = (): string =>
    text.tips.focus({
      on: status.on,
      bonusPercent: formatPlain(status.speedBonus * 100),
      used: String(status.used),
      slots: String(status.slots),
      full: !status.canSwitchOn,
      stacking: status.stacking,
      count: String(status.count),
    });
  return {
    ...text.action.modes.focus,
    on: status.on,
    clickable: status.canSwitchOn,
    ...(status.stacking
      ? {
          split: {
            count: status.count,
            canAdd: status.canAdd,
            canRemove: status.canRemove,
            get addTip() {
              return tip();
            },
            get removeTip() {
              return tip();
            },
          },
        }
      : {}),
    get tip() {
      return tip();
    },
  };
}
