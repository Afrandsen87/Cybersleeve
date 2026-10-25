/**
 * @module core
 *
 * Skill shards: items that are used up to delay the XP scaling of a random unlocked action.
 */
import type { Inventory } from './inventory';
import { itemCount } from './inventory';
import type { RandomSource } from './sampling';
import type { ActionId, GameConfig, GameState } from './types';

/**
 * Uses Skill shards from the Inventory.
 *
 * @remarks
 * Using a shard uses it up and lands it on one action drawn at random from the actions the sleeve can perform now (the access level is
 * high enough). The action's `skillShards` count goes up by one; `Progression.xpDelay` turns that into a delay of
 * `items.skillShard.levelsDelayed` levels per shard, so the first level costs of the action stay at the first level's cost for that many
 * levels longer. Only the ACTION levels are affected. Shards are not sold (the item is declared `sellable: false`) and are reset by
 * re-sleeving with the rest of the action's state.
 *
 * Called by: `engine.ts` (`GameEngine.useSkillShard`). Calls: {@link Inventory} (`take`).
 */
export class SkillShards {
  /**
   * Creates the unit.
   *
   * @param config reads `items.skillShard` (which item is the shard), `items.rarities` (the stack is kept under the first) and `actions`
   * @param state the live game state (mutated: each action's `skillShards`)
   * @param inventory where the shards are taken from
   * @param isUnlocked whether the sleeve can perform an action now (satisfied by `ActionRunner.isUnlocked`)
   * @param random randomness for the choice of action (inject a seeded one in tests)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'items' | 'actions'>,
    private readonly state: GameState,
    private readonly inventory: Inventory,
    private readonly isUnlocked: (id: ActionId) => boolean,
    private readonly random: RandomSource,
  ) {}

  /** The actions a shard can land on now. */
  private candidates(): ActionId[] {
    return this.config.actions.filter((a) => this.state.actions[a.id] !== undefined && this.isUnlocked(a.id)).map((a) => a.id);
  }

  /** Shards held (0 when the game has none). */
  held(): number {
    const rule = this.config.items.skillShard;
    const stack = this.config.items.rarities[0];
    return rule && stack ? itemCount(this.state, rule.itemId, stack.id) : 0;
  }

  /** True when using a shard would do something: the game has shards, one is held and some action is unlocked. */
  canUse(): boolean {
    return this.held() > 0 && this.candidates().length > 0;
  }

  /**
   * Uses one shard on a random unlocked action.
   *
   * @returns the action it landed on, or `null` when nothing happened (none held, or no action is unlocked)
   */
  use(): ActionId | null {
    const rule = this.config.items.skillShard;
    const stack = this.config.items.rarities[0];
    const candidates = this.candidates();
    if (!rule || !stack || candidates.length === 0) return null;
    if (this.inventory.take(rule.itemId, stack.id, 1) <= 0) return null;
    const id = candidates[Math.min(candidates.length - 1, Math.floor(this.random() * candidates.length))]!;
    const action = this.state.actions[id]!;
    action.skillShards += 1;
    return id;
  }
}
