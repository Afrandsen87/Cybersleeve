/**
 * @module core
 *
 * Helpers for working with {@link GameConfig}: deriving variants and validating values.
 */
import { definitionOf, type EffectContext } from './effectRegistry';
import { traitsOf } from './effectTraits';
import { REWARD_KINDS, rewardOf } from './rewards';
import type {
  EngineConfig,
  GameConfig,
  GlobalTuning,
  LevelRuleConfig,
  LevelScaling,
  AutomationConfig,
  NetworkConfig,
  RevealConfig,
  ProgressionConfig,
  ResleeveConfig,
  RuntimeConfig,
  SleeveConfig,
  SpeedConfig,
} from './types';

/** Partial replacement of a configuration. Sections are merged field by field; lists replace the whole list. */
export interface ConfigOverrides {
  readonly actions?: GameConfig['actions'];
  readonly buyables?: GameConfig['buyables'];
  readonly items?: GameConfig['items'];
  readonly criticalSuccess?: Partial<GameConfig['criticalSuccess']>;
  readonly focus?: Partial<GameConfig['focus']>;
  readonly resleeve?: Partial<ResleeveConfig>;
  readonly reveal?: Partial<RevealConfig>;
  readonly automation?: Partial<AutomationConfig>;
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
    criticalSuccess: { ...base.criticalSuccess, ...overrides.criticalSuccess },
    focus: { ...base.focus, ...overrides.focus },
    resleeve: { ...base.resleeve, ...overrides.resleeve },
    ...(base.automation || overrides.automation ? { automation: { autoBurnCeiling: 0, ...base.automation, ...overrides.automation } } : {}),
    ...(base.reveal || overrides.reveal ? { reveal: { buyableOrders: Infinity, ...base.reveal, ...overrides.reveal } } : {}),
    progression: { ...base.progression, ...overrides.progression },
    speed: { ...base.speed, ...overrides.speed },
    global: { ...base.global, ...overrides.global },
    network: { ...base.network, ...overrides.network },
    sleeve: { ...base.sleeve, ...overrides.sleeve },
    engine: { ...base.engine, ...overrides.engine },
    runtime: { ...base.runtime, ...overrides.runtime },
  };
}

const CURRENCIES: readonly string[] = ['credits', 'networkNodes', 'skillPoints', 'resleevePoints'];

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

/** Checks the start cost and completion effects of one action. */
function checkActionRules(a: GameConfig['actions'][number], errors: string[]): void {
  const where = `action "${a.id}"`;
  if (a.startCost) {
    if (!CURRENCIES.includes(a.startCost.currency)) errors.push(`${where}: startCost has an unknown currency`);
    const { amount, fractionOfBalance } = a.startCost;
    if (amount === undefined && fractionOfBalance === undefined) errors.push(`${where}: startCost needs an amount or a fractionOfBalance`);
    if (amount !== undefined && (!amount.isFinite() || amount.isNegative())) errors.push(`${where}: startCost amount must be >= 0`);
    if (fractionOfBalance !== undefined && !(Number.isFinite(fractionOfBalance) && fractionOfBalance > 0 && fractionOfBalance <= 1)) {
      errors.push(`${where}: startCost fractionOfBalance must be between 0 and 1`);
    }
  }
  if (a.criticalSuccess) checkCriticalRule(`${where}.criticalSuccess`, a.criticalSuccess, errors);
  if (a.overclock) checkOverclockRule(where, a.overclock, errors);
  checkCompletionEffects(where, a.completionEffects, errors);
}

/** Checks a list of completion effects (the numbers of each kind). */
function checkCompletionEffects(where: string, effects: GameConfig['actions'][number]['completionEffects'], errors: string[]): void {
  for (const e of effects ?? []) {
    if (e.kind === 'removeNodesFraction' && !(Number.isFinite(e.fraction) && e.fraction >= 0 && e.fraction <= 1)) {
      errors.push(`${where}: removeNodesFraction must be between 0 and 1`);
    }
    if (e.kind === 'removeNodes' && !(Number.isInteger(e.amount) && e.amount >= 1)) {
      errors.push(`${where}: removeNodes amount must be an integer >= 1`);
    }
  }
}

/** Checks the numbers of an action's Overclock rule: every field that is given must make sense, and at least one must be given. */
function checkOverclockRule(where: string, rule: NonNullable<GameConfig['actions'][number]['overclock']>, errors: string[]): void {
  const { speedBonus, rewardBonus, heatPerMinute, heatPerRunFactor, alsoPays, completionEffects, stopsHeatCooling } = rule;
  if (speedBonus !== undefined && !(Number.isFinite(speedBonus) && speedBonus > 0))
    errors.push(`${where}: overclock speedBonus must be > 0`);
  if (rewardBonus !== undefined && !(Number.isFinite(rewardBonus) && rewardBonus > 0))
    errors.push(`${where}: overclock rewardBonus must be > 0`);
  if (heatPerMinute !== undefined && !(Number.isFinite(heatPerMinute) && heatPerMinute >= 0)) {
    errors.push(`${where}: overclock heatPerMinute must be >= 0`);
  }
  if (heatPerRunFactor !== undefined && !(Number.isFinite(heatPerRunFactor) && heatPerRunFactor >= 1)) {
    errors.push(`${where}: overclock heatPerRunFactor must be >= 1`);
  }
  checkCompletionEffects(`${where} overclock`, completionEffects, errors);
  const anything =
    [speedBonus, rewardBonus, heatPerMinute, heatPerRunFactor, alsoPays].some((v) => v !== undefined) ||
    stopsHeatCooling === true ||
    (completionEffects?.length ?? 0) > 0;
  if (!anything) errors.push(`${where}: overclock needs at least one effect`);
}

/** Checks a (possibly partial) critical success rule: multipliers >= 1, completion effects in range. */
function checkCriticalRule(where: string, rule: Partial<GameConfig['criticalSuccess']>, errors: string[]): void {
  for (const key of ['xpMultiplier', 'rewardMultiplier'] as const) {
    const v = rule[key];
    if (v !== undefined && !(Number.isFinite(v) && v >= 1)) errors.push(`${where}.${key} must be a number >= 1`);
  }
  checkCompletionEffects(where, rule.completionEffects, errors);
}

/** Validates the numbers and references of one buyable's effect. */
function checkEffect(b: GameConfig['buyables'][number], ctx: Omit<EffectContext, 'where'>): void {
  definitionOf(b).validate(b.effect, { ...ctx, where: `buyable "${b.id}"` });
}

/** Checks the item entity (unique ids, sell values, what the items refer to) and returns the ids of the items and rarities. */
function checkItems(
  items: GameConfig['items'],
  actionIds: ReadonlySet<string>,
  errors: string[],
): { itemIds: Set<string>; rarityIds: Set<string>; raritylessItemIds: Set<string> } {
  const itemIds = new Set<string>();
  const rarityIds = new Set<string>();
  const raritylessItemIds = new Set<string>();
  for (const item of items.definitions) {
    if (itemIds.has(item.id)) errors.push(`duplicate item id "${item.id}"`);
    itemIds.add(item.id);
    if (item.hasRarity === false) raritylessItemIds.add(item.id);
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
  if (items.burnLead) {
    if (!itemIds.has(items.burnLead.itemId)) errors.push(`items.burnLead refers to unknown item "${items.burnLead.itemId}"`);
    if (!(Number.isFinite(items.burnLead.heatFraction) && items.burnLead.heatFraction > 0 && items.burnLead.heatFraction <= 1)) {
      errors.push('items.burnLead.heatFraction must be in (0, 1]');
    }
  }
  if (items.zeroDay) {
    if (!itemIds.has(items.zeroDay.itemId)) errors.push(`items.zeroDay refers to unknown item "${items.zeroDay.itemId}"`);
    if (!actionIds.has(items.zeroDay.actionId)) errors.push(`items.zeroDay refers to unknown action "${items.zeroDay.actionId}"`);
  }
  if (items.adminKey) {
    const { itemId, actionId, shard } = items.adminKey;
    if (!itemIds.has(itemId)) errors.push(`items.adminKey refers to unknown item "${itemId}"`);
    if (!actionIds.has(actionId)) errors.push(`items.adminKey refers to unknown action "${actionId}"`);
    if (shard) {
      if (!itemIds.has(shard.itemId)) errors.push(`items.adminKey.shard refers to unknown item "${shard.itemId}"`);
      if (!raritylessItemIds.has(shard.itemId)) errors.push('items.adminKey.shard must be an item without rarity');
      if (!(Number.isFinite(shard.chance) && shard.chance >= 0 && shard.chance <= 1))
        errors.push('items.adminKey.shard.chance must be between 0 and 1');
    }
  }
  if (items.skillShard) {
    if (!itemIds.has(items.skillShard.itemId)) errors.push(`items.skillShard refers to unknown item "${items.skillShard.itemId}"`);
    if (!positiveInt(items.skillShard.levelsDelayed)) errors.push('items.skillShard.levelsDelayed must be an integer >= 1');
  }
  return { itemIds, rarityIds, raritylessItemIds };
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
    if (a.heatPerSecond !== undefined && !(Number.isFinite(a.heatPerSecond) && a.heatPerSecond >= 0)) {
      errors.push(`action "${a.id}": heatPerSecond must be >= 0`);
    }
    if (a.sleeveLevels) checkLevelRule(`action "${a.id}".sleeveLevels`, a.sleeveLevels, errors);
    if (a.rewardKind !== undefined && !REWARD_KINDS.includes(a.rewardKind)) {
      errors.push(`action "${a.id}": unknown rewardKind`);
    }
    if (a.speedScaling) checkScaling(`action "${a.id}".speedScaling`, a.speedScaling, errors);
  }
  for (const a of config.actions) {
    const other = a.overclock?.alsoPays;
    if (other === undefined) continue;
    if (!actionIds.has(other)) errors.push(`action "${a.id}": overclock alsoPays refers to unknown action "${other}"`);
    else if (other === a.id) errors.push(`action "${a.id}": overclock alsoPays cannot be the action itself`);
  }

  const buyableIds = new Set<string>();
  for (const b of config.buyables) {
    if (buyableIds.has(b.id)) errors.push(`duplicate buyable id "${b.id}"`);
    buyableIds.add(b.id);
  }
  for (const a of config.actions) checkActionRules(a, errors);
  const { itemIds, rarityIds, raritylessItemIds } = checkItems(config.items, actionIds, errors);
  for (const b of config.buyables) {
    if (!b.cost.isFinite() || b.cost.isNegative()) errors.push(`buyable "${b.id}": cost must be >= 0`);
    if (traitsOf(b).needsAction && b.actionId === undefined) errors.push(`buyable "${b.id}": ${b.effect.kind} needs an actionId`);
    if (b.actionId !== undefined && !actionIds.has(b.actionId)) errors.push(`buyable "${b.id}": belongs to unknown action "${b.actionId}"`);
    if (b.currency !== undefined && !CURRENCIES.includes(b.currency)) {
      errors.push(`buyable "${b.id}": unknown currency`);
    }
    checkEffect(b, { actionIds, itemIds, rarityIds, raritylessItemIds, errors });
    if (b.effect.kind === 'overclockChain') {
      const action = config.actions.find((a) => a.id === b.actionId);
      if (!action?.overclock) errors.push(`buyable "${b.id}": overclockChain needs an action that has an overclock rule`);
      if (!action?.startCost)
        errors.push(`buyable "${b.id}": an overclock chain needs an action with a startCost (its runs come one per batch)`);
    }
    if (b.effect.kind === 'overclockUnlock' && !config.actions.find((a) => a.id === b.actionId)?.overclock) {
      errors.push(`buyable "${b.id}": overclockUnlock needs an action that has an overclock rule`);
    }
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

  checkCriticalRule('criticalSuccess', config.criticalSuccess, errors);
  for (const key of ['xpMultiplier', 'rewardMultiplier'] as const) {
    if (config.criticalSuccess[key] === undefined) errors.push(`criticalSuccess.${key} is required`);
  }

  if (config.automation && !(Number.isFinite(config.automation.autoBurnCeiling) && config.automation.autoBurnCeiling >= 0)) {
    errors.push('automation.autoBurnCeiling must be >= 0');
  }
  if (config.reveal && !(config.reveal.buyableOrders >= 0)) errors.push('reveal.buyableOrders must be >= 0 (Infinity shows everything)');
  if (!positive(config.focus.speedBonus)) errors.push('focus.speedBonus must be > 0');
  if (!positiveInt(config.focus.baseSlots)) errors.push('focus.baseSlots must be an integer >= 1');

  if (!positiveInt(config.resleeve.pointsPerResleeve)) errors.push('resleeve.pointsPerResleeve must be an integer >= 1');
  if (!positiveInt(config.resleeve.runsShown)) errors.push('resleeve.runsShown must be an integer >= 1');

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
  if (sl.earnedSpeedKnee !== undefined && !(Number.isFinite(sl.earnedSpeedKnee) && sl.earnedSpeedKnee >= 0)) {
    errors.push('sleeve.earnedSpeedKnee must be >= 0');
  }
  if (sl.earnedSpeedExponentBeyond !== undefined && !(Number.isFinite(sl.earnedSpeedExponentBeyond) && sl.earnedSpeedExponentBeyond <= 1)) {
    errors.push('sleeve.earnedSpeedExponentBeyond must be <= 1');
  }
  if (!(Number.isFinite(sl.baseHeat) && sl.baseHeat >= 0)) errors.push('sleeve.baseHeat must be >= 0');
  if (!(Number.isFinite(sl.heatTaxPerPoint) && sl.heatTaxPerPoint >= 0)) errors.push('sleeve.heatTaxPerPoint must be >= 0');
  if (!positive(sl.heatCooldownMs)) errors.push('sleeve.heatCooldownMs must be > 0');
  if (!positive(sl.heatCooldownAmount)) errors.push('sleeve.heatCooldownAmount must be > 0');
  if (!(Number.isFinite(sl.baseIceRating) && sl.baseIceRating >= 1)) errors.push('sleeve.baseIceRating must be >= 1');
  if (!(Number.isFinite(sl.iceRatingReductionPerOrder) && sl.iceRatingReductionPerOrder >= 0)) {
    errors.push('sleeve.iceRatingReductionPerOrder must be >= 0');
  }
  if (!(Number.isFinite(sl.legendHeatSpeedup) && sl.legendHeatSpeedup >= 0)) errors.push('sleeve.legendHeatSpeedup must be >= 0');
  if (!positive(sl.legendDecayPeriodMs)) errors.push('sleeve.legendDecayPeriodMs must be > 0');

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
