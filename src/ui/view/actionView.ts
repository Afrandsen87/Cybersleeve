/**
 * @module ui
 *
 * The action cards: bars, texts, reward line, and the buttons that belong to the card.
 *
 * @remarks
 * Called by: `ui/viewModel.ts`. Calls: `GameQueries`, `modeViews.ts`, `squareView.ts`, the text table.
 */
import {
  type ActionDefinition,
  type GameConfig,
  type ActionQueries,
  type LevelQueries,
  type StateQueries,
  type GameStateView,
  SPEED_FACTOR_IDS,
} from '../../core';
import { type BigNum, formatBigNum, formatPlain, type NumberFactory } from '../../numbers';
import type { UiText } from '../uiText';
import { SPEED_DECIMALS, formatSeconds } from './viewFormat';
import { augmentView, focusView, overclockView } from './modeViews';
import { squareView } from './squareView';
import type { ActionView, BuyableView } from './viewTypes';

/** What starting an action costs, for the card (the share of the balance is shown with today's amount). */
function startCostText(def: ActionDefinition, current: BigNum | null, text: UiText): string | null {
  const cost = def.startCost;
  if (!cost) return null;
  const unit = text.costUnits[cost.currency];
  const parts: string[] = [];
  if (cost.amount && !cost.amount.isZero()) parts.push(text.startCost.amount(formatBigNum(cost.amount), unit));
  if (cost.fractionOfBalance !== undefined) {
    parts.push(text.startCost.share(formatPlain(cost.fractionOfBalance * 100), unit, current ? formatBigNum(current) : null));
  }
  return parts.length > 0 ? text.startCost.join(parts) : text.startCost.none(unit);
}

/**
 * Explains an action's speed: the factors it is the product of, with the levels behind them.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.speedFactors`, `actionLevel`, `sleeveLevel`, `levelBonus`.
 */
function speedTip(
  engine: ActionQueries & LevelQueries & StateQueries,
  config: GameConfig,
  def: ActionDefinition,
  durationText: string,
  speed: string,
  text: UiText,
): string {
  const factors = engine.speedFactors(def.id);
  const factorOf = (id: string): number => factors.find((f) => f.id === id)?.factor ?? 1;
  const global = factorOf(SPEED_FACTOR_IDS.globalSpeed);
  const overclock = factorOf(SPEED_FACTOR_IDS.overclock);
  const focus = factorOf(SPEED_FACTOR_IDS.focus);
  return text.tips.actionSpeed({
    speed,
    actionLevel: engine.actionLevel(def.id),
    levelBonus: engine.levelBonus(def.id),
    actionFactor: formatPlain(factorOf(SPEED_FACTOR_IDS.actionLevel), SPEED_DECIMALS),
    actionScaling: def.speedScaling ?? config.speed.actionLevel,
    sleeveLevel: engine.sleeveLevel(def.id),
    sleeveFactor: formatPlain(factorOf(SPEED_FACTOR_IDS.sleeveLevel), SPEED_DECIMALS),
    sleeveScaling: config.speed.sleeveLevel,
    interfaceFactor: formatPlain(factorOf(SPEED_FACTOR_IDS.interfaceSpeed), SPEED_DECIMALS),
    globalFactor: global === 1 ? null : formatPlain(global, SPEED_DECIMALS),
    overclockFactor: overclock === 1 ? null : formatPlain(overclock, SPEED_DECIMALS),
    focusFactor: focus === 1 ? null : formatPlain(focus, SPEED_DECIMALS),
    baseDuration: formatSeconds(def.baseDurationMs, text),
    duration: durationText,
  });
}

/** Why an action is locked, in a few words (`null` when it is not). */
function lockedReason(def: ActionDefinition, unlocked: boolean, text: UiText): string | null {
  return unlocked ? null : text.lock.access(def.requiredAccessLevel ?? 1);
}

/**
 * The card of every action, in configuration order.
 *
 * Called by: {@link buildViewModel}. Calls: {@link speedTip}, {@link startCostText}, {@link squareView}, the toggle views.
 *
 * @param engine the engine to read from
 * @param config game configuration
 * @param state the game state
 * @param buyableViews the view of every buyable
 * @param viewById the same views by id
 * @param factory number factory (for formatting plain numbers)
 * @param text the display text
 */
export function buildActionViews(
  engine: ActionQueries & LevelQueries & StateQueries,
  config: GameConfig,
  state: GameStateView,
  buyableViews: readonly BuyableView[],
  viewById: ReadonlyMap<string, BuyableView>,
  factory: NumberFactory,
  text: UiText,
): ActionView[] {
  return config.actions.map((def): ActionView => {
    const s = state.actions[def.id];
    if (!s) throw new Error(`Missing state for action ${def.id}`);
    const duration = engine.currentDurationMs(def.id);
    const unlocked = engine.isUnlocked(def.id);
    const reason = lockedReason(def, unlocked, text);
    const speedText = text.format.speed(formatBigNum(factory.fromNumber(engine.currentSpeed(def.id))));
    const durationText = formatSeconds(duration, text);
    const cost = startCostText(def, engine.startCostOf(def.id), text);
    const auto = engine.isAutoRun(def.id);
    const rewardText = formatBigNum(engine.payoutPerRun(def.id));
    const rewardUnit = text.rewardUnits[def.rewardKind ?? 'credits'];
    const rewardMultiplierText = formatBigNum(engine.rewardMultiplier(def.id));
    const heatPerRun = def.heatPerRun ?? 0;
    const heatPerSecond = def.heatPerSecond ?? 0;
    const xpText = formatBigNum(engine.actionXpIntoLevel(def.id));
    const nextLevelXpText = formatBigNum(engine.actionXpForLevel(def.id));
    const sleeveLevel = engine.sleeveLevel(def.id);
    const sleeveXpText = formatBigNum(engine.sleeveXpIntoLevel(def.id));
    const sleeveNextText = formatBigNum(engine.sleeveXpForLevel(def.id));
    const runsToNextXp = Math.max(1, engine.runsPerSleeveXp() - s.runsTowardSleeveXp);
    const level = engine.actionLevel(def.id);
    const augment = augmentView(engine, def.id, text);
    const overclock = overclockView(engine, def.id, text);
    const focus = focusView(engine, def.id, text);
    const crits = engine.recentCrits(def.id);
    return {
      id: def.id,
      critText: crits.count > 0 ? text.action.critFlash(crits.count, formatBigNum(factory.fromNumber(crits.perSecond))) : null,
      name: def.name,
      level,
      xpText,
      nextLevelXpText,
      levelProgressPercent: engine.actionLevelProgress(def.id) * 100,
      sleeve: {
        level: sleeveLevel,
        xpText: sleeveXpText,
        nextLevelXpText: sleeveNextText,
        progressPercent: engine.sleeveLevelProgress(def.id) * 100,
        runsToNextXp,
      },
      speedText,
      durationText,
      rewardText,
      rewardUnit,
      rewardMultiplierText,
      progressPercent: s.running ? Math.min(100, s.progress * 100) : 0,
      running: s.running,
      auto,
      unlocked,
      startable: engine.canStart(def.id),
      requiredAccessLevel: def.requiredAccessLevel ?? 1,
      lockedReason: reason,
      posterText: text.lock.poster(def.requiredAccessLevel ?? 1),
      startCostText: cost,
      heatPerRun,
      get speedTip() {
        return unlocked ? speedTip(engine, config, def, durationText, formatPlain(engine.currentSpeed(def.id), SPEED_DECIMALS), text) : '';
      },
      infoText: reason ? text.action.locked(reason) : text.action.info({ speed: speedText, duration: durationText, startCost: cost, auto }),
      levelBarText: text.action.levelBar(level, xpText, nextLevelXpText),
      sleeveBarText: text.action.sleeveBar(sleeveLevel, sleeveXpText, sleeveNextText, runsToNextXp),
      rewardLine: text.action.reward({
        amount: rewardText,
        unit: rewardUnit,
        multiplier: rewardMultiplierText === '1' ? null : rewardMultiplierText,
        heatPerRun,
        heatPerSecond,
      }),
      buyables: buyableViews.filter((b) => b.actionId === def.id),
      square: squareView(config, def.id, viewById, overclock, focus, augment, text),
      augment,
      overclock,
      focus,
    };
  });
}
