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
  itemCount,
  wholeOrders,
  traitsOf,
} from '../core';
import type { BigNum } from '../numbers';
import { formatBigNum, formatPlain, numberFactory, type NumberFactory } from '../numbers';
import { type BuyableValues, type SleeveSectionId, type StatId, type UiText, uiText as defaultText } from './uiText';

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
  /** The purchases that belong to this action, shown inside its card. */
  readonly buyables: readonly BuyableView[];
  /** The Augment button in the top right corner of the card; `null` when the game has no schematic to apply. */
  readonly augment: AugmentButtonView | null;
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
  /** Access level, interface speed, ICE Rating, heat and Infamy, in display order. */
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
  /** E.g. `"Common Kompromat file"`. */
  readonly label: string;
  /** Items held. The row is shown only while this is above 0. */
  readonly count: number;
  /** The stack can be paid out for credits (false for items such as Augment schematics, which are applied instead). */
  readonly sellable: boolean;
  readonly countText: string;
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
  /** Shown while no stack is held. */
  readonly emptyText: string;
  /** One row per item and rarity in the configuration, most common first; rows with a count of 0 are hidden by the screen. */
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
  const stopsAt = keep > 0 && sleeve.heatTaxPerPoint > 0 ? `${formatPlain(1 / sleeve.heatTaxPerPoint / keep)} heat` : null;
  const cycleMs = sleeve.heatCooldownMs * (1 + sleeve.infamyHeatSlowdown * stats.infamy);
  const orders = Math.max(0, stats.iceRating.log10());
  const curve = { scale: sleeve.earnedSpeedScale, exponent: sleeve.earnedSpeedExponent };
  const effectiveProficiency = state.hackingProficiency.mul(numberFactory.fromNumber(stats.hackingProficiencyFactor));
  const cooldownSpeed = stats.heatCooldownSpeed;
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
    row('hackingProficiency', text, formatBigNum(effectiveProficiency, PROFICIENCY_DECIMALS), () =>
      text.tips.hackingProficiency({
        proficiency: formatBigNum(effectiveProficiency, PROFICIENCY_DECIMALS),
        hackingMultiplier: formatPlain(stats.hackingMultiplier, MULTIPLIER_DECIMALS),
        curve,
      }),
    ),
    row('iceRating', text, formatBigNum(stats.iceRating), () =>
      text.tips.iceRating({
        orders: formatPlain(orders),
        perOrderPercent: formatPlain(sleeve.iceRatingReductionPerOrder * 100),
        reductionPercent: formatPlain(stats.heatReduction * 100),
        fullAt: sleeve.iceRatingReductionPerOrder > 0 ? `1e${formatPlain(1 / sleeve.iceRatingReductionPerOrder)}` : null,
      }),
    ),
    row('heat', text, String(Number(stats.heat.toFixed(4))), heatTip, {
      label: text.bars.heat(stats.heat > 0),
      percent: Math.min(100, (state.heatCooldownMs / cycleMs) * 100),
      running: stats.heat > 0,
    }),
    row(
      'infamy',
      text,
      formatPlain(stats.infamy),
      () =>
        text.tips.infamy({
          infamy: formatPlain(stats.infamy),
          baseSeconds: formatPlain(sleeve.heatCooldownMs / 1000),
          slowdownPercent: formatPlain(sleeve.infamyHeatSlowdown * 100),
          cycleSeconds: formatPlain(cycleMs / 1000),
          decayMinutes: formatPlain(sleeve.infamyDecayPeriodMs / 60_000),
        }),
      {
        label: text.bars.infamy(stats.infamy > 0),
        percent: Math.min(100, (state.infamyCooldownMs / sleeve.infamyDecayPeriodMs) * 100),
        running: stats.infamy > 0,
      },
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
    baseDuration: formatSeconds(def.baseDurationMs),
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
function lockedReason(def: ActionDefinition, unlocked: boolean, buyableName: (id: string) => string, text: UiText): string | null {
  if (unlocked) return null;
  if (def.unlock?.kind === 'nodes') return text.lock.nodes(formatBigNum(numberFactory.fromNumber(def.unlock.amount)));
  if (def.unlock?.kind === 'buyable') return text.lock.buyable(buyableName(def.unlock.buyableId));
  return text.lock.access(def.requiredAccessLevel ?? 1);
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
  if (b.effect.kind === 'rarityShiftFromProficiency') {
    const proficiency = engine.getState().hackingProficiency;
    return text.tips.rarityShiftValues({
      proficiency: formatBigNum(proficiency, PROFICIENCY_DECIMALS),
      shifts: String(wholeOrders(proficiency)),
    });
  }
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

/** Decimals shown for the bonus one schematic adds, as a plain number (0.01). */
const AUGMENT_BONUS_DECIMALS = 6;

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
  const rows = items.definitions.flatMap((item) =>
    items.rarities.map((rarity): InventoryRowView => {
      const count = itemCount(state, item.id, rarity.id);
      const label = text.inventory.label(rarity.name, item.name);
      const backChannel = channel !== null && channel.itemId === item.id && channel.rarityId === rarity.id;
      return {
        itemId: item.id,
        rarityId: rarity.id,
        label,
        count,
        countText: formatBigNum(factory.fromNumber(count)),
        sellable: item.sellable !== false,
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
          return item.sellable === false
            ? text.tips.stackKept({ label, count: formatBigNum(factory.fromNumber(count)) })
            : text.tips.stack({
                label,
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
    emptyText: text.inventory.empty,
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
  const buyableName = (id: string): string => viewById.get(id)?.name ?? id;

  const actions = config.actions.map((def): ActionView => {
    const s = state.actions[def.id];
    if (!s) throw new Error(`Missing state for action ${def.id}`);
    const duration = engine.currentDurationMs(def.id);
    const unlocked = engine.isUnlocked(def.id);
    const reason = lockedReason(def, unlocked, buyableName, text);
    const speedText = `x${formatBigNum(factory.fromNumber(engine.currentSpeed(def.id)))}`;
    const durationText = formatSeconds(duration);
    const cost = startCostText(def, engine.startCostOf(def.id), text);
    const auto = engine.isAutoRun(def.id);
    const rewardText = formatBigNum(engine.payoutPerRun(def.id));
    const rewardUnit = text.rewardUnits[def.rewardKind ?? 'credits'];
    const rewardMultiplierText = formatBigNum(engine.rewardMultiplier(def.id));
    const heatPerRun = def.heatPerRun ?? 0;
    const xpText = formatBigNum(engine.actionXpIntoLevel(def.id));
    const nextLevelXpText = formatBigNum(engine.actionXpForLevel(def.id));
    const sleeveLevel = engine.sleeveLevel(def.id);
    const sleeveXpText = formatBigNum(engine.sleeveXpIntoLevel(def.id));
    const sleeveNextText = formatBigNum(engine.sleeveXpForLevel(def.id));
    const runsToNextXp = config.progression.runsPerSleeveXp - s.runsTowardSleeveXp;
    const level = engine.actionLevel(def.id);
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
      requiredAccessLevel: def.requiredAccessLevel ?? 1,
      lockedReason: reason,
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
      }),
      buyables: buyableViews.filter((b) => b.actionId === def.id),
      augment: augmentView(engine, def.id, text),
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
        row('income', text, `+${formatBigNum(engine.passiveCreditsPerSecond())}`),
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
