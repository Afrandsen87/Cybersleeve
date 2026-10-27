/**
 * @module ui
 *
 * The square on an action card: Auto-run, Overclock, Focus and Augment in one grid.
 *
 * @remarks
 * Called by: `actionView.ts`. Calls: the text table.
 */
import type { BuyableDefinition, GameConfig } from '../../core';
import type { SquareCellId, UiText } from '../uiText';
import type { ActionSquareView, AugmentButtonView, BuyableView, ModeButtonView, SquareCellView } from './viewTypes';

/** A placeholder cell for a feature the action does not have. */
function emptyCell(id: SquareCellId, text: UiText): SquareCellView {
  return { id, ...text.action.modes[id], mode: 'empty', on: false, clickable: false, ready: false, buyableId: null, tip: '' };
}

/**
 * A cell that is bought first and switched afterwards: the unlock buyable decides which, and `toggle` (when the feature has a
 * richer toggle than on/off, like Overclock) supplies the state and the tip of an owned feature.
 *
 * Called by: {@link squareView}. Calls: the text table.
 *
 * @param id which cell
 * @param buyable the view of the unlock buyable of this action; `undefined` when the action has none (an empty cell)
 * @param toggle the toggle view of an owned feature, or `null` to use the buyable's own on/off state
 * @param text the display text
 */
function unlockCell(id: SquareCellId, buyable: BuyableView | undefined, toggle: ModeButtonView | null, text: UiText): SquareCellView {
  if (!buyable) return emptyCell(id, text);
  const meta = text.action.modes[id];
  if (buyable.owned <= 0) {
    return {
      id,
      ...meta,
      mode: 'buy',
      on: false,
      clickable: buyable.clickable,
      ready: buyable.clickable,
      buyableId: buyable.id,
      get tip() {
        return buyable.tip;
      },
    };
  }
  const source = toggle ?? buyable;
  return {
    id,
    ...meta,
    mode: 'toggle',
    on: toggle ? toggle.on : buyable.enabled,
    clickable: toggle ? toggle.clickable : true,
    ready: false,
    buyableId: buyable.id,
    ...(toggle?.split ? { split: toggle.split } : {}),
    get tip() {
      return source.tip;
    },
  };
}

/**
 * The square of one action card.
 *
 * Called by: {@link buildViewModel}. Calls: {@link unlockCell}, {@link emptyCell}.
 *
 * @param config game configuration (finds the unlock buyables of the action)
 * @param actionId the action
 * @param views the view of every buyable, by id
 * @param overclock the Overclock toggle view of the action (`null` while it is not unlocked)
 * @param focus the Focus toggle view of the action (`null` while it is not unlocked)
 * @param augment the Augment button view of the action (`null` when the game has no schematic)
 * @param text the display text
 */
export function squareView(
  config: GameConfig,
  actionId: string,
  views: ReadonlyMap<string, BuyableView>,
  overclock: ModeButtonView | null,
  focus: ModeButtonView | null,
  augment: AugmentButtonView | null,
  text: UiText,
): ActionSquareView {
  const find = (kind: BuyableDefinition['effect']['kind']): BuyableView | undefined => {
    const b = config.buyables.find((x) => x.actionId === actionId && x.effect.kind === kind);
    return b ? views.get(b.id) : undefined;
  };
  const auto = unlockCell('autoRun', find('autoRun'), null, text);
  const augmentCell: SquareCellView = augment
    ? {
        id: 'augment',
        ...text.action.modes.augment,
        mode: 'press',
        on: augment.applied > 0,
        clickable: augment.enabled,
        ready: false,
        buyableId: null,
        get tip() {
          return augment.tip;
        },
      }
    : emptyCell('augment', text);
  return {
    locked: auto.mode === 'buy',
    cells: [
      auto,
      unlockCell('overclock', find('overclockUnlock'), overclock, text),
      unlockCell('focus', find('focusUnlock'), focus, text),
      augmentCell,
    ],
  };
}
