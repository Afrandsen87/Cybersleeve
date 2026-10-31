/**
 * @module automation
 * Automation context: saved settings, controls, point accounting and feature ownership.
 * Called by: automation facade, save readers and UI. Calls: createAutoBurnSettings.
 */
import type { AutoBurnControls } from './autoBurn';
import { type AutoBurnSettings, createAutoBurnSettings } from './autoBurnTypes';
import type { RarityAutomation } from './rarityPermissions';
import type { ActionId, BuyableDefinition, BuyableId, GameConfig, RarityId } from '../types';
/** Something that can be automated. Each costs one automation point to unlock. */
export type AutomationFeature = 'autoBurn' | 'autosale' | 'dispersal';

/** Every feature, in the order the Automation tab lists them. */
export const AUTOMATION_FEATURES: readonly AutomationFeature[] = ['autoBurn', 'autosale', 'dispersal'];

/**
 * The automation points earned in total: `perCopy` of every owned `automationPoints` buyable. Spent or not.
 *
 * Called by: `createGame.ts` (what the Shop pays automation skills from), {@link Automation.pointsEarned}, `serialization.ts`, `testing/invariants.ts`.
 *
 * @param buyables all buyable definitions
 * @param purchased copies owned, by id
 */
export function automationPointsEarned(buyables: readonly BuyableDefinition[], purchased: Readonly<Record<BuyableId, number>>): number {
  let points = 0;
  for (const b of buyables) if (b.effect.kind === 'automationPoints') points += b.effect.perCopy * (purchased[b.id] ?? 0);
  return Math.min(points, Number.MAX_SAFE_INTEGER);
}

/**
 * The skill that unlocks an automation feature: the buyable with the effect `unlocksAutomation` for it (the root of its lane).
 *
 * Called by: {@link isFeatureUnlocked}, {@link Automation.unlock}, `serialization.ts` (the migration of old saves).
 *
 * @returns the id, or `undefined` when the content has no such skill
 */
export function unlockingBuyable(buyables: readonly BuyableDefinition[], feature: AutomationFeature): BuyableId | undefined {
  return buyables.find((b) => b.effect.kind === 'unlocksAutomation' && b.effect.feature === feature)?.id;
}

/**
 * True when the skill that unlocks the feature is owned.
 *
 * Called by: {@link Automation.isUnlocked}, `serialization.ts`, `testing/invariants.ts`.
 */
export function isFeatureUnlocked(
  buyables: readonly BuyableDefinition[],
  purchased: Readonly<Record<BuyableId, number>>,
  feature: AutomationFeature,
): boolean {
  const id = unlockingBuyable(buyables, feature);
  return id !== undefined && (purchased[id] ?? 0) > 0;
}

/** What {@link Automation} needs from the shop: the automation points still to spend, and buying a skill. */
export interface AutomationShop {
  /** Automation points still to spend: earned minus the price of the owned automation skills. */
  pointsAvailable(): number;
  /** Buys one copy of the buyable; true when it was bought. */
  buy(id: BuyableId): boolean;
}

/**
 * What the player has set up in the Automation tab. Part of the saved state; reset by re-sleeving.
 * Whether a feature is unlocked is not stored: it is owning the skill that unlocks it (see {@link isFeatureUnlocked}).
 */
export interface AutomationState {
  /** What the player set for Auto Burn: thresholds, reserve and switches (the Burn lead toggle itself is per sleeve: `sleeve.autoBurn`). */
  autoBurn: AutoBurnSettings;
  /** Rarities whose sellable items are sold automatically (absent or false: not sold). */
  autosale: Record<RarityId, boolean>;
  /** Automation context: per-rarity Back Channel switches; missing means off. */
  autoBackchannel: Record<RarityId, boolean>;
  /** Automation context: selected actions receive equal portions of allowed augments. */
  dispersalTargets: ActionId[];
}

/**
 * A fresh automation state: nothing unlocked, Auto Burn with every switch off and the configured thresholds.
 *
 * Called by: `state.ts`, `serialization.ts`. Calls: `createAutoBurnSettings`.
 *
 * @param config reads `automation.autoBurnCeiling` and `automation.autoBurnUpper`
 */
export function createAutomationState(config: Pick<GameConfig, 'automation'>): AutomationState {
  return { autoBurn: createAutoBurnSettings(config), autosale: {}, autoBackchannel: {}, dispersalTargets: [] };
}

/** What the screen and the commands use (satisfied by {@link Automation}). */
export interface AutomationControls {
  /** True when the game has automation at all (a configuration `automation` section). */
  available(): boolean;
  /** Automation points earned in total (spent or not): 0 until a point is bought. */
  pointsEarned(): number;
  /** Automation points still to spend: earned minus the price of the automation skills owned. */
  pointsAvailable(): number;
  /** True when the feature has been unlocked. */
  isUnlocked(feature: AutomationFeature): boolean;
  /** Buys the first skill of the feature's lane (one point); false when there is none to spend, it is unlocked already, or the game has no automation. */
  unlock(feature: AutomationFeature): boolean;
  /** Auto Burn: its toggle, switches, thresholds and reserve. */
  autoBurn(): AutoBurnControls;
  /** Automation context: allowed known rarities. Calls: the shared rarity permission owner. */
  allowedRarities(feature: RarityAutomation): readonly RarityId[];
  /** Automation context: whether this rarity's auto Back Channel switch is on. */
  isAutoBackchannelOn(rarityId: RarityId): boolean;
  /** Automation context: sets a permitted rarity switch; returns its resulting state. */
  setAutoBackchannel(rarityId: RarityId, on: boolean): boolean;
  /** Autosale: whether the rarity is sold automatically. */
  isAutosaleOn(rarityId: RarityId): boolean;
  /** Switches the autosale of a rarity; only works for a skill-allowed known rarity. @returns true when it is now on */
  setAutosale(rarityId: RarityId, on: boolean): boolean;
  /** Automation context: number of actions selectable through owned lane skills. */
  dispersalSlots(): number;
  /** Automation context: current selected actions in configuration order. */
  dispersalTargets(): readonly ActionId[];
  /** Automation context: selects an unlocked action within capacity, or removes it; false on refusal. */
  setDispersalTarget(actionId: ActionId, on: boolean): boolean;
}

/** Automation context: narrow availability query injected by createGame. Called by: Automation. Calls: ActionRunner.isUnlocked. */
export interface AutomationActions {
  /** Whether the known action is currently available through access level. */
  isUnlocked(actionId: ActionId): boolean;
}
