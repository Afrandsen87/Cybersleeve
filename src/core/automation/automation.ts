/**
 * @module core
 *
 * Automation: features the player unlocks with automation points and that then play part of the game for them.
 */
import type { Augments } from '../items/augments';
import type { AutoBurn, AutoBurnControls } from './autoBurn';
import { type AutoBurnSettings, createAutoBurnSettings } from './autoBurnTypes';
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
  /** What the player set for Auto Burn: thresholds, reserve and switches (the Burn lead toggle itself is per sleeve: `sleeve.autoBurn`). */
  autoBurn: AutoBurnSettings;
  /** Rarities whose sellable items are sold automatically (absent or false: not sold). */
  autosale: Record<RarityId, boolean>;
  /** Share (percent, 0..100) of the Augment schematics each action gets (absent: 0). All shares together are at most 100. */
  dispersal: Record<ActionId, number>;
}

/**
 * A fresh automation state: nothing unlocked, Auto Burn with every switch off and the configured thresholds.
 *
 * Called by: `state.ts`, `serialization.ts`. Calls: `createAutoBurnSettings`.
 *
 * @param config reads `automation.autoBurnCeiling` and `automation.autoBurnUpper`
 */
export function createAutomationState(config: Pick<GameConfig, 'automation'>): AutomationState {
  return { autoBurn: createAutoBurnSettings(config), autosale: {}, dispersal: {} };
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
 * - **Auto Burn** (`autoBurn.ts`) is the Burn lead Inventory toggle and the rules the skills of its lane add.
 * - **Autosale** sells whole stacks of the switched-on rarities of every sellable item.
 * - **Augment dispersal** hands the schematics held to the actions in proportion to their shares (largest remainder, so none is lost).
 *
 * Called by: `engine.ts` (`GameEngine.advance` calls {@link Automation.step}; the screen uses {@link AutomationControls}).
 * Calls: {@link AutoBurn}, {@link Augments}, {@link Inventory}, {@link AutomationShop}.
 */
export class Automation implements AutomationControls {
  /**
   * Creates the unit.
   *
   * @param config reads `automation`, the buyables (the point sources and the unlocking skills), the items (rarities, what is sellable, the leads and schematics) and the actions
   * @param state the live game state (mutated: `automation`, and through the other units heat, the inventory and augments)
   * @param inventory where autosale sells from
   * @param autoBurnUnit Auto Burn: the toggle, its switches and the leads it uses
   * @param augments applies the schematics for dispersal
   * @param shop the automation points still to spend, and buying the unlocking skill
   */
  constructor(
    private readonly config: Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly autoBurnUnit: AutoBurn,
    private readonly augments: Augments,
    private readonly shop: AutomationShop,
  ) {}

  /** See {@link AutomationControls.available}. */
  available(): boolean {
    return this.config.automation !== undefined;
  }

  /** See {@link AutomationControls.pointsEarned}: see {@link automationPointsEarned}. */
  pointsEarned(): number {
    return this.available() ? automationPointsEarned(this.config.buyables, this.state.sleeve.purchased) : 0;
  }

  /** See {@link AutomationControls.pointsAvailable}: asks the shop (earned points minus the price of the automation skills owned). */
  pointsAvailable(): number {
    return this.available() ? this.shop.pointsAvailable() : 0;
  }

  /** See {@link AutomationControls.isUnlocked}: the feature's first skill is owned. */
  isUnlocked(feature: AutomationFeature): boolean {
    return isFeatureUnlocked(this.config.buyables, this.state.sleeve.purchased, feature);
  }

  /** See {@link AutomationControls.unlock}. Buys the lane's first skill, which mutates `state.purchased`. */
  unlock(feature: AutomationFeature): boolean {
    const skill = unlockingBuyable(this.config.buyables, feature);
    if (!this.available() || skill === undefined || this.isUnlocked(feature)) return false;
    return this.shop.buy(skill);
  }

  /** See {@link AutomationControls.autoBurn}. */
  autoBurn(): AutoBurnControls {
    return this.autoBurnUnit;
  }

  /** The player switched an action's Overclock by hand: Auto Burn forgets that it had switched it off. Called by `engine.ts`. */
  playerSwitchedOverclock(id: ActionId): void {
    this.autoBurnUnit.playerSwitchedOverclock(id);
  }

  /** The player switched an Auto-run by hand: Auto Burn forgets that it had switched it off. Called by `engine.ts`. */
  playerSwitchedAutoRun(id: BuyableId): void {
    this.autoBurnUnit.playerSwitchedAutoRun(id);
  }

  /** See {@link AutomationControls.isAutosaleOn}. */
  isAutosaleOn(rarityId: RarityId): boolean {
    return this.state.wallet.automation.autosale[rarityId] === true;
  }

  /** See {@link AutomationControls.setAutosale}. Mutates `state.automation.autosale`. */
  setAutosale(rarityId: RarityId, on: boolean): boolean {
    if (!this.isUnlocked('autosale') || !this.config.items.rarities.some((r) => r.id === rarityId)) return this.isAutosaleOn(rarityId);
    if (on) this.state.wallet.automation.autosale[rarityId] = true;
    else delete this.state.wallet.automation.autosale[rarityId];
    return on;
  }

  /** See {@link AutomationControls.dispersal}. */
  dispersal(actionId: ActionId): number {
    return this.state.wallet.automation.dispersal[actionId] ?? 0;
  }

  /** See {@link AutomationControls.setDispersal}. Mutates `state.automation.dispersal`. */
  setDispersal(actionId: ActionId, percent: number): boolean {
    if (!this.isUnlocked('dispersal') || !this.config.actions.some((a) => a.id === actionId) || !Number.isFinite(percent)) return false;
    // The shares of all actions together never pass 100: an action gets at most what the others leave.
    const others = Object.entries(this.state.wallet.automation.dispersal).reduce((n, [id, s]) => (id === actionId ? n : n + s), 0);
    const share = Math.min(Math.max(0, 100 - others), Math.max(0, percent));
    if (share > 0) this.state.wallet.automation.dispersal[actionId] = share;
    else delete this.state.wallet.automation.dispersal[actionId];
    return true;
  }

  /**
   * Runs every unlocked and switched-on feature once. Called by the engine after each slice of game time.
   * Order: Auto Burn (heat), then autosale, then dispersal.
   *
   * @param deltaMs the length of the slice in milliseconds (Auto Burn counts seconds)
   */
  step(deltaMs: number): void {
    if (!this.available()) return;
    this.autoBurnUnit.step(deltaMs);
    if (this.isUnlocked('autosale')) this.sell();
    if (this.isUnlocked('dispersal')) this.disperse();
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

  /**
   * Dispersal: gives all the schematics held to the actions with a share, in proportion. An action whose Auto-run is not owned takes none: its share stays in the inventory until it is.
   *
   * @remarks
   * An action whose Auto-run is not owned takes no augments (`Augments.applyMany` returns 0 and uses nothing up), so its part of
   * the split is simply not applied this round: the schematics stay in the inventory, none consumed or lost. The split is still
   * worked out over every action with a share (closed form, no retry), so the next step splits what is left again and the other
   * actions keep getting their own proportion; buying that Auto-run makes the action take its share from then on.
   */
  private disperse(): void {
    const augment = this.config.items.augment;
    if (!augment) return;
    const held = this.config.items.rarities.reduce((n, r) => n + (this.state.wallet.inventory[augment.itemId]?.[r.id] ?? 0), 0);
    const shares = this.config.actions
      .map((a) => ({ id: a.id, share: this.state.wallet.automation.dispersal[a.id] ?? 0 }))
      .filter((s) => s.share > 0);
    const total = shares.reduce((n, s) => n + s.share, 0);
    if (held <= 0 || total <= 0) return;
    // Aim at the shares of everything applied so far plus what is held now, so a few schematics per step still end up balanced
    // (a stateless split would give a single schematic to the first action every time).
    const appliedTo = (id: ActionId): number => Object.values(this.state.sleeve.actions[id]?.augments ?? {}).reduce((n, c) => n + c, 0);
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
