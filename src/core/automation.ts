/**
 * @module core
 *
 * Automation: features the player unlocks with automation points and that then play part of the game for them.
 */
import type { Augments } from './augments';
import type { BurnLeads } from './burnLeads';
import type { Inventory } from './inventory';
import type { ActionId, GameConfig, GameState, RarityId } from './types';

/** Something that can be automated. Each costs one automation point to unlock. */
export type AutomationFeature = 'autoBurn' | 'autosale' | 'dispersal';

/** Every feature, in the order the Automation tab lists them. */
export const AUTOMATION_FEATURES: readonly AutomationFeature[] = ['autoBurn', 'autosale', 'dispersal'];

/** What the player has set up in the Automation tab. Part of the saved state; reset by re-sleeving. */
export interface AutomationState {
  /** Features unlocked with automation points (absent or false: locked). */
  unlocked: Partial<Record<AutomationFeature, boolean>>;
  /** Auto Burn is switched on (only possible once unlocked). */
  autoBurnOn: boolean;
  /** Auto Burn uses Burn leads whenever heat is above this many points (>= 0). */
  autoBurnCeiling: number;
  /** Rarities whose sellable items are sold automatically (absent or false: not sold). */
  autosale: Record<RarityId, boolean>;
  /** Share (percent, 0..100) of the Augment schematics each action gets (absent: 0). The shares are relative to each other. */
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
  return { unlocked: {}, autoBurnOn: false, autoBurnCeiling: config.automation?.autoBurnCeiling ?? 0, autosale: {}, dispersal: {} };
}

/** What the screen and the commands use (satisfied by {@link Automation}). */
export interface AutomationControls {
  /** True when the game has automation at all (a configuration `automation` section). */
  available(): boolean;
  /** Automation points earned in total (spent or not): 0 until a point is bought. */
  pointsEarned(): number;
  /** Automation points still to spend: earned minus one per unlocked feature. */
  pointsAvailable(): number;
  /** True when the feature has been unlocked. */
  isUnlocked(feature: AutomationFeature): boolean;
  /** Spends a point to unlock a feature; false when there is none to spend, it is unlocked already, or the game has no automation. */
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
 * The automation features and the points that pay for them.
 *
 * @remarks
 * Points are not stored: earned points are `perCopy` of every owned `automationPoints` buyable, and the points available are those
 * minus one per unlocked feature. All three features work in closed form, so a slice of any length costs the same:
 * - **Auto Burn** uses `k` Burn leads at once, where `k` is the smallest number that brings heat to the ceiling
 *   (`heat x (1 - fraction)^k <= ceiling`), at most what is held.
 * - **Autosale** sells whole stacks of the switched-on rarities of every sellable item.
 * - **Augment dispersal** hands the schematics held to the actions in proportion to their shares (largest remainder, so none is lost).
 *
 * Called by: `engine.ts` (`GameEngine.advance` calls {@link Automation.step}; the screen uses {@link AutomationControls}).
 * Calls: {@link BurnLeads}, {@link Augments}, {@link Inventory}.
 */
export class Automation implements AutomationControls {
  /**
   * Creates the unit.
   *
   * @param config reads `automation`, the buyables (the point sources), the items (rarities, what is sellable, the leads and schematics) and the actions
   * @param state the live game state (mutated: `automation`, and through the other units heat, the inventory and augments)
   * @param inventory where autosale sells from
   * @param burnLeads uses the leads for Auto Burn
   * @param augments applies the schematics for dispersal
   */
  constructor(
    private readonly config: Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly burnLeads: BurnLeads,
    private readonly augments: Augments,
  ) {}

  /** See {@link AutomationControls.available}. */
  available(): boolean {
    return this.config.automation !== undefined;
  }

  /** See {@link AutomationControls.pointsEarned}: the sum of `perCopy x copies` over the owned `automationPoints` buyables. */
  pointsEarned(): number {
    if (!this.available()) return 0;
    let points = 0;
    for (const b of this.config.buyables) {
      if (b.effect.kind === 'automationPoints') points += b.effect.perCopy * (this.state.purchased[b.id] ?? 0);
    }
    return Math.min(points, Number.MAX_SAFE_INTEGER);
  }

  /** See {@link AutomationControls.pointsAvailable}: earned points minus one per unlocked feature. */
  pointsAvailable(): number {
    return Math.max(0, this.pointsEarned() - AUTOMATION_FEATURES.filter((f) => this.isUnlocked(f)).length);
  }

  /** See {@link AutomationControls.isUnlocked}. */
  isUnlocked(feature: AutomationFeature): boolean {
    return this.state.automation.unlocked[feature] === true;
  }

  /** See {@link AutomationControls.unlock}. Mutates `state.automation.unlocked`. */
  unlock(feature: AutomationFeature): boolean {
    if (!this.available() || this.isUnlocked(feature) || this.pointsAvailable() < 1) return false;
    this.state.automation.unlocked[feature] = true;
    return true;
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
    const share = Math.min(100, Math.max(0, percent));
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
    const keep = 1 - lead.heatFraction;
    const needed =
      keep <= 0 || automation.autoBurnCeiling <= 0
        ? Number.POSITIVE_INFINITY
        : Math.ceil(Math.log(automation.autoBurnCeiling / heat) / Math.log(keep));
    this.burnLeads.useMany(stack.id, needed);
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
    const parts = shares.map((s) => {
      const exact = (held * s.share) / total;
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
