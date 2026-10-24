/**
 * @module ui
 *
 * Pure translation of game state into display-ready data. No DOM access, fully testable.
 */
import type { GameEngine, RewardKind } from '../core';
import { formatBigNum, numberFactory, type NumberFactory } from '../numbers';

/** Display data of an experience track (action level or sleeve level) shown as a small bar. */
export interface XpTrackView {
  readonly level: number;
  readonly xpText: string;
  readonly nextLevelXpText: string;
  /** 0..100, how far through the current level. */
  readonly progressPercent: number;
}

/** Display data of one action. */
export interface ActionView {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly xpText: string;
  readonly nextLevelXpText: string;
  /** Action level bar: 0..100, how far through the current level. */
  readonly levelProgressPercent: number;
  /** This action's own sleeve level and XP. */
  readonly sleeve: XpTrackView & { readonly runsToNextXp: number };
  readonly speedText: string;
  readonly durationText: string;
  /** Amount actually received per run (all multipliers and the heat tax applied), in units of `rewardUnit`. */
  readonly rewardText: string;
  /** Display unit of the reward, e.g. `"credits"` or `"network nodes"`. */
  readonly rewardUnit: string;
  /** Output multiplier from purchases (`1` when none). */
  readonly outputMultiplierText: string;
  readonly progressPercent: number;
  readonly running: boolean;
  readonly auto: boolean;
  /** The sleeve's access level is high enough to perform this action. */
  readonly unlocked: boolean;
  /** Access level this action needs. */
  readonly requiredAccessLevel: number;
  /** Heat added by each completed run (0 for none). */
  readonly heatPerRun: number;
  /** The purchases that belong to this action, shown inside its card. */
  readonly buyables: readonly BuyableView[];
}

/** Display data of one buyable. */
export interface BuyableView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Short text for the square button (configured symbol, else the name's initials). */
  readonly symbol: string;
  /** Id of the action this purchase belongs to; absent for sleeve-wide (global) purchases. */
  readonly actionId: string | undefined;
  /** Price of the next copy. */
  readonly costText: string;
  /** Copies owned. */
  readonly owned: number;
  /** More than one copy can be bought. */
  readonly repeatable: boolean;
  /** No more copies can be bought. */
  readonly maxed: boolean;
  /** Requirements met; unavailable buyables are hidden. */
  readonly available: boolean;
  /** Can be bought right now. */
  readonly affordable: boolean;
}

/** Display data of the Sleeve widget: global stats and global purchases. */
export interface SleeveView {
  readonly accessLevelText: string;
  /** Interface speed as a percentage, e.g. `"15%"` for a multiplier of 0.15. */
  readonly interfaceSpeedText: string;
  readonly heatText: string;
  /** 0..100: how far the current heat cooldown cycle has progressed. */
  readonly heatCooldownPercent: number;
  /** True while heat is above 0, i.e. the cooldown is running. */
  readonly heatCooling: boolean;
  /** The sleeve-wide purchases. */
  readonly buyables: readonly BuyableView[];
}

/** Display data of the whole screen. */
export interface ViewModel {
  readonly creditsText: string;
  /** Network nodes built. */
  readonly networkText: string;
  /** Credits per second the network produces. */
  readonly passiveIncomeText: string;
  readonly actions: readonly ActionView[];
  readonly sleeve: SleeveView;
  readonly canResleeve: boolean;
}

/** Display unit of each reward kind (UI text only; logic never reads it). */
const REWARD_UNITS: Readonly<Record<RewardKind, string>> = {
  credits: 'credits',
  networkNodes: 'network nodes',
};

/** Initials of a name, e.g. `"Dual processors"` gives `"DP"`. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 3);
}

/**
 * Formats milliseconds as seconds with up to 2 decimals, e.g. `"3.33s"`.
 * @param ms duration in milliseconds
 */
export function formatSeconds(ms: number): string {
  return `${Number((ms / 1000).toFixed(2))}s`;
}

/**
 * Builds the view model for the current engine state.
 *
 * Called by: `ui/dom.ts` every step.
 * Calls: `GameEngine` queries, `formatBigNum`.
 *
 * @param engine the engine to read from
 * @param factory number factory (for formatting numbers that are plain JS values)
 */
export function buildViewModel(engine: GameEngine, factory: NumberFactory = numberFactory): ViewModel {
  const state = engine.getState();
  const config = engine.getConfig();

  const stats = engine.sleeveStats();
  const buyableViews = config.buyables.map(
    (b): BuyableView => ({
      id: b.id,
      name: b.name,
      description: b.description,
      symbol: b.symbol ?? initials(b.name),
      actionId: b.actionId,
      costText: formatBigNum(engine.costOf(b.id)),
      owned: engine.ownedCount(b.id),
      repeatable: (b.maxPurchases ?? 1) > 1,
      maxed: engine.isBuyableMaxed(b.id),
      available: engine.isBuyableAvailable(b.id),
      affordable: engine.canBuy(b.id),
    }),
  );

  const actions = config.actions.map((def): ActionView => {
    const s = state.actions[def.id];
    if (!s) throw new Error(`Missing state for action ${def.id}`);
    const duration = engine.currentDurationMs(def.id);
    return {
      id: def.id,
      name: def.name,
      level: engine.actionLevel(def.id),
      xpText: formatBigNum(s.xp),
      nextLevelXpText: formatBigNum(engine.nextActionLevelXp(def.id)),
      levelProgressPercent: engine.actionLevelProgress(def.id) * 100,
      sleeve: {
        level: engine.sleeveLevel(def.id),
        xpText: formatBigNum(s.sleeveXp),
        nextLevelXpText: formatBigNum(engine.nextSleeveLevelXp(def.id)),
        progressPercent: engine.sleeveLevelProgress(def.id) * 100,
        runsToNextXp: config.progression.runsPerSleeveXp - s.runsTowardSleeveXp,
      },
      speedText: `x${formatBigNum(factory.fromNumber(engine.currentSpeed(def.id)))}`,
      durationText: formatSeconds(duration),
      rewardText: formatBigNum(engine.payoutPerRun(def.id)),
      rewardUnit: REWARD_UNITS[def.rewardKind ?? 'credits'],
      outputMultiplierText: formatBigNum(engine.outputMultiplier(def.id)),
      progressPercent: s.running ? Math.min(100, (s.progressMs / duration) * 100) : 0,
      running: s.running,
      auto: engine.isAutoRun(def.id),
      unlocked: engine.isUnlocked(def.id),
      requiredAccessLevel: def.requiredAccessLevel ?? 1,
      heatPerRun: def.heatPerRun ?? 0,
      buyables: buyableViews.filter((b) => b.actionId === def.id),
    };
  });

  return {
    creditsText: formatBigNum(state.credits),
    networkText: formatBigNum(state.network),
    passiveIncomeText: formatBigNum(engine.passiveCreditsPerSecond()),
    actions,
    sleeve: {
      accessLevelText: String(stats.accessLevel),
      interfaceSpeedText: `${Number((stats.interfaceSpeed * 100).toFixed(2))}%`,
      heatCooldownPercent: Math.min(100, (state.heatCooldownMs / config.sleeve.heatCooldownMs) * 100),
      heatCooling: stats.heat > 0,
      heatText: `${Number(stats.heat.toFixed(4))} (${Number(Math.min(100, stats.heat).toFixed(4))}% tax)`,
      buyables: buyableViews.filter((b) => b.actionId === undefined),
    },
    canResleeve: engine.canResleeve(),
  };
}
