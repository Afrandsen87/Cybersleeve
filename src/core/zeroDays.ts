/**
 * @module core
 *
 * Zero-days and Admin keys: items that, while their Inventory toggle is on, make the completed runs of one action critical successes.
 */
import type { Inventory } from './inventory';
import { itemCount } from './inventory';
import { binomial, type RandomSource } from './sampling';
import type { ActionId, AdminKeyConfig, GameConfig, GameState, ZeroDayConfig } from './types';

/** Which of the two items a {@link ZeroDays} instance is for. */
export type CriticalKeyKind = 'zeroDay' | 'adminKey';

/** Where each kind keeps its rule and its toggle. */
const KINDS = {
  zeroDay: { toggle: 'zeroDaysOn' },
  adminKey: { toggle: 'adminKeysOn' },
} as const satisfies Record<CriticalKeyKind, { toggle: 'zeroDaysOn' | 'adminKeysOn' }>;

/**
 * The toggle of one critical-key item and the keys a batch of completed runs uses up.
 *
 * @remarks
 * One instance serves one item: the Zero-day (`items.zeroDay`, toggle `zeroDaysOn`, Push malware) or the Admin key (`items.adminKey`,
 * toggle `adminKeysOn`, Practice Hacking). While the toggle is on, every completed run of the action named by the rule uses one key up
 * and is a critical success. A batch of runs is settled in one step (closed form): `min(runs, held)` of its runs are guaranteed critical,
 * and the rest are rolled as usual. When the last key is used the toggle switches itself off. The toggle cannot be switched on with
 * none held. The items are not sold (declared `sellable: false`).
 *
 * An Admin key's rule may also name a bonus item (the Skill shard): each key-assisted critical run then has a chance to drop one, drawn
 * once per batch from Binomial(keys used, chance) and put under the item's single stack.
 *
 * Called by: `engine.ts` (`GameEngine.toggleZeroDays`, `GameEngine.toggleAdminKeys`), `actionRunner.ts` (`ActionRunner.completeRuns`).
 * Calls: {@link Inventory} (`take`, `add`), `binomial`.
 */
export class ZeroDays {
  /**
   * Creates the unit.
   *
   * @param config reads the item's rule (`items.zeroDay` or `items.adminKey`) and `items.rarities` (the stack is kept under the first)
   * @param state the live game state (mutated: `zeroDaysOn` or `adminKeysOn`)
   * @param inventory where the keys are taken from and bonus items are put
   * @param kind which item this instance is for (default: the Zero-day)
   * @param random randomness for the bonus drop (default: `Math.random`)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'items'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly kind: CriticalKeyKind = 'zeroDay',
    private readonly random: RandomSource = Math.random,
  ) {}

  /** The rule of this item, or `undefined` when the game has none. */
  private rule(): (ZeroDayConfig & Partial<Pick<AdminKeyConfig, 'shard'>>) | undefined {
    return this.config.items[this.kind];
  }

  /** True when the toggle is on. */
  isOn(): boolean {
    return this.state[KINDS[this.kind].toggle];
  }

  private setOn(on: boolean): void {
    this.state[KINDS[this.kind].toggle] = on;
  }

  /** Keys held (0 when the game has none). */
  held(): number {
    const rule = this.rule();
    const stack = this.config.items.rarities[0];
    return rule && stack ? itemCount(this.state, rule.itemId, stack.id) : 0;
  }

  /** True when pressing the toggle would do something: it is on (and can be switched off), or a key is held (and it can be switched on). */
  canToggle(): boolean {
    return this.rule() !== undefined && (this.isOn() || this.held() > 0);
  }

  /**
   * Switches the toggle. Switching on needs a key in the Inventory; switching off always works.
   *
   * @returns true when the toggle is now on
   */
  toggle(): boolean {
    if (this.isOn()) this.setOn(false);
    else if (this.rule() !== undefined && this.held() > 0) this.setOn(true);
    return this.isOn();
  }

  /**
   * Uses keys up for a batch of completed runs.
   *
   * @param actionId the action whose runs completed
   * @param runs how many runs completed (a whole number >= 1)
   * @returns how many of the runs are guaranteed critical: `min(runs, held)` while the toggle is on and the action is the one the
   *   key is for; otherwise 0. Switches the toggle off when the last key was used. Drops bonus items for the runs it covered.
   */
  claim(actionId: ActionId, runs: number): number {
    const rule = this.rule();
    const stack = this.config.items.rarities[0];
    if (!rule || !stack || !this.isOn() || rule.actionId !== actionId || runs <= 0) return 0;
    const used = this.inventory.take(rule.itemId, stack.id, runs);
    if (this.held() <= 0) this.setOn(false);
    if (used > 0 && rule.shard) {
      const drops = binomial(used, rule.shard.chance, this.random);
      if (drops > 0) this.inventory.add(rule.shard.itemId, stack.id, drops);
    }
    return used;
  }
}
