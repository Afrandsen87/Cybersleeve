/**
 * @module ui
 *
 * Pure translation of game state into display-ready data. No DOM access, fully testable.
 */
import type { ActionDefinition, BuyableDefinition, Currency, GameConfig, GameQueries, RewardKind, SleeveStats } from '../core';
import type { BigNum } from '../numbers';
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
  /** Display unit of the reward, short so it fits on one line, e.g. `"credits"` or `"nodes"`. */
  readonly rewardUnit: string;
  /** Output multiplier from purchases (`1` when none). */
  readonly outputMultiplierText: string;
  readonly progressPercent: number;
  readonly running: boolean;
  readonly auto: boolean;
  /** The action can be performed (access level and unlock rule satisfied). */
  readonly unlocked: boolean;
  /** Access level this action needs. */
  readonly requiredAccessLevel: number;
  /** Short reason the action is locked, e.g. `"Needs 1000 nodes"`; `null` while it is unlocked. */
  readonly lockedReason: string | null;
  /** What each run costs to start, e.g. `"50 nodes"` or `"1% of nodes (3)"` (share of the balance, with today's amount); `null` when free. */
  readonly startCostText: string | null;
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
  /** What the price is paid in, e.g. `"credits"` or `"nodes"`. */
  readonly costUnit: string;
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
  /** An auto-run purchase: once owned, clicking it switches auto-run on or off instead of buying. */
  readonly toggleable: boolean;
  /** For a toggleable purchase: owned and switched on. */
  readonly enabled: boolean;
  /** The button reacts to a click: it can be bought, or it is an owned toggle. */
  readonly clickable: boolean;
  /** Hover text: name, price or on/off state, and description. */
  readonly tip: string;
  /** A rebuyable that has been bought before and can be bought again right now (shown lit up). */
  readonly ready: boolean;
}

/** A titled group of Sleeve purchases. */
export interface SleeveSection {
  readonly id: 'rebuyable' | 'oneTime' | 'nodes';
  readonly title: string;
  /** Sorted by base price, lowest first. */
  readonly buyables: readonly BuyableView[];
}

/** Display data of the Sleeve widget: global stats and global purchases. */
export interface SleeveView {
  readonly accessLevelText: string;
  /** Interface speed as a plain number, e.g. `"0.15"` (up to 3 decimals). */
  readonly interfaceSpeedText: string;
  /** Hover text showing how interface speed is calculated: (base + boosts) x (1 + earned from actions). */
  readonly interfaceSpeedTip: string;
  readonly heatText: string;
  /** Hover text showing the heat tax calculation (heat, Circumvention reduction, cooldown). */
  readonly heatTip: string;
  /** Circumvention, formatted. */
  readonly circumventionText: string;
  /** Hover text showing how Circumvention lowers the heat effect. */
  readonly circumventionTip: string;
  /** Infamy as a plain number. */
  readonly infamyText: string;
  /** Hover text showing what Infamy does to the heat cooldown and how it decays. */
  readonly infamyTip: string;
  /** 0..100: how far the current heat cooldown cycle has progressed. */
  readonly heatCooldownPercent: number;
  /** True while heat is above 0, i.e. the cooldown is running. */
  readonly heatCooling: boolean;
  /** 0..100: how far the current Infamy cycle has progressed (at 100 Infamy drops by 1). */
  readonly infamyCooldownPercent: number;
  /** True while Infamy is above 0, i.e. its cycle is running. */
  readonly infamyCooling: boolean;
  /** The sleeve-wide purchases, in configuration order. */
  readonly buyables: readonly BuyableView[];
  /** The same purchases grouped for display (rebuyable, one-time, paid in nodes), each sorted by base price. Empty groups are left out. */
  readonly sections: readonly SleeveSection[];
}

/** Display data of the whole screen. */
export interface ViewModel {
  readonly creditsText: string;
  /** Network nodes built. */
  readonly networkText: string;
  /** Credits per second the network produces. */
  readonly passiveIncomeText: string;
  /** What each node produces compared to the base, e.g. `"x1.5"`. */
  readonly payoutPerNodeText: string;
  /** Hover text showing how the node payout multiplier is made up. */
  readonly payoutTip: string;
  readonly actions: readonly ActionView[];
  readonly sleeve: SleeveView;
  readonly canResleeve: boolean;
}

/** Display unit of each reward kind (UI text only; logic never reads it). */
const REWARD_UNITS: Readonly<Record<RewardKind, string>> = {
  credits: 'credits',
  networkNodes: 'nodes',
  interfaceSpeed: 'interface speed multiplier',
  nodePayout: 'node payout',
  circumvention: 'circumvention',
  infamy: 'infamy',
};

/** Display unit of each currency a buyable can be paid in. */
const COST_UNITS: Readonly<Record<Currency, string>> = {
  credits: 'credits',
  networkNodes: 'nodes',
};

/** Rounds to at most 3 decimals for display, e.g. `0.1500001` gives `"0.15"`. */
function plain(n: number): string {
  return String(Number(n.toFixed(3)));
}

/**
 * Explains the interface speed calculation: `(base + boosts) x network factor x (1 + earned)`.
 * The network line only appears once a network-based buyable is owned.
 *
 * @param stats the sleeve stats (their interface speed parts)
 */
function interfaceSpeedTip(stats: SleeveStats): string {
  const lines = ['Interface speed = (base + boosts) x network factor x run multiplier', `${plain(stats.interfaceBase)} (base + boosts)`];
  if (stats.interfaceNetworkFactor !== 1) lines.push(`x ${plain(stats.interfaceNetworkFactor)} (network: 1 + ln(nodes)/100)`);
  lines.push(
    `x ${plain(stats.interfaceEarnedFactor)} (1 + ${plain(stats.interfaceEarnedFactor - 1)} earned from actions)`,
    `= ${plain(stats.interfaceSpeed)}`,
  );
  return lines.join('\n');
}

/** What starting an action costs, for the card (the share of the balance is shown with today's amount). */
function startCostText(def: ActionDefinition, current: BigNum | null): string | null {
  const cost = def.startCost;
  if (!cost) return null;
  const unit = COST_UNITS[cost.currency];
  const parts: string[] = [];
  if (cost.amount && !cost.amount.isZero()) parts.push(`${formatBigNum(cost.amount)} ${unit}`);
  if (cost.fractionOfBalance !== undefined) {
    const now = current ? ` (${formatBigNum(current)})` : '';
    parts.push(`${plain(cost.fractionOfBalance * 100)}% of ${unit}${now}`);
  }
  return parts.join(' + ') || `0 ${unit}`;
}

/** Explains the node payout multiplier. */
function payoutTip(stats: SleeveStats, perNodePerSecond: number): string {
  return [
    'Node payout = purchases x (1 + earned from actions)',
    `x${plain(stats.nodePayoutBuyableFactor)} (purchases)`,
    `x${plain(stats.nodePayoutEarnedFactor)} (1 + ${plain(stats.nodePayoutEarnedFactor - 1)} earned from actions)`,
    `= x${plain(stats.nodePayoutMultiplier)}, so ${plain(perNodePerSecond * stats.nodePayoutMultiplier)} credits/s per node before the heat tax`,
  ].join('\n');
}

const SECTION_TITLES: Readonly<Record<SleeveSection['id'], string>> = {
  rebuyable: 'Rebuyable',
  oneTime: 'One-time',
  nodes: 'Paid in nodes',
};

/** Groups the Sleeve purchases into sections and sorts each by base price (ties keep the configuration order). */
function sleeveSections(config: GameConfig, views: readonly BuyableView[]): SleeveSection[] {
  const sectionOf = (b: BuyableDefinition): SleeveSection['id'] =>
    b.currency === 'networkNodes' ? 'nodes' : (b.maxPurchases ?? 1) > 1 ? 'rebuyable' : 'oneTime';
  const defs = config.buyables.filter((b) => b.actionId === undefined);
  return (['rebuyable', 'oneTime', 'nodes'] as const)
    .map((id): SleeveSection => {
      const members = defs.filter((b) => sectionOf(b) === id).sort((a, b) => (a.cost.lt(b.cost) ? -1 : a.cost.gt(b.cost) ? 1 : 0));
      return { id, title: SECTION_TITLES[id], buyables: members.flatMap((b) => views.filter((v) => v.id === b.id)) };
    })
    .filter((section) => section.buyables.length > 0);
}

/** Why an action is locked, in a few words (`null` when it is not). */
function lockedReason(def: ActionDefinition, unlocked: boolean, buyableName: (id: string) => string): string | null {
  if (unlocked) return null;
  if (def.unlock?.kind === 'nodes') return `Needs ${formatBigNum(numberFactory.fromNumber(def.unlock.amount))} nodes`;
  if (def.unlock?.kind === 'buyable') return `Needs ${buyableName(def.unlock.buyableId)}`;
  return `Needs access level ${def.requiredAccessLevel ?? 1}`;
}

/** Heat tax explained: effective tax after Circumvention, the heat at which credits stop, and the cooldown speed. */
function heatTip(stats: SleeveStats, cycleSeconds: number, amount: number): string {
  const keep = 1 - stats.heatReduction;
  const stopsAt = keep > 0 ? `${plain(100 / keep)} heat` : 'never';
  return [
    'Heat tax = heat x (1 - circumvention reduction), at most 100%',
    `${plain(stats.heat)} x ${plain(keep)} = ${plain(Math.min(100, stats.heat * keep))}% tax`,
    `Credits stop at ${stopsAt}`,
    `Cools ${plain(amount)} per ${plain(cycleSeconds)}s`,
  ].join('\n');
}

/** Circumvention explained: orders of magnitude times the reduction per order. */
function circumventionTip(stats: SleeveStats, perOrder: number): string {
  const orders = Math.max(0, stats.circumvention.log10());
  const full = perOrder > 0 ? `1e${plain(1 / perOrder)}` : 'never';
  return [
    'Circumvention lowers the effect of heat',
    `${plain(orders)} orders of magnitude x ${plain(perOrder * 100)}% = ${plain(stats.heatReduction * 100)}% less heat effect`,
    `100% at ${full}`,
  ].join('\n');
}

/** Infamy explained: the cooldown slowdown and the decay. */
function infamyTip(stats: SleeveStats, slowdown: number, decayMinutes: number): string {
  return [
    `Each infamy slows heat cooldown by ${plain(slowdown * 100)}%`,
    `Now: cooldown x${plain(1 + slowdown * stats.infamy)} as long`,
    `Falls by 1 every ${plain(decayMinutes)} min`,
  ].join('\n');
}

/** Hover text of a purchase button. */
function buyableTip(
  b: { name: string; description: string; costText: string; costUnit: string; owned: number },
  state: { toggleable: boolean; enabled: boolean; repeatable: boolean; maxed: boolean },
): string {
  if (state.toggleable && b.owned > 0) {
    return `${b.name} - ${state.enabled ? 'ON' : 'OFF'}\nClick to switch ${state.enabled ? 'off' : 'on'}\n${b.description}`;
  }
  if (state.maxed) return `${b.name} - owned\n${b.description}`;
  const owned = state.repeatable ? ` (owned: ${b.owned})` : '';
  return `${b.name}${owned}\n${b.costText} ${b.costUnit}\n${b.description}`;
}

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
 * Calls: {@link GameQueries}, `formatBigNum`.
 *
 * @param engine the engine to read from
 * @param factory number factory (for formatting numbers that are plain JS values)
 */
export function buildViewModel(engine: GameQueries, factory: NumberFactory = numberFactory): ViewModel {
  const state = engine.getState();
  const config = engine.getConfig();

  const stats = engine.sleeveStats();
  const buyableViews = config.buyables.map((b): BuyableView => {
    const owned = engine.ownedCount(b.id);
    const toggleable = b.effect.kind === 'autoRun';
    const enabled = toggleable && engine.isAutoRunEnabled(b.id);
    const maxed = engine.isBuyableMaxed(b.id);
    const affordable = engine.canBuy(b.id);
    const costText = formatBigNum(engine.costOf(b.id));
    const costUnit = COST_UNITS[engine.currencyOf(b.id)];
    const repeatable = (b.maxPurchases ?? 1) > 1;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      symbol: b.symbol ?? initials(b.name),
      actionId: b.actionId,
      costText,
      costUnit,
      owned,
      repeatable,
      maxed,
      available: engine.isBuyableAvailable(b.id),
      affordable,
      toggleable,
      enabled,
      clickable: (toggleable && owned > 0) || (!maxed && affordable),
      ready: repeatable && owned > 0 && !maxed && affordable,
      tip: buyableTip({ name: b.name, description: b.description, costText, costUnit, owned }, { toggleable, enabled, repeatable, maxed }),
    };
  });
  const buyableName = (id: string): string => config.buyables.find((b) => b.id === id)?.name ?? id;
  const cycleMs = config.sleeve.heatCooldownMs * (1 + config.sleeve.infamyHeatSlowdown * stats.infamy);

  const actions = config.actions.map((def): ActionView => {
    const s = state.actions[def.id];
    if (!s) throw new Error(`Missing state for action ${def.id}`);
    const duration = engine.currentDurationMs(def.id);
    const unlocked = engine.isUnlocked(def.id);
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
      unlocked,
      requiredAccessLevel: def.requiredAccessLevel ?? 1,
      lockedReason: lockedReason(def, unlocked, buyableName),
      startCostText: startCostText(def, engine.startCostOf(def.id)),
      heatPerRun: def.heatPerRun ?? 0,
      buyables: buyableViews.filter((b) => b.actionId === def.id),
    };
  });

  return {
    creditsText: formatBigNum(state.credits),
    networkText: formatBigNum(state.network),
    passiveIncomeText: formatBigNum(engine.passiveCreditsPerSecond()),
    payoutPerNodeText: `x${formatBigNum(factory.fromNumber(stats.nodePayoutMultiplier))}`,
    payoutTip: payoutTip(stats, config.network.creditsPerNodePerSecond * config.global.rewardMultiplier),
    actions,
    sleeve: {
      accessLevelText: String(stats.accessLevel),
      interfaceSpeedText: plain(stats.interfaceSpeed),
      interfaceSpeedTip: interfaceSpeedTip(stats),
      heatCooldownPercent: Math.min(100, (state.heatCooldownMs / cycleMs) * 100),
      heatCooling: stats.heat > 0,
      heatText: String(Number(stats.heat.toFixed(4))),
      heatTip: heatTip(stats, cycleMs / 1000, config.sleeve.heatCooldownAmount),
      circumventionText: formatBigNum(stats.circumvention),
      circumventionTip: circumventionTip(stats, config.sleeve.circumventionReductionPerOrder),
      infamyText: plain(stats.infamy),
      infamyTip: infamyTip(stats, config.sleeve.infamyHeatSlowdown, config.sleeve.infamyDecayPeriodMs / 60_000),
      infamyCooldownPercent: Math.min(100, (state.infamyCooldownMs / config.sleeve.infamyDecayPeriodMs) * 100),
      infamyCooling: stats.infamy > 0,
      buyables: buyableViews.filter((b) => b.actionId === undefined),
      sections: sleeveSections(config, buyableViews),
    },
    canResleeve: engine.canResleeve(),
  };
}
