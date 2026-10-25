/**
 * @module core
 *
 * Helpers for working with {@link GameConfig}: deriving variants and validating values.
 */
import { traitsOf } from './effectTraits';
import { REWARD_KINDS, rewardOf } from './rewards';
import type {
  BuyableEffect,
  EngineConfig,
  GameConfig,
  GlobalTuning,
  LevelRuleConfig,
  LevelScaling,
  NetworkConfig,
  ProgressionConfig,
  RuntimeConfig,
  SleeveConfig,
  SpeedConfig,
} from './types';

/** Partial replacement of a configuration. Sections are merged field by field; lists replace the whole list. */
export interface ConfigOverrides {
  readonly actions?: GameConfig['actions'];
  readonly buyables?: GameConfig['buyables'];
  readonly items?: GameConfig['items'];
  readonly progression?: Partial<ProgressionConfig>;
  readonly speed?: Partial<SpeedConfig>;
  readonly global?: Partial<GlobalTuning>;
  readonly network?: Partial<NetworkConfig>;
  readonly sleeve?: Partial<SleeveConfig>;
  readonly engine?: Partial<EngineConfig>;
  readonly runtime?: Partial<RuntimeConfig>;
}

/**
 * Derives a configuration from `base` with some values replaced.
 *
 * Use it to try out progression tweaks (tests, experiments) without editing the base config.
 *
 * Called by: tests, `content/gameConfig.ts` consumers.
 *
 * @param base configuration to start from (not modified)
 * @param overrides values to replace
 * @returns a new configuration
 */
export function createConfig(base: GameConfig, overrides: ConfigOverrides = {}): GameConfig {
  return {
    actions: overrides.actions ?? base.actions,
    buyables: overrides.buyables ?? base.buyables,
    items: overrides.items ?? base.items,
    progression: { ...base.progression, ...overrides.progression },
    speed: { ...base.speed, ...overrides.speed },
    global: { ...base.global, ...overrides.global },
    network: { ...base.network, ...overrides.network },
    sleeve: { ...base.sleeve, ...overrides.sleeve },
    engine: { ...base.engine, ...overrides.engine },
    runtime: { ...base.runtime, ...overrides.runtime },
  };
}

const CURRENCIES: readonly string[] = ['credits', 'networkNodes', 'skillPoints'];

const positive = (v: number): boolean => Number.isFinite(v) && v > 0;
const positiveInt = (v: number): boolean => Number.isInteger(v) && v >= 1;

function checkLevelRule(where: string, rule: LevelRuleConfig, errors: string[]): void {
  if (!positive(rule.firstLevelXp)) errors.push(`${where}.firstLevelXp must be a number > 0`);
  if (!(Number.isFinite(rule.growthFactor) && rule.growthFactor > 1)) errors.push(`${where}.growthFactor must be a number > 1`);
}

function checkScaling(where: string, s: LevelScaling, errors: string[]): void {
  if (s.kind === 'linear') {
    if (!positive(s.perLevel)) errors.push(`${where}.perLevel must be a number > 0`);
  } else if (!(Number.isFinite(s.base) && s.base >= 1)) {
    errors.push(`${where}.base must be a number >= 1`);
  }
}

/** Checks the unlock rule, start cost and completion effects of one action. */
function checkActionRules(a: GameConfig['actions'][number], buyableIds: ReadonlySet<string>, errors: string[]): void {
  const where = `action "${a.id}"`;
  if (a.unlock?.kind === 'nodes' && !positive(a.unlock.amount)) errors.push(`${where}: unlock node count must be > 0`);
  if (a.unlock?.kind === 'buyable' && !buyableIds.has(a.unlock.buyableId)) {
    errors.push(`${where}: unlock refers to unknown buyable "${a.unlock.buyableId}"`);
  }
  if (a.startCost) {
    if (!CURRENCIES.includes(a.startCost.currency)) errors.push(`${where}: startCost has an unknown currency`);
    const { amount, fractionOfBalance } = a.startCost;
    if (amount === undefined && fractionOfBalance === undefined) errors.push(`${where}: startCost needs an amount or a fractionOfBalance`);
    if (amount !== undefined && (!amount.isFinite() || amount.isNegative())) errors.push(`${where}: startCost amount must be >= 0`);
    if (fractionOfBalance !== undefined && !(Number.isFinite(fractionOfBalance) && fractionOfBalance > 0 && fractionOfBalance <= 1)) {
      errors.push(`${where}: startCost fractionOfBalance must be between 0 and 1`);
    }
  }
  for (const e of a.completionEffects ?? []) {
    if (e.kind === 'removeNodesFraction' && !(Number.isFinite(e.fraction) && e.fraction >= 0 && e.fraction <= 1)) {
      errors.push(`${where}: removeNodesFraction must be between 0 and 1`);
    }
  }
}

/** What an effect validator may look at besides the effect itself. */
interface EffectContext {
  /** Prefix for messages, e.g. `buyable "x"`. */
  readonly where: string;
  readonly actionIds: ReadonlySet<string>;
  readonly itemIds: ReadonlySet<string>;
  readonly rarityIds: ReadonlySet<string>;
  readonly errors: string[];
}

const factorAtLeastOne = (e: { kind: string; factor: number }, { where, errors }: EffectContext): void => {
  if (!(Number.isFinite(e.factor) && e.factor >= 1)) errors.push(`${where}: ${e.kind} factor must be >= 1`);
};

/**
 * One validator per effect kind. The mapped type makes the compiler demand an entry for every kind of
 * {@link BuyableEffect}, so a new kind cannot be added without saying how it is validated.
 */
const EFFECT_CHECKS: { readonly [K in BuyableEffect['kind']]: (effect: Extract<BuyableEffect, { kind: K }>, ctx: EffectContext) => void } =
  {
    autoRun: () => {},
    unlock: () => {},
    rewardMultiplier: factorAtLeastOne,
    nodePayoutMultiplier: factorAtLeastOne,
    iceRatingMultiplier: factorAtLeastOne,
    interfaceSpeed: (e, { where, errors }) => {
      if (!(Number.isFinite(e.amount) && e.amount >= 0)) errors.push(`${where}: interface speed amount must be >= 0`);
    },
    accessLevel: (e, { where, errors }) => {
      if (!(Number.isInteger(e.amount) && e.amount >= 1)) errors.push(`${where}: access level amount must be an integer >= 1`);
    },
    networkGrowth: (e, { where, errors }) => {
      if (!(Number.isFinite(e.ratePerSecond) && e.ratePerSecond >= 0)) errors.push(`${where}: network growth rate must be >= 0`);
    },
    networkGrowthFromActionLevel: (e, { where, actionIds, errors }) => {
      if (!(Number.isFinite(e.percentPerLevel) && e.percentPerLevel >= 0))
        errors.push(`${where}: network growth percent per level must be >= 0`);
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: network growth refers to unknown action "${e.sourceActionId}"`);
    },
    interfaceSpeedPerLnNodes: (e, { where, errors }) => {
      if (!(Number.isFinite(e.perLn) && e.perLn >= 0)) errors.push(`${where}: perLn must be >= 0`);
    },
    levelBonusFromSleeveLevel: (e, { where, actionIds, errors }) => {
      for (const id of [e.sourceActionId, e.targetActionId]) {
        if (!actionIds.has(id)) errors.push(`${where}: level bonus refers to unknown action "${id}"`);
      }
    },
    sleeveXpReduction: (e, { where, actionIds, errors }) => {
      if (!actionIds.has(e.sourceActionId)) errors.push(`${where}: XP reduction refers to unknown action "${e.sourceActionId}"`);
      if (!(Number.isFinite(e.perLevel) && e.perLevel > 0)) errors.push(`${where}: XP reduction perLevel must be > 0`);
      if (!(Number.isFinite(e.maxReduction) && e.maxReduction >= 0 && e.maxReduction < 1)) {
        errors.push(`${where}: XP reduction maxReduction must be in [0, 1)`);
      }
    },
    interfaceSpeedMultiplier: factorAtLeastOne,
    heatCooldownSpeed: factorAtLeastOne,
    hackingProficiencyMultiplier: factorAtLeastOne,
    actionXpReduction: (e, { where, errors }) => {
      if (!(Number.isFinite(e.amount) && e.amount > 0 && e.amount < 1)) errors.push(`${where}: actionXpReduction amount must be in (0, 1)`);
    },
    itemDropChanceMultiplier: (e, ctx) => {
      factorAtLeastOne(e, ctx);
      if (!ctx.itemIds.has(e.itemId)) ctx.errors.push(`${ctx.where}: drop chance refers to unknown item "${e.itemId}"`);
    },
    nodePayoutFromItems: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.perItem) && e.perItem >= 0)) errors.push(`${where}: perItem must be >= 0`);
    },
    backChannel: (e, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(e.itemId)) errors.push(`${where}: refers to unknown item "${e.itemId}"`);
      if (!rarityIds.has(e.rarityId)) errors.push(`${where}: refers to unknown rarity "${e.rarityId}"`);
      if (!(Number.isFinite(e.molesPerItem) && e.molesPerItem > 0)) errors.push(`${where}: molesPerItem must be > 0`);
      if (!(Number.isFinite(e.cooldownBoost) && e.cooldownBoost >= 0)) errors.push(`${where}: cooldownBoost must be >= 0`);
    },
    rarityShiftFromProficiency: (e, { where, errors }) => {
      if (!(Number.isFinite(e.fractionPerOrder) && e.fractionPerOrder > 0 && e.fractionPerOrder <= 1)) {
        errors.push(`${where}: fractionPerOrder must be in (0, 1]`);
      }
    },
    itemDrop: ({ drop }, { where, itemIds, rarityIds, errors }) => {
      if (!itemIds.has(drop.itemId)) errors.push(`${where}: drop refers to unknown item "${drop.itemId}"`);
      if (!(Number.isFinite(drop.chance) && drop.chance >= 0 && drop.chance <= 1))
        errors.push(`${where}: drop chance must be between 0 and 1`);
      let total = 0;
      for (const [rarity, weight] of Object.entries(drop.rarityWeights)) {
        if (!rarityIds.has(rarity)) errors.push(`${where}: drop weights refer to unknown rarity "${rarity}"`);
        if (!(Number.isFinite(weight) && weight >= 0)) errors.push(`${where}: drop weight of "${rarity}" must be >= 0`);
        else total += weight;
      }
      if (!(total > 0)) errors.push(`${where}: at least one drop weight must be > 0`);
    },
  };

/** Validates the numbers and references of one buyable's effect. */
function checkEffect(b: GameConfig['buyables'][number], ctx: Omit<EffectContext, 'where'>): void {
  const check = EFFECT_CHECKS[b.effect.kind] as (effect: BuyableEffect, ctx: EffectContext) => void;
  check(b.effect, { ...ctx, where: `buyable "${b.id}"` });
}

/** Checks the item entity (unique ids, sell values) and returns the ids of the items and rarities. */
function checkItems(items: GameConfig['items'], errors: string[]): { itemIds: Set<string>; rarityIds: Set<string> } {
  const itemIds = new Set<string>();
  const rarityIds = new Set<string>();
  for (const item of items.definitions) {
    if (itemIds.has(item.id)) errors.push(`duplicate item id "${item.id}"`);
    itemIds.add(item.id);
  }
  for (const rarity of items.rarities) {
    if (rarityIds.has(rarity.id)) errors.push(`duplicate rarity id "${rarity.id}"`);
    rarityIds.add(rarity.id);
    if (!rarity.sellValue.isFinite() || rarity.sellValue.isNegative()) errors.push(`rarity "${rarity.id}": sellValue must be >= 0`);
  }
  if (items.definitions.length > 0 && items.rarities.length === 0) errors.push('items need at least one rarity');
  if (items.augment) {
    if (!itemIds.has(items.augment.itemId)) errors.push(`items.augment refers to unknown item "${items.augment.itemId}"`);
    if (!(Number.isFinite(items.augment.xpBonusPerItem) && items.augment.xpBonusPerItem > 0)) {
      errors.push('items.augment.xpBonusPerItem must be > 0');
    }
  }
  return { itemIds, rarityIds };
}

/**
 * Finds buyables that can never become available because their `requires` chain loops back on itself
 * (a self-requirement is reported separately by {@link validateConfig}).
 *
 * Called by: {@link validateConfig}.
 *
 * @param buyables all buyable definitions (unknown ids in `requires` are ignored here)
 * @returns one message per buyable that lies on a requirement cycle
 */
function findRequirementCycles(buyables: GameConfig['buyables']): string[] {
  const requires = new Map(buyables.map((b) => [b.id, (b.requires ?? []).filter((r) => r !== b.id)]));
  const reaches = (from: string, target: string, seen: Set<string>): boolean => {
    for (const next of requires.get(from) ?? []) {
      if (next === target) return true;
      if (!seen.has(next)) {
        seen.add(next);
        if (reaches(next, target, seen)) return true;
      }
    }
    return false;
  };
  return buyables
    .filter((b) => reaches(b.id, b.id, new Set()))
    .map((b) => `buyable "${b.id}": its requirements form a cycle, so it can never become available`);
}

/**
 * Checks a configuration for invalid or inconsistent values.
 *
 * Called by: `app/createGame.ts` (throws on any error), tests.
 *
 * @param config configuration to check
 * @returns human-readable problems; an empty list means the configuration is valid
 */
export function validateConfig(config: GameConfig): string[] {
  const errors: string[] = [];

  if (config.actions.length === 0) errors.push('actions must contain at least one action');
  const actionIds = new Set<string>();
  for (const a of config.actions) {
    if (actionIds.has(a.id)) errors.push(`duplicate action id "${a.id}"`);
    actionIds.add(a.id);
    if (!positive(a.baseDurationMs)) errors.push(`action "${a.id}": baseDurationMs must be > 0`);
    if (!a.reward.isFinite() || a.reward.isNegative()) errors.push(`action "${a.id}": reward must be >= 0`);
    if (!a.xpPerRun.isFinite() || a.xpPerRun.isNegative()) errors.push(`action "${a.id}": xpPerRun must be >= 0`);
    if (a.rewardPerNetworkNode && REWARD_KINDS.includes(a.rewardKind ?? 'credits') && !rewardOf(a.rewardKind).mayBePerNetworkNode) {
      errors.push(`action "${a.id}": a ${a.rewardKind} reward cannot be paid per network node (the network would compound on itself)`);
    }
    if (a.levels) checkLevelRule(`action "${a.id}".levels`, a.levels, errors);
    if (a.requiredAccessLevel !== undefined && !(Number.isInteger(a.requiredAccessLevel) && a.requiredAccessLevel >= 1)) {
      errors.push(`action "${a.id}": requiredAccessLevel must be an integer >= 1`);
    }
    if (a.heatPerRun !== undefined && !(Number.isFinite(a.heatPerRun) && a.heatPerRun >= 0)) {
      errors.push(`action "${a.id}": heatPerRun must be >= 0`);
    }
    if (a.sleeveLevels) checkLevelRule(`action "${a.id}".sleeveLevels`, a.sleeveLevels, errors);
    if (a.rewardKind !== undefined && !REWARD_KINDS.includes(a.rewardKind)) {
      errors.push(`action "${a.id}": unknown rewardKind`);
    }
    if (a.speedScaling) checkScaling(`action "${a.id}".speedScaling`, a.speedScaling, errors);
  }

  const buyableIds = new Set<string>();
  for (const b of config.buyables) {
    if (buyableIds.has(b.id)) errors.push(`duplicate buyable id "${b.id}"`);
    buyableIds.add(b.id);
  }
  for (const a of config.actions) checkActionRules(a, buyableIds, errors);
  const { itemIds, rarityIds } = checkItems(config.items, errors);
  for (const b of config.buyables) {
    if (!b.cost.isFinite() || b.cost.isNegative()) errors.push(`buyable "${b.id}": cost must be >= 0`);
    if (traitsOf(b).needsAction && b.actionId === undefined) errors.push(`buyable "${b.id}": ${b.effect.kind} needs an actionId`);
    if (b.actionId !== undefined && !actionIds.has(b.actionId)) errors.push(`buyable "${b.id}": belongs to unknown action "${b.actionId}"`);
    if (b.currency !== undefined && !CURRENCIES.includes(b.currency)) {
      errors.push(`buyable "${b.id}": unknown currency`);
    }
    checkEffect(b, { actionIds, itemIds, rarityIds, errors });
    for (const r of b.requires ?? []) {
      if (!buyableIds.has(r)) errors.push(`buyable "${b.id}": requires unknown buyable "${r}"`);
      if (r === b.id) errors.push(`buyable "${b.id}": cannot require itself`);
    }
    const max = b.maxPurchases ?? 1;
    if (!(Number.isInteger(max) && max >= 1) && max !== Infinity)
      errors.push(`buyable "${b.id}": maxPurchases must be an integer >= 1 or Infinity`);
    const growth = b.costGrowth ?? 1;
    if (!(Number.isFinite(growth) && growth >= 1)) errors.push(`buyable "${b.id}": costGrowth must be >= 1`);
  }
  errors.push(...findRequirementCycles(config.buyables));

  const p = config.progression;
  if (!positiveInt(p.runsPerSleeveXp)) errors.push('progression.runsPerSleeveXp must be an integer >= 1');
  if (!positive(p.sleeveXpPerGrant)) errors.push('progression.sleeveXpPerGrant must be > 0');
  if (!(Number.isFinite(p.startingCredits) && p.startingCredits >= 0)) errors.push('progression.startingCredits must be >= 0');
  if (!(Number.isFinite(p.maxSleeveXpReduction) && p.maxSleeveXpReduction >= 0 && p.maxSleeveXpReduction < 1)) {
    errors.push('progression.maxSleeveXpReduction must be in [0, 1)');
  }
  checkLevelRule('progression.actionLevels', p.actionLevels, errors);
  checkLevelRule('progression.sleeveLevels', p.sleeveLevels, errors);

  if (!(Number.isFinite(config.network.creditsPerNodePerSecond) && config.network.creditsPerNodePerSecond >= 0)) {
    errors.push('network.creditsPerNodePerSecond must be >= 0');
  }

  const sl = config.sleeve;
  if (!(Number.isInteger(sl.baseAccessLevel) && sl.baseAccessLevel >= 1)) errors.push('sleeve.baseAccessLevel must be an integer >= 1');
  if (!(Number.isFinite(sl.baseInterfaceSpeed) && sl.baseInterfaceSpeed > 0)) errors.push('sleeve.baseInterfaceSpeed must be > 0');
  if (!positive(sl.earnedSpeedScale)) errors.push('sleeve.earnedSpeedScale must be > 0');
  if (!(Number.isFinite(sl.earnedSpeedExponent) && sl.earnedSpeedExponent <= 1)) errors.push('sleeve.earnedSpeedExponent must be <= 1');
  if (!(Number.isFinite(sl.baseHeat) && sl.baseHeat >= 0)) errors.push('sleeve.baseHeat must be >= 0');
  if (!(Number.isFinite(sl.heatTaxPerPoint) && sl.heatTaxPerPoint >= 0)) errors.push('sleeve.heatTaxPerPoint must be >= 0');
  if (!positive(sl.heatCooldownMs)) errors.push('sleeve.heatCooldownMs must be > 0');
  if (!positive(sl.heatCooldownAmount)) errors.push('sleeve.heatCooldownAmount must be > 0');
  if (!(Number.isFinite(sl.baseIceRating) && sl.baseIceRating >= 1)) errors.push('sleeve.baseIceRating must be >= 1');
  if (!(Number.isFinite(sl.iceRatingReductionPerOrder) && sl.iceRatingReductionPerOrder >= 0)) {
    errors.push('sleeve.iceRatingReductionPerOrder must be >= 0');
  }
  if (!(Number.isFinite(sl.infamyHeatSlowdown) && sl.infamyHeatSlowdown >= 0)) errors.push('sleeve.infamyHeatSlowdown must be >= 0');
  if (!positive(sl.infamyDecayPeriodMs)) errors.push('sleeve.infamyDecayPeriodMs must be > 0');

  checkScaling('speed.actionLevel', config.speed.actionLevel, errors);
  checkScaling('speed.sleeveLevel', config.speed.sleeveLevel, errors);

  const g = config.global;
  for (const key of ['speedMultiplier', 'creditMultiplier', 'xpMultiplier', 'costMultiplier'] as const) {
    if (!positive(g[key])) errors.push(`global.${key} must be > 0`);
  }

  if (!positiveInt(config.engine.maxBatchesPerTick)) errors.push('engine.maxBatchesPerTick must be an integer >= 1');
  if (!positive(config.engine.maxSliceMs)) errors.push('engine.maxSliceMs must be > 0');
  if (!positiveInt(config.engine.maxSlicesPerTick)) errors.push('engine.maxSlicesPerTick must be an integer >= 1');
  if (!positive(config.engine.minRunDurationMs)) errors.push('engine.minRunDurationMs must be > 0');

  const r = config.runtime;
  for (const key of ['stepMs', 'renderMs', 'maxDeltaMs', 'autosaveMs'] as const) {
    if (!positive(r[key])) errors.push(`runtime.${key} must be > 0`);
  }
  if (!(Number.isFinite(r.fastForwardFactor) && r.fastForwardFactor > 1)) errors.push('runtime.fastForwardFactor must be > 1');

  return errors;
}
