/**
 * @module core
 *
 * Automation: features the player unlocks with automation points and that then play part of the game for them.
 */
import { allowedRarities, type RarityAutomation } from './rarityPermissions';
import type { BackChannel } from '../items/backChannel';
import type { Augments } from '../items/augments';
import type { AutoBurn, AutoBurnControls } from './autoBurn';
import type { Inventory } from '../items/inventory';
import type { ActionId, BuyableId, GameConfig, GameState, RarityId } from '../types';

export * from './automationTypes';
import {
  automationPointsEarned,
  isFeatureUnlocked,
  unlockingBuyable,
  type AutomationFeature,
  type AutomationControls,
  type AutomationShop,
} from './automationTypes';

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
   * @param backChannel automation context: the same batch owner used by the manual command
   * @param channel the manual channel query; null until its skill is owned
   */
  constructor(
    private readonly config: Pick<GameConfig, 'automation' | 'buyables' | 'items' | 'actions'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly autoBurnUnit: AutoBurn,
    private readonly augments: Augments,
    private readonly shop: AutomationShop,
    private readonly backChannel: Pick<BackChannel, 'giveUp'>,
    private readonly channel: { backChannel(): { itemId: string } | null },
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

  /** Automation context: delegates rarity permissions. Called by: controls, sell, backchannel. Calls: allowedRarities. */
  allowedRarities(feature: RarityAutomation): readonly RarityId[] {
    return allowedRarities(this.config, this.state.sleeve.purchased, feature);
  }

  /** Automation context: locked switches always read off. Called by: UI, step. Calls: allowedRarities. */
  isAutoBackchannelOn(rarityId: RarityId): boolean {
    return this.allowedRarities('autoBackchannel').includes(rarityId) && this.state.wallet.automation.autoBackchannel[rarityId] === true;
  }

  /** Automation context: sets only permitted switches. Called by: UI. Calls: allowedRarities. */
  setAutoBackchannel(rarityId: RarityId, on: boolean): boolean {
    if (!this.allowedRarities('autoBackchannel').includes(rarityId)) return false;
    if (on) this.state.wallet.automation.autoBackchannel[rarityId] = true;
    else delete this.state.wallet.automation.autoBackchannel[rarityId];
    return on;
  }

  /** See {@link AutomationControls.isAutosaleOn}. */
  isAutosaleOn(rarityId: RarityId): boolean {
    return this.allowedRarities('autosale').includes(rarityId) && this.state.wallet.automation.autosale[rarityId] === true;
  }

  /** See {@link AutomationControls.setAutosale}. Mutates `state.automation.autosale`. */
  setAutosale(rarityId: RarityId, on: boolean): boolean {
    if (!this.allowedRarities('autosale').includes(rarityId)) return false;
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
   * Automation context order: Auto Burn (heat), auto backchannel, autosale, then dispersal.
   * Calls: BackChannel.giveUp (manual eligibility and closed-form stack payout), AutoBurn.step, sell, disperse.
   *
   * @param deltaMs the length of the slice in milliseconds (Auto Burn counts seconds)
   */
  step(deltaMs: number): void {
    if (!this.available()) return;
    this.autoBurnUnit.step(deltaMs);
    const channel = this.channel.backChannel();
    if (channel)
      for (const rarity of this.allowedRarities('autoBackchannel')) {
        if (this.isAutoBackchannelOn(rarity)) this.backChannel.giveUp(channel.itemId, rarity, 'all');
      }
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
