/**
 * @module core
 *
 * Automation: features the player unlocks with automation points and that then play part of the game for them.
 */
import type { Augments } from '../items/augments';
import type { BurnLeads } from '../items/burnLeads';
import type { Inventory } from '../items/inventory';
import type { ActionId, BuyableDefinition, BuyableId, GameConfig, GameState, RarityId } from '../types';

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
  /** Auto Burn is switched on (only possible once unlocked). */
  autoBurnOn: boolean;
  /** Auto Burn uses Burn leads whenever heat is above this many points (>= 0). */
  autoBurnCeiling: number;
  /** Rarities whose sellable items are sold automatically (absent or false: not sold). */
  autosale: Record<RarityId, boolean>;
  /** Share (percent, 0..100) of the Augment schematics each action gets (absent: 0). All shares together are at most 100. */
  dispersal: Record<ActionId, number>;
}

/**
 * A fresh automation state: nothing unlocked, Auto Burn off at the configured default ceiling.
 *
 * Called by: `state.ts`, `serialization.ts`.
 *
 * @param config reads `automation.autoBurnCeiling`
 */
export function createAutomationState(config: Pick<GameConfig, 'automation'>): AutomationState {
  return { autoBurnOn: false, autoBurnCeiling: config.automation?.autoBurnCeiling ?? 0, autosale: {}, dispersal: {} };
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
  /** Auto Burn: on or off. */
  isAutoBurnOn(): boolean;
  /** Auto Burn: the heat above which Burn leads are used. */
  autoBurnCeiling(): number;
  /** Switches Auto Burn; only works once unlocked. @returns true when it is now on */
  setAutoBurn(on: boolean): boolean;
  /** Sets the Auto Burn ceiling (a finite number >= 0; anything else is ignored). @returns true when it was set */
  setAutoBurnCeiling(heat: number): boolean;
  /** Autosale: whether the rarity is sold automatically. */
  isAutosaleOn(rarityId: RarityId): boolean;
  /** Switches the autosale of a rarity; only works once unlocked and for a known rarity. @returns true when it is now on */
  setAutosale(rarityId: RarityId, on: boolean): boolean;
  /** Augment dispersal: the share (percent) the action gets. */
  dispersal(actionId: ActionId): number;
  /** Sets an action's share (clamped to 0..100); only works once unlocked and for a known action. @returns true when it was set */
  setDispersal(actionId: ActionId, percent: number): boolean;
}

/**
 * The automation features, the points that pay for them and the skill lanes that unlock them.
 *
 * @remarks
 * Points are not stored: earned points are `perCopy` of every owned `automationPoints` buyable, and the points available are those
 * minus the price of the owned skills paid in automation points (the Shop works that out). Each feature has a lane of skills in the
 * Automation tab; owning the first one (`unlocksAutomation`) is what unlocks it, so "unlock" buys that skill. All three features work in closed form, so a slice of any length costs the same:
 * - **Auto Burn** uses `k` Burn leads at once, where `k` is the smallest number that brings heat to the ceiling
 *   (`heat x (1 - fraction)^k <= ceiling`), at most what is held.
 * - **Autosale** sells whole stacks of the switched-on rarities of every sellable item.
 * - **Augment dispersal** hands the schematics held to the actions in proportion to their shares (largest remainder, so none is lost).
 *
 * Called by: `engine.ts` (`GameEngine.advance` calls {@link Automation.step}; the screen uses {@link AutomationControls}).
 * Calls: {@link BurnLeads}, {@link Augments}, {@link Inventory}, {@link AutomationShop}.
 */
export class Automation implements AutomationControls {
  /**
   * Creates the unit.
   *
   * @param config reads `automation`, the buyables (the point sources and the unlocking skills), the items (rarities, what is sellable, the leads and schematics) and the actions
   * @param state the live game state (mutated: `automation`, and through the other units heat, the inventory and augments)
   * @param inventory where autosale sells from
   * @param burnLeads uses the leads for Auto Burn
   * @param augments applies the schematics for dispersal
   * @param shop the automation points still to spend, and buying the unlocking skill
   */
  constructor(
    private readonly config: Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly burnLeads: BurnLeads,
    private readonly augments: Augments,
    private readonly shop: AutomationShop,
  ) {}

  /** See {@link AutomationControls.available}. */
  available(): boolean {
    return this.config.automation !== undefined;
  }

  /** See {@link AutomationControls.pointsEarned}: see {@link automationPointsEarned}. */
  pointsEarned(): number {
    return this.available() ? automationPointsEarned(this.config.buyables, this.state.purchased) : 0;
  }

  /** See {@link AutomationControls.pointsAvailable}: asks the shop (earned points minus the price of the automation skills owned). */
  pointsAvailable(): number {
    return this.available() ? this.shop.pointsAvailable() : 0;
  }

  /** See {@link AutomationControls.isUnlocked}: the feature's first skill is owned. */
  isUnlocked(feature: AutomationFeature): boolean {
    return isFeatureUnlocked(this.config.buyables, this.state.purchased, feature);
  }

  /** See {@link AutomationControls.unlock}. Buys the lane's first skill, which mutates `state.purchased`. */
  unlock(feature: AutomationFeature): boolean {
    const skill = unlockingBuyable(this.config.buyables, feature);
    if (!this.available() || skill === undefined || this.isUnlocked(feature)) return false;
    return this.shop.buy(skill);
  }

  /** See {@link AutomationControls.isAutoBurnOn}. */
  isAutoBurnOn(): boolean {
    return this.state.automation.autoBurnOn;
  }

  /** See {@link AutomationControls.autoBurnCeiling}. */
  autoBurnCeiling(): number {
    return this.state.automation.autoBurnCeiling;
  }

  /** See {@link AutomationControls.setAutoBurn}. Mutates `state.automation.autoBurnOn`. */
  setAutoBurn(on: boolean): boolean {
    if (this.isUnlocked('autoBurn')) this.state.automation.autoBurnOn = on;
    return this.state.automation.autoBurnOn;
  }

  /** See {@link AutomationControls.setAutoBurnCeiling}. Mutates `state.automation.autoBurnCeiling`. */
  setAutoBurnCeiling(heat: number): boolean {
    if (!this.isUnlocked('autoBurn') || !Number.isFinite(heat) || heat < 0) return false;
    this.state.automation.autoBurnCeiling = heat;
    return true;
  }

  /** See {@link AutomationControls.isAutosaleOn}. */
  isAutosaleOn(rarityId: RarityId): boolean {
    return this.state.automation.autosale[rarityId] === true;
  }

  /** See {@link AutomationControls.setAutosale}. Mutates `state.automation.autosale`. */
  setAutosale(rarityId: RarityId, on: boolean): boolean {
    if (!this.isUnlocked('autosale') || !this.config.items.rarities.some((r) => r.id === rarityId)) return this.isAutosaleOn(rarityId);
    if (on) this.state.automation.autosale[rarityId] = true;
    else delete this.state.automation.autosale[rarityId];
    return on;
  }

  /** See {@link AutomationControls.dispersal}. */
  dispersal(actionId: ActionId): number {
    return this.state.automation.dispersal[actionId] ?? 0;
  }

  /** See {@link AutomationControls.setDispersal}. Mutates `state.automation.dispersal`. */
  setDispersal(actionId: ActionId, percent: number): boolean {
    if (!this.isUnlocked('dispersal') || !this.config.actions.some((a) => a.id === actionId) || !Number.isFinite(percent)) return false;
    // The shares of all actions together never pass 100: an action gets at most what the others leave.
    const others = Object.entries(this.state.automation.dispersal).reduce((n, [id, s]) => (id === actionId ? n : n + s), 0);
    const share = Math.min(Math.max(0, 100 - others), Math.max(0, percent));
    if (share > 0) this.state.automation.dispersal[actionId] = share;
    else delete this.state.automation.dispersal[actionId];
    return true;
  }

  /**
   * Runs every unlocked and switched-on feature once. Called by the engine after each slice of game time.
   * Order: Auto Burn (heat), then autosale, then dispersal.
   */
  step(): void {
    if (!this.available()) return;
    if (this.isUnlocked('autoBurn') && this.state.automation.autoBurnOn) this.burn();
    if (this.isUnlocked('autosale')) this.sell();
    if (this.isUnlocked('dispersal')) this.disperse();
  }

  /** Auto Burn: uses just enough leads to bring heat down to the ceiling, or all there are. */
  private burn(): void {
    const lead = this.config.items.burnLead;
    const stack = this.config.items.rarities[0];
    const { heat, automation } = this.state;
    if (!lead || !stack || !(heat > automation.autoBurnCeiling) || !this.burnLeads.canUse(stack.id)) return;
    this.burnLeads.useMany(stack.id, this.burnLeads.leadsNeeded(automation.autoBurnCeiling));
  }

  /** Autosale: sells every stack of a switched-on rarity, for every item that can be sold and has rarities. */
  private sell(): void {
    for (const rarity of this.config.items.rarities) {
      if (!this.isAutosaleOn(rarity.id)) continue;
      for (const item of this.config.items.definitions) {
        if (item.sellable === false || item.hasRarity === false) continue;
        this.inventory.sell(item.id, rarity.id, 'all');
      }
    }
  }

  /** Dispersal: gives all the schematics held to the actions with a share, in proportion, none left over. */
  private disperse(): void {
    const augment = this.config.items.augment;
    if (!augment) return;
    const held = this.config.items.rarities.reduce((n, r) => n + (this.state.inventory[augment.itemId]?.[r.id] ?? 0), 0);
    const shares = this.config.actions
      .map((a) => ({ id: a.id, share: this.state.automation.dispersal[a.id] ?? 0 }))
      .filter((s) => s.share > 0);
    const total = shares.reduce((n, s) => n + s.share, 0);
    if (held <= 0 || total <= 0) return;
    // Aim at the shares of everything applied so far plus what is held now, so a few schematics per step still end up balanced
    // (a stateless split would give a single schematic to the first action every time).
    const appliedTo = (id: ActionId): number => Object.values(this.state.actions[id]?.augments ?? {}).reduce((n, c) => n + c, 0);
    const appliedTotal = shares.reduce((n, s) => n + appliedTo(s.id), 0);
    const needs = shares.map((s) => Math.max(0, ((appliedTotal + held) * s.share) / total - appliedTo(s.id)));
    const needTotal = needs.reduce((n, d) => n + d, 0);
    const parts = shares.map((s, i) => {
      const exact = needTotal > 0 ? (held * (needs[i] ?? 0)) / needTotal : (held * s.share) / total;
      return { id: s.id, count: Math.floor(exact), fraction: exact - Math.floor(exact) };
    });
    let left = held - parts.reduce((n, p) => n + p.count, 0);
    // The schematics that do not divide evenly go to the largest remainders (ties: configuration order).
    for (const p of [...parts].sort((a, b) => b.fraction - a.fraction)) {
      if (left <= 0) break;
      p.count += 1;
      left -= 1;
    }
    for (const p of parts) if (p.count > 0) this.augments.applyMany(p.id, p.count);
  }
}
