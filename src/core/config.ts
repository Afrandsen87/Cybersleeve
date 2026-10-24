/**
 * @module core
 *
 * Helpers for working with {@link GameConfig}: deriving variants and validating values.
 */
import { ACTION_EFFECT_KINDS } from './types';
import type {
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
    progression: { ...base.progression, ...overrides.progression },
    speed: { ...base.speed, ...overrides.speed },
    global: { ...base.global, ...overrides.global },
    network: { ...base.network, ...overrides.network },
    sleeve: { ...base.sleeve, ...overrides.sleeve },
    engine: { ...base.engine, ...overrides.engine },
    runtime: { ...base.runtime, ...overrides.runtime },
  };
}

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
    if (a.rewardKind === 'networkNodes' && a.rewardPerNetworkNode) {
      errors.push(`action "${a.id}": cannot pay network nodes per network node (the network would compound on itself)`);
    }
    if (a.levels) checkLevelRule(`action "${a.id}".levels`, a.levels, errors);
    if (a.requiredAccessLevel !== undefined && !(Number.isInteger(a.requiredAccessLevel) && a.requiredAccessLevel >= 1)) {
      errors.push(`action "${a.id}": requiredAccessLevel must be an integer >= 1`);
    }
    if (a.heatPerRun !== undefined && !(Number.isFinite(a.heatPerRun) && a.heatPerRun >= 0)) {
      errors.push(`action "${a.id}": heatPerRun must be >= 0`);
    }
    if (a.sleeveLevels) checkLevelRule(`action "${a.id}".sleeveLevels`, a.sleeveLevels, errors);
    if (a.rewardKind !== undefined && a.rewardKind !== 'credits' && a.rewardKind !== 'networkNodes') {
      errors.push(`action "${a.id}": unknown rewardKind`);
    }
    if (a.speedScaling) checkScaling(`action "${a.id}".speedScaling`, a.speedScaling, errors);
  }

  const buyableIds = new Set<string>();
  for (const b of config.buyables) {
    if (buyableIds.has(b.id)) errors.push(`duplicate buyable id "${b.id}"`);
    buyableIds.add(b.id);
  }
  for (const b of config.buyables) {
    if (!b.cost.isFinite() || b.cost.isNegative()) errors.push(`buyable "${b.id}": cost must be >= 0`);
    const actionEffect = ACTION_EFFECT_KINDS.includes(b.effect.kind);
    if (actionEffect && b.actionId === undefined) errors.push(`buyable "${b.id}": ${b.effect.kind} needs an actionId`);
    if (!actionEffect && b.actionId !== undefined)
      errors.push(`buyable "${b.id}": ${b.effect.kind} is sleeve-wide and must not have an actionId`);
    if (b.actionId !== undefined && !actionIds.has(b.actionId)) errors.push(`buyable "${b.id}": belongs to unknown action "${b.actionId}"`);
    if (b.effect.kind === 'interfaceSpeed' && !(Number.isFinite(b.effect.amount) && b.effect.amount >= 0)) {
      errors.push(`buyable "${b.id}": interface speed amount must be >= 0`);
    }
    if (b.effect.kind === 'accessLevel' && !(Number.isInteger(b.effect.level) && b.effect.level >= 1)) {
      errors.push(`buyable "${b.id}": access level must be an integer >= 1`);
    }
    if (b.effect.kind === 'outputMultiplier' && !(Number.isFinite(b.effect.factor) && b.effect.factor >= 1)) {
      errors.push(`buyable "${b.id}": output multiplier factor must be >= 1`);
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

  const p = config.progression;
  if (!positiveInt(p.runsPerSleeveXp)) errors.push('progression.runsPerSleeveXp must be an integer >= 1');
  if (!positive(p.sleeveXpPerGrant)) errors.push('progression.sleeveXpPerGrant must be > 0');
  if (!(Number.isFinite(p.startingCredits) && p.startingCredits >= 0)) errors.push('progression.startingCredits must be >= 0');
  checkLevelRule('progression.actionLevels', p.actionLevels, errors);
  checkLevelRule('progression.sleeveLevels', p.sleeveLevels, errors);

  if (!(Number.isFinite(config.network.creditsPerNodePerSecond) && config.network.creditsPerNodePerSecond >= 0)) {
    errors.push('network.creditsPerNodePerSecond must be >= 0');
  }

  const sl = config.sleeve;
  if (!(Number.isInteger(sl.baseAccessLevel) && sl.baseAccessLevel >= 1)) errors.push('sleeve.baseAccessLevel must be an integer >= 1');
  if (!(Number.isFinite(sl.baseInterfaceSpeed) && sl.baseInterfaceSpeed > 0)) errors.push('sleeve.baseInterfaceSpeed must be > 0');
  if (!(Number.isFinite(sl.baseHeat) && sl.baseHeat >= 0)) errors.push('sleeve.baseHeat must be >= 0');
  if (!positive(sl.heatCooldownMs)) errors.push('sleeve.heatCooldownMs must be > 0');
  if (!positive(sl.heatCooldownAmount)) errors.push('sleeve.heatCooldownAmount must be > 0');

  checkScaling('speed.actionLevel', config.speed.actionLevel, errors);
  checkScaling('speed.sleeveLevel', config.speed.sleeveLevel, errors);

  const g = config.global;
  for (const key of ['speedMultiplier', 'rewardMultiplier', 'xpMultiplier', 'costMultiplier'] as const) {
    if (!positive(g[key])) errors.push(`global.${key} must be > 0`);
  }

  if (!positiveInt(config.engine.maxBatchesPerTick)) errors.push('engine.maxBatchesPerTick must be an integer >= 1');

  const r = config.runtime;
  for (const key of ['stepMs', 'maxDeltaMs', 'autosaveMs'] as const) {
    if (!positive(r[key])) errors.push(`runtime.${key} must be > 0`);
  }
  if (!(Number.isFinite(r.fastForwardFactor) && r.fastForwardFactor > 1)) errors.push('runtime.fastForwardFactor must be > 1');

  return errors;
}
