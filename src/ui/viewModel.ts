/**
 * @module ui
 *
 * Pure translation of game state into display-ready data. No DOM access, fully testable.
 *
 * @remarks
 * All wording comes from the injected {@link UiText}; this file decides WHAT to show and with which numbers.
 * Hover texts (`tip`, `speedTip`, `backChannelTip`) are getters: they are built when read, because only the tip under the
 * pointer is ever shown. Reading them for every element every frame would throw that saving away.
 */
import {
  type ActionDefinition,
  type BuyableDefinition,
  type GameConfig,
  type GameQueries,
  type SleeveStats,
  SPEED_FACTOR_IDS,
  earnedSpeedBeyond,
  itemCount,
  traitsOf,
} from '../core';
import type { BigNum } from '../numbers';
import { formatBigNum, formatPlain, numberFactory, type NumberFactory } from '../numbers';
import {
  type BuyableValues,
  type DropChanceParts,
  type SleeveSectionId,
  type SquareCellId,
  type StatId,
  type UiText,
  uiText as defaultText,
} from './uiText';

/** Display data of an experience track (action level or sleeve level) shown as a small bar. */
export interface XpTrackView {
  readonly level: number;
  /** XP gathered inside the current level. */
  readonly xpText: string;
  /** XP the current level costs in full (what `xpText` is counting towards). */
  readonly nextLevelXpText: string;
  /** 0..100, how far through the current level. */
  readonly progressPercent: number;
}

/** The Augment button of an action card. */
export interface AugmentButtonView {
  /** Button text. */
  readonly label: string;
  /** A schematic is held, so pressing the button applies one. */
  readonly enabled: boolean;
  /** Schematics applied to this action, over all rarities. */
  readonly applied: number;
  /** Hover text. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** A square toggle on an action card (Overclock or Focus). */
export interface ModeButtonView {
  /** Short text on the square button. */
  readonly symbol: string;
  /** Name read out for the button. */
  readonly name: string;
  /** The toggle is switched on. */
  readonly on: boolean;
  /** The button reacts to a click (it can be switched off, or on with a free slot). */
  readonly clickable: boolean;
  /** Hover text. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** One cell of the square on an action card. */
export interface SquareCellView {
  readonly id: SquareCellId;
  /** Short text on the square button (the fallback when the cell has no icon). */
  readonly symbol: string;
  /** Name read out for the button. */
  readonly name: string;
  /**
   * What a press does: `buy` buys the unlock (the feature is not owned yet), `toggle` switches an owned feature on or off, `press`
   * does something once (Augment), `empty` is a placeholder for a feature this action does not have.
   */
  readonly mode: 'buy' | 'toggle' | 'press' | 'empty';
  /** The toggle is on (for Augment: at least one schematic is applied). */
  readonly on: boolean;
  /** The button reacts to a press. */
  readonly clickable: boolean;
  /** A `buy` cell that can be bought right now (shown lit up). */
  readonly ready: boolean;
  /** The buyable behind a `buy` cell or the Auto-run toggle; `null` for the others. */
  readonly buyableId: string | null;
  /** Hover text. Built when read (a getter): only the tip under the pointer is ever shown. */
  readonly tip: string;
}

/** The square on an action card: beside the bars, holding the toggles of the action. */
export interface ActionSquareView {
  /**
   * Auto-run is not owned yet, so the whole square is the button that buys it (`cells[0]`). Once it is owned the square shows
   * all four cells: Auto-run, Overclock, Focus and Augment.
   */
  readonly locked: boolean;
  /** Always four cells, in the order they sit in the square (two rows of two). */
  readonly cells: readonly SquareCellView[];
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
  /** Amount actually received per run (all multipliers applied), in units of `rewardUnit`. */
  readonly rewardText: string;
  /** Display unit of the reward, short so it fits on one line, e.g. `"credits"` or `"nodes"`. */
  readonly rewardUnit: string;
  /** Multiplier on this action's reward per run from purchases (`1` when none). */
  readonly rewardMultiplierText: string;
  readonly progressPercent: number;
  readonly running: boolean;
  readonly auto: boolean;
  /** The action can be performed (access level high enough). */
  readonly unlocked: boolean;
  /** Starting it now would work (unlocked, and the start cost can be paid). */
  readonly startable: boolean;
  /** Access level this action needs. */
  readonly requiredAccessLevel: number;
  /** Short reason the action is locked, e.g. `"Needs access level 3"`; `null` while it is unlocked. */
  readonly lockedReason: string | null;
  /** The poster shown instead of the card while the action is locked, e.g. `"Increase Access level to 3"`. */
  readonly posterText: string;
  /** What each run costs to start, e.g. `"50 nodes"` or `"1% of nodes (3)"` (share of the balance, with today's amount); `null` when free. */
  readonly startCostText: string | null;
  /** Heat added by each completed run (0 for none). */
  readonly heatPerRun: number;
  /** The one-line description under the title (speed, duration, cost; or why the action is locked). */
  readonly infoText: string;
  /** Hover text for the info line: how the action's speed comes about (empty while the action is locked). Built when read. */
  readonly speedTip: string;
  /** Label of the action level bar. */
  readonly levelBarText: string;
  /** Label of the sleeve level bar. */
  readonly sleeveBarText: string;
  /** The reward line at the bottom of the card. */
  readonly rewardLine: string;
  /** The purchases that belong to this action (those flagged `inSquare` are shown in its square, the others in its row of purchases). */
  readonly buyables: readonly BuyableView[];
  /** The square beside the bars: Auto-run, Overclock, Focus and Augment. */
  readonly square: ActionSquareView;
  /** The Augment button in the top right corner of the card; `null` when the game has no schematic to apply. */
  readonly augment: AugmentButtonView | null;
  /** The Overclock toggle; `null` until the Overclock buyable is owned, and for an action that has no Overclock effect. */
  readonly overclock: ModeButtonView | null;
  /** The Focus toggle; `null` until a Focus slot is owned. */
  readonly focus: ModeButtonView | null;
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
  /** Hover text: name, price or on/off state, and description. Built when read. */
  readonly tip: string;
  /** A rebuyable that has been bought before and can be bought again right now (shown lit up). */
  readonly ready: boolean;
  /** The purchase is shown in the square of its action's card (Auto-run, the Overclock and Focus unlocks), not in the card's row of purchases. */
  readonly inSquare: boolean;
}

/** A titled group of Sleeve purchases. */
export interface SleeveSection {
  readonly id: SleeveSectionId;
  readonly title: string;
  /** Sorted by base price, lowest first. */
  readonly buyables: readonly BuyableView[];
}

/** A thin cycle bar under a stat (a cooldown or decay). */
export interface StatBarView {
  /** Says what the bar is, and when its cycle is paused. */
  readonly label: string;
  /** 0..100, how far the current cycle has progressed. */
  readonly percent: number;
  /** True while the cycle advances (the stat is above 0). */
  readonly running: boolean;
}

/** One labelled value in a stat widget, optionally with a hover explanation and a cycle bar. */
export interface StatRowView {
  readonly id: StatId;
  readonly label: string;
  readonly text: string;
  /** The row has a hover text (known without building it). */
  readonly hasTip: boolean;
  /** Hover text for the whole row; `null` when the stat has none. Built when read (a getter), not when the view model is built. */
  readonly tip: string | null;
  /** Cycle bar shown under the row; `null` when the stat has none. */
  readonly bar: StatBarView | null;
  /** The row is not shown (a stat that exists only once something unlocks it). */
  readonly hidden: boolean;
}

/** Display data of the Sleeve widget: global stats and global purchases. */
export interface SleeveView {
  readonly title: string;
  /** Access level, interface speed, ICE Rating, heat and Legend, in display order. */
  readonly stats: readonly StatRowView[];
  /** The sleeve-wide purchases, in configuration order. */
  readonly buyables: readonly BuyableView[];
  /** The same purchases grouped for display (rebuyable, one-time, paid in nodes), each sorted by base price. Empty groups are left out. */
  readonly sections: readonly SleeveSection[];
}

/** Display data of the Network widget. */
export interface NetworkView {
  readonly title: string;
  /** Nodes, credits per second and payout per node, in display order. */
  readonly stats: readonly StatRowView[];
}

/** Display data of one stack of items (one item in one rarity). */
export interface InventoryRowView {
  readonly itemId: string;
  readonly rarityId: string;
  /** E.g. `"Common Kompromat file"`; just the item's name for an item without rarity. */
  readonly label: string;
  /** Short text shown on the tile when the item has no icon (the initials of the item's name). */
  readonly symbol: string;
  /** Position of the rarity in the list of rarities (0 = most common), for colouring the tile; `null` for an item without rarity. */
  readonly rarityIndex: number | null;
  /** Items held. A tile with 0 is shown dimmed. */
  readonly count: number;
  /** The stack can be paid out for credits (false for items such as Augment schematics, which are applied instead). */
  readonly sellable: boolean;
  readonly countText: string;
  /** Items of this kind are used up by clicking their tile (Burn leads). */
  readonly usable: boolean;
  /** Clicking the tile now would do something (a lead is held and there is heat to act on; the Zero-day toggle is on or one is held). */
  readonly canUse: boolean;
  /** Clicking the tile switches the item on or off instead of using it up (Zero-days). */
  readonly toggleable: boolean;
  /** For a toggleable item: it is switched on. */
  readonly on: boolean;
  /** The Back Channel Deals skill is owned and this stack can be given up for Moles. */
  readonly backChannel: boolean;
  /** Hover text of the back channel button (empty when `backChannel` is false). */
  readonly backChannelTip: string;
  /** Hover text: what one item sells for and what the whole stack is worth. Built when read. */
  readonly tip: string;
}

/** Display data of the Inventory widget. */
export interface InventoryView {
  readonly title: string;
  /** The widget is shown once something can drop or is held. */
  readonly visible: boolean;
  /** One row per item and rarity in the configuration, most common first (one row for an item without rarity); rows with a count of 0 are hidden by the screen. */
  readonly rows: readonly InventoryRowView[];
}

/** One tab at the top. */
export interface TabView {
  readonly id: 'character' | 'skills';
  readonly label: string;
}

/** Display data of the Skills tab. */
export interface SkillsView {
  readonly title: string;
  /** Skill points that can still be spent. */
  readonly points: number;
  readonly pointsText: string;
  /** The skills, in configuration order. */
  readonly buyables: readonly BuyableView[];
}

/** Display data of the whole screen. */
export interface ViewModel {
  /** The balance on its own, e.g. `"12"`. */
  readonly creditsText: string;
  /** The balance line, e.g. `"12 credits"`. */
  readonly creditsLine: string;
  /** The tabs at the top, in order. */
  readonly tabs: readonly TabView[];
  readonly skills: SkillsView;
  readonly network: NetworkView;
  readonly inventory: InventoryView;
  readonly actions: readonly ActionView[];
  readonly sleeve: SleeveView;
  readonly canResleeve: boolean;
}

/** Finds a stat row by id. @throws Error if the widget has no such row */
export function statRow(rows: readonly StatRowView[], id: StatId): StatRowView {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`No stat row ${id}`);
  return row;
}

const row = (
  id: StatId,
  text: UiText,
  value: string,
  tip: (() => string) | null = null,
  bar: StatBarView | null = null,
  hidden = false,
): StatRowView => ({
  id,
  label: text.statLabels[id],
  text: value,
  hasTip: tip !== null,
  get tip() {
    return tip === null ? null : tip();
  },
  bar,
  hidden,
});

/**
 * The next action that opens at a higher access level than the sleeve has: the lowest level above it, the first such action
 * in the configuration order.
 *
 * Called by: {@link sleeveRows}.
 *
 * @param config game configuration (reads the actions and their `requiredAccessLevel`)
 * @param accessLevel the sleeve's access level now
 * @returns its name and required level, or `null` when every action is open
 */
function nextUnlock(config: GameConfig, accessLevel: number): { name: string; level: string } | null {
  let next: ActionDefinition | null = null;
  for (const a of config.actions) {
    const level = a.requiredAccessLevel ?? 1;
    if (level > accessLevel && (next === null || level < (next.requiredAccessLevel ?? 1))) next = a;
  }
  return next === null ? null : { name: next.name, level: String(next.requiredAccessLevel ?? 1) };
}

/** The sleeve stat rows. */
function sleeveRows(stats: SleeveStats, state: ReturnType<GameQueries['getState']>, config: GameConfig, text: UiText): StatRowView[] {
  const { sleeve } = config;
  const keep = 1 - stats.heatReduction;
  const stopsAt = keep > 0 && sleeve.heatTaxPerPoint > 0 ? text.format.heatPoints(formatPlain(1 / sleeve.heatTaxPerPoint / keep)) : null;
  const cycleMs = sleeve.heatCooldownMs / (1 + sleeve.legendHeatSpeedup * stats.legend);
  const orders = Math.max(0, stats.iceRating.log10());
  const beyond = earnedSpeedBeyond(sleeve);
  const curve = {
    scale: sleeve.earnedSpeedScale,
    exponent: sleeve.earnedSpeedExponent,
    // a second shape is only worth a line in the tip while it differs from the first
    ...(beyond && beyond.exponent !== sleeve.earnedSpeedExponent ? { beyond } : {}),
  };
  const proficiency = state.hackingProficiency.mul(numberFactory.fromNumber(stats.hackingProficiencyFactor));
  const cooldownSpeed = stats.heatCooldownSpeed;
  const coolsNow = stats.heat >= sleeve.heatCooldownAmount; // the cooldown waits for a whole point of heat
  const heatTip = (): string =>
    text.tips.heat({
      heat: formatPlain(stats.heat),
      perPointPercent: formatPlain(sleeve.heatTaxPerPoint * 100),
      reductionPercent: formatPlain(stats.heatReduction * 100),
      taxPercent: formatPlain(Math.min(100, stats.heat * keep * sleeve.heatTaxPerPoint * 100)),
      stopsAt,
      amount: formatPlain(sleeve.heatCooldownAmount),
      cycleSeconds: formatPlain(cycleMs / cooldownSpeed / 1000),
      moles: state.moles > 0 ? { moles: formatPlain(state.moles), boostPercent: formatPlain(stats.heatCooldownBoost * 100) } : null,
    });
  return [
    row('access', text, String(stats.accessLevel), () =>
      text.tips.access({
        start: String(sleeve.baseAccessLevel),
        purchases: String(stats.accessLevel - sleeve.baseAccessLevel),
        level: String(stats.accessLevel),
        next: nextUnlock(config, stats.accessLevel),
      }),
    ),
    row('interfaceSpeed', text, formatPlain(stats.interfaceSpeed), () =>
      text.tips.interfaceSpeed({
        base: formatPlain(sleeve.baseInterfaceSpeed),
        boosts: formatPlain(stats.interfaceBoosts),
        networkFactor: stats.interfaceNetworkFactor === 1 ? null : formatPlain(stats.interfaceNetworkFactor),
        nodes: formatBigNum(state.network),
        hackingMultiplier: formatPlain(stats.hackingMultiplier, MULTIPLIER_DECIMALS),
        curve,
        skillFactor: stats.interfaceSkillFactor === 1 ? null : formatPlain(stats.interfaceSkillFactor, MULTIPLIER_DECIMALS),
        total: formatPlain(stats.interfaceSpeed, SPEED_DECIMALS),
      }),
    ),
    row('hackingProficiency', text, formatBigNum(proficiency, PROFICIENCY_DECIMALS), () =>
      text.tips.hackingProficiency({
        proficiency: formatBigNum(proficiency, PROFICIENCY_DECIMALS),
        hackingMultiplier: formatPlain(stats.hackingMultiplier, MULTIPLIER_DECIMALS),
        curve,
      }),
    ),
    row('iceRating', text, formatBigNum(stats.iceRating), () =>
      text.tips.iceRating({
        orders: formatPlain(orders),
        perOrderPercent: formatPlain(sleeve.iceRatingReductionPerOrder * 100),
        reductionPercent: formatPlain(stats.heatReduction * 100),
        fullAt: sleeve.iceRatingReductionPerOrder > 0 ? text.format.powerOfTen(formatPlain(1 / sleeve.iceRatingReductionPerOrder)) : null,
      }),
    ),
    row('heat', text, String(Number(stats.heat.toFixed(4))), heatTip, {
      label: text.bars.heat(coolsNow),
      percent: Math.min(100, (state.heatCooldownMs / cycleMs) * 100),
      running: coolsNow,
    }),
    row(
      'legend',
      text,
      formatPlain(stats.legend),
      () =>
        text.tips.legend({
          legend: formatPlain(stats.legend),
          baseSeconds: formatPlain(sleeve.heatCooldownMs / 1000),
          speedupPercent: formatPlain(sleeve.legendHeatSpeedup * 100),
          cycleSeconds: formatPlain(cycleMs / 1000),
          decayMinutes: formatPlain(sleeve.legendDecayPeriodMs / 60_000),
        }),
      {
        label: text.bars.legend(stats.legend > 0),
        percent: Math.min(100, (state.legendCooldownMs / sleeve.legendDecayPeriodMs) * 100),
        running: stats.legend > 0,
      },
    ),
    row(
      'criticalChance',
      text,
      `${formatPlain(stats.criticalChance * 100)}%`,
      () =>
        text.tips.critical({
          chancePercent: formatPlain(stats.criticalChance * 100),
          xpMultiplier: formatPlain(config.criticalSuccess.xpMultiplier),
          rewardMultiplier: formatPlain(config.criticalSuccess.rewardMultiplier),
        }),
      null,
      !(stats.criticalChance > 0), // the row appears with the first Critical success purchase
    ),
  ];
}

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

/** Which Sleeve purchases go in which section, and in which order: derived from the content only, so computed once per config. */
const layoutCache = new WeakMap<GameConfig, readonly { id: SleeveSectionId; ids: readonly string[] }[]>();

/** Decimals shown for Hacking Proficiency: each run adds a small amount (0.001), which two decimals would hide. */
const PROFICIENCY_DECIMALS = 4;

/** Decimals shown for speeds in the calculation tooltips, so that the lines add up (5s / 0.1546 = 32.34s). */
const SPEED_DECIMALS = 4;

/** Decimals shown for the hacking multiplier, so that the same small steps show up in it. */
const MULTIPLIER_DECIMALS = 4;

/** Decimals shown for the credits per second that actions add to a node's base (each run adds a tiny amount). */
const ACTION_BONUS_DECIMALS = 9;

/** Decimals shown for what one node pays per second (the amounts are small, 0.075 must not show as 0.08). */
const PER_NODE_DECIMALS = 3;

/**
 * Explains an action's speed: the factors it is the product of, with the levels behind them.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.speedFactors`, `actionLevel`, `sleeveLevel`, `levelBonus`.
 */
function speedTip(
  engine: GameQueries,
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

/** Groups the Sleeve purchases into sections and sorts each by base price (ties keep the configuration order). */
function sectionLayout(config: GameConfig): readonly { id: SleeveSectionId; ids: readonly string[] }[] {
  const cached = layoutCache.get(config);
  if (cached) return cached;
  const sectionOf = (b: BuyableDefinition): SleeveSectionId =>
    b.currency === 'networkNodes' ? 'nodes' : (b.maxPurchases ?? 1) > 1 ? 'rebuyable' : 'oneTime';
  const defs = config.buyables.filter((b) => b.actionId === undefined && b.currency !== 'skillPoints');
  const layout = (['rebuyable', 'oneTime', 'nodes'] as const)
    .map((id) => ({
      id,
      ids: defs
        .filter((b) => sectionOf(b) === id)
        .sort((a, b) => (a.cost.lt(b.cost) ? -1 : a.cost.gt(b.cost) ? 1 : 0))
        .map((b) => b.id),
    }))
    .filter((section) => section.ids.length > 0);
  layoutCache.set(config, layout);
  return layout;
}

/** Why an action is locked, in a few words (`null` when it is not). */
function lockedReason(def: ActionDefinition, unlocked: boolean, text: UiText): string | null {
  return unlocked ? null : text.lock.access(def.requiredAccessLevel ?? 1);
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
 * @param text the display text (default: the placeholder text of the game)
 */
export function formatSeconds(ms: number, text: UiText = defaultText): string {
  return text.format.seconds(String(Number((ms / 1000).toFixed(2))));
}

/** Decimals shown for a drop chance in percent (a rare drop of a rare item is a small number). */
const DROP_CHANCE_DECIMALS = 4;

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
function dropChances(engine: GameQueries, itemId: string, rarityId: string): readonly DropChanceParts[] {
  const actions = engine.getConfig().actions;
  return engine.dropSources(itemId, rarityId).map((source) => ({
    action: actions.find((a) => a.id === source.actionId)?.name ?? source.actionId,
    percent: formatPlain(source.chance * 100, DROP_CHANCE_DECIMALS),
  }));
}

/**
 * The live numbers behind the formula of a purchase, for the effects that have a formula to fill in.
 *
 * Called by: {@link buildViewModel}. Calls: `GameQueries.actionLevel`, the text table.
 *
 * @param b the purchase
 * @param engine the engine to read the numbers from
 * @param owned copies owned (a purchase not yet owned shows what one copy gives)
 * @param text the display text
 * @returns the variables and the result, or `null` when the effect has no formula to fill in
 */
function purchaseValues(b: BuyableDefinition, engine: GameQueries, owned: number, text: UiText): BuyableValues | null {
  if (b.effect.kind !== 'networkGrowthFromActionLevel') return null;
  const level = engine.actionLevel(b.effect.sourceActionId);
  const copies = Math.max(1, owned);
  return text.tips.networkGrowthValues({ level: String(level), percent: formatPlain(level * b.effect.percentPerLevel * copies, 4) });
}

/**
 * The Augment button of one action.
 *
 * Called by: {@link buildViewModel}. Calls: `itemCount`, `GameQueries.xpPerRun`, the text table.
 *
 * @param engine the engine to read from
 * @param actionId the action
 * @param text the display text
 * @returns the button, or `null` when the content has no schematic to apply
 */
function augmentView(engine: GameQueries, actionId: string, text: UiText): AugmentButtonView | null {
  const config = engine.getConfig();
  const augment = config.items.augment;
  if (!augment) return null;
  const state = engine.getState();
  const held = config.items.rarities.reduce((sum, r) => sum + itemCount(state, augment.itemId, r.id), 0);
  const appliedByRarity = state.actions[actionId]?.augments ?? {};
  const applied = config.items.rarities.flatMap((r) =>
    (appliedByRarity[r.id] ?? 0) > 0 ? [{ rarity: r.name, count: String(appliedByRarity[r.id]) }] : [],
  );
  const total = config.items.rarities.reduce((sum, r) => sum + (appliedByRarity[r.id] ?? 0), 0);
  const nextRarity = config.items.rarities.find((r) => itemCount(state, augment.itemId, r.id) > 0);
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
        next: nextRarity?.name ?? null,
        item,
      });
    },
  };
}

/** Decimals shown for the action XP per run (each schematic adds a small share of it). */
const AUGMENT_XP_DECIMALS = 4;

/** Decimals shown for heat in the Burn lead tip (heat comes in fractions of a point). */
const HEAT_DECIMALS = 4;

/** Decimals shown for the bonus one schematic adds, as a plain number (0.01). */
const AUGMENT_BONUS_DECIMALS = 6;

/** The effect kinds whose buyables are shown in the square of an action card instead of its row of purchases. */
const SQUARE_EFFECTS: readonly BuyableDefinition['effect']['kind'][] = ['autoRun', 'overclockUnlock', 'focusUnlock'];

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
function squareView(
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
function overclockView(engine: GameQueries, actionId: string, text: UiText): ModeButtonView | null {
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
function focusView(engine: GameQueries, actionId: string, text: UiText): ModeButtonView | null {
  const status = engine.focusStatus(actionId);
  if (!status) return null;
  return {
    ...text.action.modes.focus,
    on: status.on,
    clickable: status.canSwitchOn,
    get tip() {
      return text.tips.focus({
        on: status.on,
        bonusPercent: formatPlain(status.speedBonus * 100),
        used: String(status.used),
        slots: String(status.slots),
        full: !status.canSwitchOn,
      });
    },
  };
}

/** Decimals shown for the strength and the heat cost of Overclock (strength grows in steps of a tenth). */
const MODE_DECIMALS = 4;

/**
 * The Inventory widget: one row per item and rarity.
 *
 * Called by: {@link buildViewModel}. Calls: `itemCount`, the text table.
 *
 * @param engine the engine to read from
 * @param factory number factory (for stack values)
 * @param text the display text
 */
function inventoryView(engine: GameQueries, factory: NumberFactory, text: UiText): InventoryView {
  const state = engine.getState();
  const { items, buyables } = engine.getConfig();
  const channel = engine.backChannel();
  const burnLead = items.burnLead;
  const zeroDay = items.zeroDay;
  const adminKey = items.adminKey;
  const skillShard = items.skillShard;
  const nameOf = (id: string): string => items.definitions.find((d) => d.id === id)?.name ?? id;
  const actionNameOf = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : engine.getConfig().actions.find((a) => a.id === id)?.name;
  const zeroDayAction = actionNameOf(zeroDay?.actionId);
  const adminKeyAction = actionNameOf(adminKey?.actionId);
  const rows = items.definitions.flatMap((item) =>
    // An item without rarity is one stack (kept under the most common rarity) and is named by the item alone.
    (item.hasRarity === false ? items.rarities.slice(0, 1) : items.rarities).map((rarity): InventoryRowView => {
      const count = itemCount(state, item.id, rarity.id);
      const label = item.hasRarity === false ? item.name : text.inventory.label(rarity.name, item.name);
      const backChannel = channel !== null && channel.itemId === item.id && channel.rarityId === rarity.id;
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
        countText: formatBigNum(factory.fromNumber(count)),
        sellable: item.sellable !== false,
        usable,
        canUse:
          (usable && !isShard && engine.canUseBurnLead(rarity.id)) ||
          (isShard && engine.canUseSkillShard()) ||
          (isZeroDay && engine.canToggleZeroDays()) ||
          (isAdminKey && engine.canToggleAdminKeys()),
        toggleable,
        on: (isZeroDay && state.zeroDaysOn) || (isAdminKey && state.adminKeysOn),
        backChannel,
        get backChannelTip() {
          return backChannel && channel
            ? text.tips.backChannel({
                label,
                molesPerItem: formatPlain(channel.molesPerItem),
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
              heat: formatPlain(state.heat, HEAT_DECIMALS),
              heatAfter: formatPlain(state.heat * (1 - burnLead.heatFraction), HEAT_DECIMALS),
              count: formatBigNum(factory.fromNumber(count)),
              canUse: state.heat > 0,
            });
          }
          if (isAdminKey && adminKey && adminKeyAction) {
            return text.tips.adminKey({
              label,
              drops,
              actionName: adminKeyAction,
              count: formatBigNum(factory.fromNumber(count)),
              on: state.adminKeysOn,
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
              on: state.zeroDaysOn,
              canToggle: engine.canToggleZeroDays(),
            });
          }
          return item.sellable === false
            ? text.tips.stackKept({ label, count: formatBigNum(factory.fromNumber(count)), drops })
            : text.tips.stack({
                label,
                drops,
                sellValue: formatBigNum(rarity.sellValue),
                count: formatBigNum(factory.fromNumber(count)),
                total: formatBigNum(rarity.sellValue.mul(factory.fromNumber(count))),
                unit: text.costUnits.credits,
              });
        },
      };
    }),
  );
  const dropSource = buyables.some((b) => b.effect.kind === 'itemDrop' && engine.ownedCount(b.id) > 0);
  return {
    title: text.titles.inventory,
    visible: dropSource || rows.some((r) => r.count > 0),
    rows,
  };
}

/**
 * Builds the view model for the current engine state.
 *
 * Called by: `ui/dom.ts` every refresh.
 * Calls: {@link GameQueries}, `formatBigNum`, the text table.
 *
 * @param engine the engine to read from
 * @param factory number factory (for formatting numbers that are plain JS values)
 * @param text the display text (default: the placeholder text of the game)
 */
export function buildViewModel(engine: GameQueries, factory: NumberFactory = numberFactory, text: UiText = defaultText): ViewModel {
  return engine.snapshot(() => buildScoped(engine, factory, text));
}

/** The work of {@link buildViewModel}, run inside the engine's snapshot scope so the sleeve stats and skill points are computed once. */
function buildScoped(engine: GameQueries, factory: NumberFactory, text: UiText): ViewModel {
  const state = engine.getState();
  const config = engine.getConfig();

  const stats = engine.sleeveStats();
  const buyableViews = config.buyables.map((b): BuyableView => {
    const owned = engine.ownedCount(b.id);
    const toggleable = traitsOf(b).toggleable;
    const enabled = toggleable && engine.isAutoRunEnabled(b.id);
    const maxed = engine.isBuyableMaxed(b.id);
    const affordable = engine.canBuy(b.id);
    const costText = formatBigNum(engine.costOf(b.id));
    const costUnit = text.costUnits[engine.currencyOf(b.id)];
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
      inSquare: SQUARE_EFFECTS.includes(b.effect.kind),
      get tip() {
        return text.tips.buyable({
          name: b.name,
          description: b.description,
          formula: b.formula ?? null,
          values: purchaseValues(b, engine, owned, text),
          cost: costText,
          costUnit,
          owned,
          repeatable,
          maxed,
          toggleable,
          enabled,
        });
      },
    };
  });
  const viewById = new Map(buyableViews.map((v) => [v.id, v]));

  const actions = config.actions.map((def): ActionView => {
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
    return {
      id: def.id,
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

  const keep = engine.creditKeepFactor();
  return {
    creditsText: formatBigNum(state.credits),
    creditsLine: text.credits(formatBigNum(state.credits)),
    network: {
      title: text.titles.network,
      stats: [
        row('nodes', text, formatBigNum(state.network)),
        row('payout', text, text.perSecond(formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS)), () =>
          text.tips.payout({
            base: formatPlain(config.network.creditsPerNodePerSecond),
            creditLever: config.global.creditMultiplier === 1 ? null : formatPlain(config.global.creditMultiplier),
            purchases: formatPlain(stats.nodePayoutMultiplier),
            actionBonus: formatPlain(stats.nodePayoutBonus, ACTION_BONUS_DECIMALS),
            keepPercent: keep >= 1 ? null : formatPlain(keep * 100),
            perNode: formatBigNum(engine.passiveCreditsPerNode(), PER_NODE_DECIMALS),
            nodes: formatBigNum(state.network),
            total: formatBigNum(engine.passiveCreditsPerSecond()),
          }),
        ),
        row('income', text, text.format.income(formatBigNum(engine.passiveCreditsPerSecond()))),
        row(
          'moles',
          text,
          formatPlain(state.moles),
          () => text.tips.moles({ moles: formatPlain(state.moles), boostPercent: formatPlain(stats.heatCooldownBoost * 100) }),
          null,
          engine.backChannel() === null && !(state.moles > 0), // the counter appears with the skill that gives Moles
        ),
      ],
    },
    tabs: [
      { id: 'character', label: text.tabs.character },
      { id: 'skills', label: text.tabs.skills(engine.skillPoints()) },
    ],
    skills: {
      title: text.titles.skills,
      points: engine.skillPoints(),
      pointsText: text.skills.points(formatPlain(engine.skillPoints())),
      buyables: buyableViews.filter((b) => config.buyables.find((d) => d.id === b.id)?.currency === 'skillPoints'),
    },
    inventory: inventoryView(engine, factory, text),
    actions,
    sleeve: {
      title: text.titles.sleeve,
      stats: sleeveRows(stats, state, config, text),
      buyables: buyableViews.filter(
        (b) => b.actionId === undefined && config.buyables.find((d) => d.id === b.id)?.currency !== 'skillPoints',
      ),
      sections: sectionLayout(config).map((section) => ({
        id: section.id,
        title: text.sections[section.id],
        buyables: section.ids.flatMap((id) => viewById.get(id) ?? []),
      })),
    },
    canResleeve: engine.canResleeve(),
  };
}
