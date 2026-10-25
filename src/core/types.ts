/**
 * @module core
 *
 * Shared data shapes for the game: configuration, definitions and state.
 * Pure data, no behaviour, no DOM, no timers.
 *
 * @remarks
 * Everything that tunes progression lives in {@link GameConfig}. Definitions (static content)
 * are separate from state (what changes while playing), so content and tuning can change
 * without touching engine code (open/closed).
 */
import type { BigNum } from '../numbers';

/** Identifier of an action (e.g. `"practice-hacking"`). Never shown to the player. */
export type ActionId = string;
/** Identifier of a buyable (e.g. `"auto-run"`). Never shown to the player. */
export type BuyableId = string;

/**
 * How experience maps to levels.
 *
 * @remarks
 * Levels start at 0. Every level costs its own full amount of XP: leaving level 0 costs `firstLevelXp`, and each further level costs
 * `growthFactor` times the one before: `cost(leaving level n) = firstLevelXp * growthFactor^n`. The XP gathered inside a level
 * starts from 0 again after each level-up. With the defaults (10 and 10): 10 XP for level 1, then 100 more for level 2,
 * then 1000 more for level 3, and so on (110 and 1110 XP in total).
 */
export interface LevelRuleConfig {
  /** XP the first level costs, i.e. what it takes to reach level 1 (> 0). */
  readonly firstLevelXp: number;
  /** Ratio between the costs of consecutive levels (> 1). */
  readonly growthFactor: number;
}

/**
 * How much a level is worth as a multiplier.
 *
 * - `linear`: `1 + level * perLevel` (levels start at 0, so level 0 is worth exactly 1).
 * - `exponential`: `base ^ level`.
 */
export type LevelScaling = { readonly kind: 'linear'; readonly perLevel: number } | { readonly kind: 'exponential'; readonly base: number };

/**
 * What a completed run pays out: `credits` go to the credit balance, `networkNodes` grow the network,
 * `hackingProficiency` adds to Hacking Proficiency, which raises the hacking multiplier on the sleeve's interface speed (until the next re-sleeve), `iceRating` adds to
 * the ICE Rating stat (which lowers the heat tax), `infamy` adds to Infamy (which slows heat cooldown) and `nodePayout`
 * adds to the base value of what every network node produces (credits per second, before the Node payout multiplier). Network nodes are always whole numbers: a `networkNodes`
 * reward is rounded down per run.
 */
export type RewardKind = 'credits' | 'networkNodes' | 'hackingProficiency' | 'iceRating' | 'infamy' | 'nodePayout';

/** Something that happens each time an action completes a run, besides its reward. */
export type CompletionEffect =
  | { readonly kind: 'removeNodesFraction'; readonly fraction: number }
  /** Removes this many network nodes (a whole number >= 1) for each run; the network never goes below 0. */
  | { readonly kind: 'removeNodes'; readonly amount: number };

/**
 * A price paid every time a run starts (manually or by auto-run). It is `amount` plus `fractionOfBalance` of the balance held
 * at that moment (network nodes: rounded down to whole nodes). A fraction-based cost that comes to 0 cannot be paid, so
 * the run cannot start: with 1% of nodes you need at least 100 nodes.
 */
export interface StartCost {
  /** What is paid. */
  readonly currency: Currency;
  /** A fixed amount per run (>= 0). Default: 0. */
  readonly amount?: BigNum;
  /** The share (0..1) of the current balance paid per run. Default: none. */
  readonly fractionOfBalance?: number;
}

/** Identifier of an item kind (e.g. `"kompromat"`). Never shown to the player. */
export type ItemId = string;
/** Identifier of a rarity (e.g. `"rare"`). Never shown to the player. */
export type RarityId = string;

/** One rarity tier of items. The order of {@link ItemsConfig.rarities} is the order from most to least common. */
export interface RarityDefinition {
  readonly id: RarityId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Credits one item of this rarity sells for (>= 0). */
  readonly sellValue: BigNum;
}

/** Static description of a kind of item that actions can drop. It exists in every rarity. */
export interface ItemDefinition {
  readonly id: ItemId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Items of this kind can be paid out for credits from the Inventory. Default: true. */
  readonly sellable?: boolean;
  /**
   * False for an item without rarity: it is one stack, shown under its own name, and a drop rule for it names no rarity weights.
   * Internally the stack is kept under the first (most common) rarity. Default: true (the item exists in every rarity).
   */
  readonly hasRarity?: boolean;
}

/** What the Augment schematic item does when it is applied to an action. */
export interface AugmentConfig {
  /** The item that is the schematic. */
  readonly itemId: ItemId;
  /**
   * What one schematic adds to the action XP boost of ITS rarity, additively (0.01 = 1 percent; > 0). The boosts of the different
   * rarities multiply each other (3 common, 3 uncommon and 3 rare give 1.03 x 1.03 x 1.03).
   */
  readonly xpBonusPerItem: number;
}

/** What the Burn lead item does when it is used from the Inventory. */
export interface BurnLeadConfig {
  /** The item that is the lead. */
  readonly itemId: ItemId;
  /** The share of the CURRENT heat one lead removes (0.05 = 5 percent; in (0, 1]). Using it uses the lead up. */
  readonly heatFraction: number;
}

/** The item entity: which kinds exist and which rarity tiers they come in. */
export interface ItemsConfig {
  /** Which item can be applied to an action to raise its XP gain. Default: none (no Augment button). */
  readonly augment?: AugmentConfig;
  /** Which item can be used from the Inventory to take heat away. Default: none (no Use button). */
  readonly burnLead?: BurnLeadConfig;
  /** Rarity tiers, most common first. */
  readonly rarities: readonly RarityDefinition[];
  /** The kinds of item. */
  readonly definitions: readonly ItemDefinition[];
}

/**
 * Items an action drops when a run completes (the result of an `itemDrop` buyable).
 *
 * @remarks
 * Each completed run has `chance` to drop one item; the item's rarity is then drawn by `rarityWeights`. An item without rarity
 * (`ItemDefinition.hasRarity: false`) has no weights: every drop is its single stack.
 */
export interface ItemDropRule {
  readonly itemId: ItemId;
  /** Chance (0..1) that one completed run drops an item at all. */
  readonly chance: number;
  /** Relative weight per rarity id (>= 0, at least one > 0). Weights are normalised, so `{ common: 90, uncommon: 10 }` means 90% / 10%. A missing rarity weighs 0. */
  readonly rarityWeights?: Readonly<Record<RarityId, number>>;
}

/**
 * What a critical success does to one completed run.
 *
 * @remarks
 * A critical run is an ordinary run that was drawn as critical (chance from the sleeve's `criticalChance` buyables). The default
 * rule is `GameConfig.criticalSuccess`; an action can replace single fields of it with `ActionDefinition.criticalSuccess`, which is
 * where an action's own critical behaviour goes. The multipliers scale only what their name says, for the critical runs only.
 */
export interface CriticalSuccessRule {
  /** Multiplies the action XP of a critical run (>= 1). Sleeve XP and the run counter are not touched. */
  readonly xpMultiplier: number;
  /** Multiplies the reward the action pays for a critical run, whatever its kind (>= 1). Heat and completion effects are not scaled. */
  readonly rewardMultiplier: number;
  /** Extra effects applied once for each critical run, after the ordinary completion effects. Default: none. */
  readonly completionEffects?: readonly CompletionEffect[];
}

/**
 * What Overclock does to ONE action while it is switched on (the toggle exists on every action that has a rule, once the Overclock
 * buyable is owned). Each action's rule is its own, so Overclock can do something different for each. A rule lists any mix of the
 * fields below and needs at least one.
 *
 * @remarks
 * The two bonuses (`speedBonus`, `rewardBonus`) are the gain and grow with the strength of Overclock (more copies of the buyable). The
 * rest (heat, node costs, the extra payment) are fixed by the rule: more copies make the gain stronger, never the price.
 */
export interface OverclockRule {
  /** The action runs this much faster at Overclock strength 1 (0.5 = 50 percent faster; > 0). Default: no speed change. */
  readonly speedBonus?: number;
  /** The reward the action pays per run is this much bigger at strength 1 (2 = 200 percent more, i.e. x3; > 0). Scales that reward only. Default: none. */
  readonly rewardBonus?: number;
  /** Heat the action adds per minute of game time while it is running overclocked (>= 0). Fractions of a point of heat are kept. Default: 0. */
  readonly heatPerMinute?: number;
  /** The heat each completed run adds (`heatPerRun`) is multiplied by this (>= 1; 3 = three times as much). Default: 1. */
  readonly heatPerRunFactor?: number;
  /** Applied once for each completed run while Overclock is on, after the ordinary completion effects. Default: none. */
  readonly completionEffects?: readonly CompletionEffect[];
  /** Each completed run also pays the reward of this other action, as if that action had completed one run (its own reward multipliers apply). Default: none. */
  readonly alsoPays?: ActionId;
}

/** Static description of an action the character can perform. */
export interface ActionDefinition {
  readonly id: ActionId;
  /** Display name (placeholder, may be renamed freely). */
  readonly name: string;
  /** Duration of one run at speed multiplier 1, in milliseconds. */
  readonly baseDurationMs: number;
  /** Amount paid per completed run, in units of `rewardKind` (before reward multipliers). */
  readonly reward: BigNum;
  /** What `reward` is paid as. Default: `'credits'`. */
  readonly rewardKind?: RewardKind;
  /** When true, `reward` is paid once per network node owned (so the payout is `reward * nodes`). Default: false. */
  readonly rewardPerNetworkNode?: boolean;
  /** Heat added to the sleeve by each completed run (>= 0). Default: 0. */
  readonly heatPerRun?: number;
  /** Access level the sleeve needs before this action can be performed (integer >= 1). Default: 1. */
  readonly requiredAccessLevel?: number;
  /** Paid each time a run starts; without enough of the currency the run cannot start. Such actions complete one run per batch. */
  readonly startCost?: StartCost;
  /** Applied after each completed run (in order). */
  readonly completionEffects?: readonly CompletionEffect[];
  /** Action experience gained per completed run (reward multipliers do not change it). */
  readonly xpPerRun: BigNum;
  /** Overrides `progression.actionLevels` for this action. */
  readonly levels?: LevelRuleConfig;
  /** Overrides `progression.sleeveLevels` for this action's sleeve level. */
  readonly sleeveLevels?: LevelRuleConfig;
  /** Overrides `speed.actionLevel` for this action. */
  readonly speedScaling?: LevelScaling;
  /** Replaces single fields of `GameConfig.criticalSuccess` for this action's critical runs. Default: the global rule applies unchanged. */
  readonly criticalSuccess?: Partial<CriticalSuccessRule>;
  /** What Overclock does to this action. Default: none, so the action has no Overclock toggle. */
  readonly overclock?: OverclockRule;
}

/**
 * What a purchase does. Add a new `kind` here and in `effects.ts` to add a new effect type.
 * An effect applies once per copy owned (see `BuyableDefinition.maxPurchases`).
 *
 * - Action effects (`autoRun`, `rewardMultiplier`, `itemDrop`, `rarityShiftFromProficiency`) change the action the buyable belongs to. `rewardMultiplier` scales that action's own
 *   reward per run and nothing else: not its XP, not the runs counted towards sleeve XP, not its heat or completion effects.
 * - Sleeve effects (`interfaceSpeed`, `accessLevel`, `networkGrowth`, `networkGrowthFromActionLevel`, `interfaceSpeedPerLnNodes`, `sleeveXpReduction`) change the
 *   game as a whole; the buyable may still belong to an action, which only decides on which card it is shown.
 * - `levelBonusFromSleeveLevel` links two actions: it adds one action's sleeve level to another action's level for speed.
 */
export type BuyableEffect =
  | { readonly kind: 'autoRun' }
  /** Unlocks the Overclock toggle of the buyable's action (the action must have an `overclock` rule). Applies once, whatever the number of copies. */
  | { readonly kind: 'overclockUnlock' }
  /** Unlocks the Focus toggle of the buyable's action. Applies once, whatever the number of copies. */
  | { readonly kind: 'focusUnlock' }
  /**
   * Makes every Overclock stronger: strength is `1 + perCopy` per copy owned (0.1 = the gains of every action's Overclock, the speed
   * and reward bonuses, are 10 percent of their base bigger per copy). The costs of an Overclock do not scale.
   */
  | { readonly kind: 'overclockStrength'; readonly perCopy: number }
  /** Each copy owned adds `perCopy` Focus slots (a whole number >= 1) on top of `focus.baseSlots`: that many actions can be focused at once. */
  | { readonly kind: 'focusSlots'; readonly perCopy: number }
  /** Every completed run of any action has `chance` (0..1) per copy owned to be a critical success (see {@link CriticalSuccessRule}); the total is capped at 1. */
  | { readonly kind: 'criticalChance'; readonly chance: number }
  | { readonly kind: 'rewardMultiplier'; readonly factor: number }
  | { readonly kind: 'interfaceSpeed'; readonly amount: number }
  /** Raises the access level by `amount` per copy (an integer >= 1), on top of `sleeve.baseAccessLevel`. */
  | { readonly kind: 'accessLevel'; readonly amount: number }
  /** Multiplies the credits each network node produces by this factor per copy. */
  | { readonly kind: 'nodePayoutMultiplier'; readonly factor: number }
  /** Multiplies the ICE Rating stat by this factor per copy. */
  | { readonly kind: 'iceRatingMultiplier'; readonly factor: number }
  /**
   * Adds `perLevel` per copy owned and per plain action level of `sourceActionId` to the BASE ICE Rating, that is, before the
   * `iceRatingMultiplier` buyables multiply it (so it does not matter in which order they are bought).
   */
  | { readonly kind: 'iceRatingFromActionLevel'; readonly sourceActionId: ActionId; readonly perLevel: number }
  /** Network nodes grow by this fraction of themselves per second (0.000001 = 0.0001 percent), compounding; only whole nodes are added, the rest is carried. */
  | { readonly kind: 'networkGrowth'; readonly ratePerSecond: number }
  /**
   * Network nodes grow by `level * percentPerLevel` percent of themselves per second, where `level` is the (plain) action level of
   * `sourceActionId`, per copy owned. E.g. `percentPerLevel: 0.001` at level 50 gives 0.05 percent per second. Same compounding and
   * whole-node rules as `networkGrowth`.
   */
  | { readonly kind: 'networkGrowthFromActionLevel'; readonly sourceActionId: ActionId; readonly percentPerLevel: number }
  /** Multiplies the base interface speed by `1 + perLn * ln(nodes)` (never below 1), before the hacking multiplier. */
  | { readonly kind: 'interfaceSpeedPerLnNodes'; readonly perLn: number }
  /** Adds the sleeve level of `sourceActionId` to the level of `targetActionId` when computing speed (not its XP progress). */
  | { readonly kind: 'levelBonusFromSleeveLevel'; readonly sourceActionId: ActionId; readonly targetActionId: ActionId }
  /**
   * Lowers the XP needed for every sleeve level of every OTHER action by `min(maxReduction, perLevel * sleeve level of
   * sourceActionId)`, as a fraction (0.25 = 25 percent less XP). The source action itself is not affected.
   */
  | { readonly kind: 'sleeveXpReduction'; readonly sourceActionId: ActionId; readonly perLevel: number; readonly maxReduction: number }
  /** Completed runs of the buyable's action may drop an item, as described by `drop`. Applies once, whatever the number of copies. */
  | { readonly kind: 'itemDrop'; readonly drop: ItemDropRule }
  /**
   * Hacking Proficiency shifts the drop ratios of the buyable's action towards the rarer rarities: for every whole order of
   * magnitude of proficiency (`floor(log10)`, none below 10) `fractionPerOrder` of each rarity's weight moves to the next rarity.
   * The amounts are worked out up front for all rarities and moved at once (see `shiftWeights`). Applies once, whatever the number of copies.
   */
  | { readonly kind: 'rarityShiftFromProficiency'; readonly fractionPerOrder: number }
  /** Multiplies the interface speed by `factor` per copy (after the hacking multiplier). */
  | { readonly kind: 'interfaceSpeedMultiplier'; readonly factor: number }
  /** Heat cools down `factor` times as fast per copy (shorter cooldown cycles). */
  | { readonly kind: 'heatCooldownSpeed'; readonly factor: number }
  /** Hacking Proficiency counts `factor` times as much per copy wherever it is used (hacking multiplier, drop ratio shifts). */
  | { readonly kind: 'hackingProficiencyMultiplier'; readonly factor: number }
  /** Every ACTION level needs `amount` (a fraction, 0.01 = 1 percent) less XP per copy. Sleeve levels are not affected. */
  | { readonly kind: 'actionXpReduction'; readonly amount: number }
  /**
   * Every copy owned lowers the number of completed runs an action needs per batch of sleeve XP (`progression.runsPerSleeveXp`) by
   * `perCopy` runs (an integer >= 1), but never below `minRuns` (an integer >= 1). Applies to every action.
   */
  | { readonly kind: 'runsPerSleeveXpReduction'; readonly perCopy: number; readonly minRuns: number }
  /** Multiplies the drop chance (the chance of a drop at all) of every drop rule of `itemId` by `factor` per copy; the result never exceeds 1. */
  | { readonly kind: 'itemDropChanceMultiplier'; readonly itemId: ItemId; readonly factor: number }
  /** Node payout is multiplied by `1 + perItem x` the number of `itemId` items of `rarityId` held, per copy. */
  | { readonly kind: 'nodePayoutFromItems'; readonly itemId: ItemId; readonly rarityId: RarityId; readonly perItem: number }
  /**
   * Lets the player give up items of `itemId` / `rarityId` for Moles: `molesPerItem` Moles each. While Moles remain, heat cools
   * `cooldownBoost` (0.5 = 50 percent) faster, and every point of heat cooled uses up one Mole.
   */
  | {
      readonly kind: 'backChannel';
      readonly itemId: ItemId;
      readonly rarityId: RarityId;
      readonly molesPerItem: number;
      readonly cooldownBoost: number;
    };

/**
 * What a buyable is paid with. `skillPoints` are not held: the points available are what the action levels have earned minus what the
 * owned skills cost (see `skills.ts`), so paying them spends nothing from the state.
 */
export type Currency = 'credits' | 'networkNodes' | 'skillPoints';

/** Static description of a purchase (one-time or repeatable). It is shown on its action's card, or in the Sleeve widget when it has no action. */
export interface BuyableDefinition {
  readonly id: BuyableId;
  /** The action whose card shows this purchase (and whose behaviour an action effect changes). Absent: shown in the Sleeve widget. */
  readonly actionId?: ActionId;
  readonly name: string;
  /** What the purchase does, in a sentence (shown in the hover tooltip). */
  readonly description: string;
  /** A formula that explains the effect, shown under the description in the tooltip (e.g. `"Growth factor percentage = Action level / 1000"`). */
  readonly formula?: string;
  /** Short text shown on the purchase's square button (default: initials of `name`). */
  readonly symbol?: string;
  /** Price of the first copy, in `currency` (before `global.costMultiplier`). */
  readonly cost: BigNum;
  /** What the price is paid in. Default: credits. Paying in network nodes removes those nodes. */
  readonly currency?: Currency;
  readonly effect: BuyableEffect;
  /** Buyables that must be owned before this one becomes available. Default: none. */
  readonly requires?: readonly BuyableId[];
  /** How many copies can be bought; `Infinity` for unlimited. Default: 1. */
  readonly maxPurchases?: number;
  /** Price multiplier per copy already owned (>= 1). Default: 1 (constant price). */
  readonly costGrowth?: number;
}

/** Tuning of experience, levels and sleeve experience. */
export interface ProgressionConfig {
  /** Completed runs of one action that grant it one batch of sleeve XP (integer >= 1). */
  readonly runsPerSleeveXp: number;
  /** Sleeve XP granted per batch of `runsPerSleeveXp` runs (> 0). */
  readonly sleeveXpPerGrant: number;
  /** Default level rule for every action (an action may override it). */
  readonly actionLevels: LevelRuleConfig;
  /** Default level rule of every action's sleeve level (an action may override it). */
  readonly sleeveLevels: LevelRuleConfig;
  /** Credits at the start of a game and after a re-sleeve (>= 0). */
  readonly startingCredits: number;
  /** The most that all sleeve-XP reduction buyables together can cut a sleeve level's XP requirement (a fraction in [0, 1); 0.99 = 99%). */
  readonly maxSleeveXpReduction: number;
}

/** How levels translate into speed. */
export interface SpeedConfig {
  /** Default action-level scaling (an action may override it). */
  readonly actionLevel: LevelScaling;
  /** Sleeve-level scaling. */
  readonly sleeveLevel: LevelScaling;
}

/** Broad levers that scale everything at once, for quick progression tuning. All must be > 0; 1 = no change. */
export interface GlobalTuning {
  /** Multiplies the speed of every action. */
  readonly speedMultiplier: number;
  /** Multiplies the credits earned: run rewards paid in credits and passive network income. No other reward kind is affected. */
  readonly creditMultiplier: number;
  /** Multiplies every XP gain (action XP; sleeve XP follows from runs). */
  readonly xpMultiplier: number;
  /** Multiplies every buyable price. */
  readonly costMultiplier: number;
}

/** Starting values of the global sleeve stats, before any purchase. */
export interface SleeveConfig {
  /** Access level of a new sleeve (integer >= 1). */
  readonly baseAccessLevel: number;
  /** Interface speed of a new sleeve: a plain multiplier on the speed of every action (> 0; 1 = no change). */
  readonly baseInterfaceSpeed: number;
  /** Slope at 0 of the curve that turns the interface speed earned by actions into the bonus applied (> 0; 1 = first runs count in full). */
  readonly earnedSpeedScale: number;
  /** Shape of that curve (<= 1): 1 = straight line, 0 = logarithm, in between = diminishing returns without a ceiling. */
  readonly earnedSpeedExponent: number;
  /** Hacking Proficiency at which the curve changes shape (>= 0). Default: 1. Only matters with `earnedSpeedExponentBeyond`. */
  readonly earnedSpeedKnee?: number;
  /**
   * The shape of the curve past `earnedSpeedKnee` (<= 1, same meaning as `earnedSpeedExponent`). It continues from the value and the
   * slope the curve has at the knee; below `earnedSpeedExponent` it flattens the curve there. Default: the same as `earnedSpeedExponent`
   * (one curve all the way).
   */
  readonly earnedSpeedExponentBeyond?: number;
  /** Heat of a new sleeve (>= 0). */
  readonly baseHeat: number;
  /** Share of the credits network nodes produce that one point of heat takes (0.01 = 1%; >= 0). ICE Rating lowers the effect. */
  readonly heatTaxPerPoint: number;
  /** Time one heat cooldown cycle takes, in ms (> 0). Heat only cools while it is above 0. */
  readonly heatCooldownMs: number;
  /** Heat removed each time a cooldown cycle completes (> 0). */
  readonly heatCooldownAmount: number;
  /** ICE Rating of a new sleeve (>= 1). The stat is multiplied by buyables and raised by actions. */
  readonly baseIceRating: number;
  /** Share of the heat tax removed per order of magnitude of ICE Rating (0.005 = 0.5%; 100% is reached at 1e200). */
  readonly iceRatingReductionPerOrder: number;
  /** Each point of Infamy makes a heat cooldown cycle this much longer (0.1 = 10% slower per point; >= 0). */
  readonly infamyHeatSlowdown: number;
  /** Infamy falls by exactly 1 each time this many ms have passed (a cycle, like the heat cooldown; > 0). */
  readonly infamyDecayPeriodMs: number;
}

/** The passive-income network built by actions paying `networkNodes`. */
export interface NetworkConfig {
  /** Credits each network node produces per second of game time (>= 0). */
  readonly creditsPerNodePerSecond: number;
}

/** Technical limits of the engine. */
export interface EngineConfig {
  /**
   * Safety cap on run batches processed per action per tick (integer >= 1). Runs are computed in closed form: a batch is
   * the stretch of runs between two level changes, so normal play needs only a handful of batches per tick.
   * Time beyond the cap is discarded.
   */
  readonly maxBatchesPerTick: number;
  /**
   * Longest stretch of game time simulated in one go, in ms (> 0). A longer tick is cut into equal slices of at most this
   * length and the slices run one after another, so effects that feed back on themselves (interface speed growing
   * with every run, heat cooling while the network pays, ...) follow the same course however the time is delivered.
   * A normal 50 ms step is one slice.
   */
  readonly maxSliceMs: number;
  /**
   * Most slices one tick is cut into (integer >= 1). Bounds the cost of a very long tick; beyond it the slices simply
   * get longer (and the feedback effects above become approximate again).
   */
  readonly maxSlicesPerTick: number;
  /**
   * Shortest time one run can take, in ms (> 0). However fast an action gets, its run never takes less, so a speed that
   * overflows cannot turn a duration into 0 (and the batch maths into NaN).
   */
  readonly minRunDurationMs: number;
}

/** Timing and test-aid settings used by the browser shell. */
export interface RuntimeConfig {
  /** Interval between game steps, in ms (> 0). */
  readonly stepMs: number;
  /** Shortest interval between screen refreshes, in ms (> 0). The game itself still steps every `stepMs`. */
  readonly renderMs: number;
  /** Largest real-time gap simulated in one step, in ms (> 0). Longer gaps are not simulated (no offline progress yet). */
  readonly maxDeltaMs: number;
  /** Interval between autosaves, in ms (> 0). */
  readonly autosaveMs: number;
  /** Time multiplier of the fast-forward test toggle (> 1). */
  readonly fastForwardFactor: number;
}

/** What Focus does, for every action that has unlocked it. */
export interface FocusConfig {
  /** A focused action runs this much faster (0.25 = 25 percent; > 0). */
  readonly speedBonus: number;
  /** Actions that can be focused at once before any Focus slot is bought (a whole number >= 1). */
  readonly baseSlots: number;
}

/** Everything the game needs that is not state: content plus every tuning constant. */
export interface GameConfig {
  readonly actions: readonly ActionDefinition[];
  readonly buyables: readonly BuyableDefinition[];
  /** The item entity: kinds and rarity tiers (with their sell values). */
  readonly items: ItemsConfig;
  /** What a critical success does unless the action says otherwise. */
  readonly criticalSuccess: CriticalSuccessRule;
  /** What Focus does and how many actions can be focused at once at the start. */
  readonly focus: FocusConfig;
  readonly progression: ProgressionConfig;
  readonly speed: SpeedConfig;
  readonly global: GlobalTuning;
  readonly network: NetworkConfig;
  readonly sleeve: SleeveConfig;
  readonly engine: EngineConfig;
  readonly runtime: RuntimeConfig;
}

/** Mutable per-action progress. */
export interface ActionState {
  /** Total action experience since the last re-sleeve. */
  xp: BigNum;
  /** Total sleeve experience of this action. Survives re-sleeving. */
  sleeveXp: BigNum;
  /** Completed runs of this action since its last sleeve-XP batch (0..runsPerSleeveXp-1). Survives re-sleeving. */
  runsTowardSleeveXp: number;
  /** Augment schematics applied to this action, per rarity id: each raises the action XP its runs give (see `items.augment`). Reset by re-sleeving. */
  augments: Record<RarityId, number>;
  /** True while the progress bar is filling. */
  running: boolean;
  /** The share of the current run that is done: from 0 up to (not including) 1 (0 when idle). A change of speed does not change it. */
  progress: number;
}

/** Complete mutable game state. Serialised by `serialization.ts`. */
export interface GameState {
  credits: BigNum;
  /** Network nodes built so far; each produces passive credits. Reset by re-sleeving. */
  network: BigNum;
  /**
   * Current heat: starts at `sleeve.baseHeat`, raised by actions, lowered by the cooldown and by Burn leads. Reset by re-sleeving.
   * It may hold fractions of a point (Overclock adds heat continuously), but the cooldown only ever removes whole points: it waits
   * until there is at least one.
   */
  heat: number;
  /** Time spent on the current heat cooldown cycle, in ms. Only advances while heat > 0. Reset by re-sleeving. */
  heatCooldownMs: number;
  /** ICE Rating earned so far, starting at `sleeve.baseIceRating`; buyable multipliers come on top. Reset by re-sleeving. */
  iceRating: BigNum;
  /** Infamy: slows heat cooldown, decays over time. Reset by re-sleeving. */
  infamy: number;
  /** Time spent on the current Infamy decay cycle, in ms. Only advances while Infamy > 0. Reset by re-sleeving. */
  infamyCooldownMs: number;
  /** Moles: points of heat that still cool down faster, bought by giving up items (Back Channel Deals). Reset by re-sleeving. */
  moles: number;
  /** Fraction of a node (0..1) the network has grown by itself but not yet completed; carried between ticks. Reset by re-sleeving. */
  networkRemainder: number;
  /** Gained from actions paying `nodePayout`: credits per second added to the BASE value of what each node produces (`network.creditsPerNodePerSecond + this`; buyables multiply the sum). Reset by re-sleeving. */
  nodePayoutBonus: BigNum;
  /** Auto-run buyables the player has switched off (absent or false: running). Reset by re-sleeving. */
  autoRunOff: Record<BuyableId, boolean>;
  /** Actions whose Overclock toggle is switched on (absent or false: off). Reset by re-sleeving. */
  overclocked: Record<ActionId, boolean>;
  /** Actions that are focused (absent or false: not); at most as many as there are Focus slots. Reset by re-sleeving. */
  focused: Record<ActionId, boolean>;
  /** Hacking Proficiency: gained from actions paying `hackingProficiency`; the hacking multiplier on interface speed is a concave function of it. Reset by re-sleeving. */
  hackingProficiency: BigNum;
  actions: Record<ActionId, ActionState>;
  /** Copies owned per buyable id. Absent means 0. */
  purchased: Record<BuyableId, number>;
  /** Items held: whole counts per item id and rarity id (absent means 0). Reset by re-sleeving. */
  inventory: Record<ItemId, Record<RarityId, number>>;
}

/** `T` with every property read-only, recursively. `BigNum` values are immutable already and stay as they are. */
export type DeepReadonly<T> = T extends BigNum ? T : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/**
 * Read-only view of {@link GameState}, handed out by the engine so callers cannot mutate it.
 * Derived from `GameState`, so a new field never has to be added twice.
 */
export type GameStateView = DeepReadonly<GameState>;
