/**
 * @module core
 *
 * What a completed corporation run does: one handler per kind of {@link CorporationEffect}.
 *
 * @remarks
 * To add a new kind of effect: add a member to the `CorporationEffect` union (`corporationTypes.ts`) and one entry to
 * {@link CORPORATION_EFFECTS}. The registry is typed over every kind, so the compiler rejects a kind that has no entry.
 */
import type { Inventory } from '../items/inventory';
import { multinomial, perRunEvents, type RandomSource } from '../kernel/sampling';
import type { CorporationEffect, GameConfig, GameState } from '../types';

/** What an effect handler may read and change. */
export interface CorporationEffectContext {
  /** The live game state (an effect changes items through the units below, and the corporation's own figures directly). */
  readonly state: Pick<GameState, 'inventory' | 'corporation'>;
  /** Moves items in and out of the inventory. */
  readonly inventory: Inventory;
  /** Randomness (inject a seeded one in tests). */
  readonly random: RandomSource;
  /** The rarity ids, most common first. */
  readonly rarityIds: readonly string[];
}

/** The two things a kind of effect knows: how to apply a batch of runs, and what makes its configuration valid. */
interface CorporationEffectHandler<E extends CorporationEffect> {
  /**
   * Applies the effect for `runs` completed runs at once.
   *
   * @param effect the configured effect
   * @param runs how many runs completed (a whole number >= 1)
   * @param ctx what the effect may use
   */
  apply(effect: E, runs: number, ctx: CorporationEffectContext): void;
  /**
   * Adds a message to `errors` for everything wrong with the configured effect.
   *
   * @param effect the configured effect
   * @param where how to name the effect in a message
   * @param items the item configuration (to check item ids against)
   * @param errors where the messages go
   */
  validate(effect: E, where: string, items: GameConfig['items'], errors: string[]): void;
}

/** The handlers, one per kind of effect. */
type Registry = { readonly [K in CorporationEffect['kind']]: CorporationEffectHandler<Extract<CorporationEffect, { kind: K }>> };

/**
 * `upgradeRandomItem`: for `runs` runs, the number of runs that upgrade is drawn from the binomial distribution; each upgrade moves one
 * item up one rarity. Which stack gives it up is drawn in one multinomial draw over the stacks that can still be upgraded, weighted by
 * how many each holds as the batch starts (an item upgraded within the batch is not picked again in the same batch: the cost of a
 * batch must not depend on how many runs it holds).
 */
const upgradeRandomItem: CorporationEffectHandler<Extract<CorporationEffect, { kind: 'upgradeRandomItem' }>> = {
  apply(effect, runs, { state, inventory, random, rarityIds }) {
    const upgrades = perRunEvents(runs, effect.chance, random);
    if (upgrades <= 0) return;
    // The highest rarity has nothing to be upgraded to, so it takes no part.
    const upgradable = rarityIds.slice(0, -1);
    const held = upgradable.map((rarity) => state.inventory[effect.itemId]?.[rarity] ?? 0);
    const picks = multinomial(
      Math.min(
        upgrades,
        held.reduce((sum, n) => sum + n, 0),
      ),
      held,
      random,
    );
    for (const [i, wanted] of picks.entries()) {
      // A stack gives what it has, even when the draw names more.
      const taken = inventory.take(effect.itemId, upgradable[i]!, wanted);
      inventory.add(effect.itemId, rarityIds[i + 1]!, taken);
    }
  },
  validate(effect, where, items, errors) {
    const item = items.definitions.find((d) => d.id === effect.itemId);
    if (!item) errors.push(`${where}: upgradeRandomItem refers to unknown item "${effect.itemId}"`);
    else if (item.hasRarity === false)
      errors.push(`${where}: upgradeRandomItem needs an item that has rarities ("${effect.itemId}" has none)`);
    if (items.rarities.length < 2) errors.push(`${where}: upgradeRandomItem needs at least two rarities`);
    if (!(Number.isFinite(effect.chance) && effect.chance > 0 && effect.chance <= 1)) {
      errors.push(`${where}: upgradeRandomItem chance must be in (0, 1]`);
    }
  },
};

/** `acquireStock`: the number of runs that acquire a stock is drawn from the binomial distribution, one stock each. */
const acquireStock: CorporationEffectHandler<Extract<CorporationEffect, { kind: 'acquireStock' }>> = {
  apply(effect, runs, { state, random }) {
    state.corporation.stocks += perRunEvents(runs, effect.chance, random);
  },
  validate(effect, where, _items, errors) {
    if (!(Number.isFinite(effect.chance) && effect.chance > 0 && effect.chance <= 1)) {
      errors.push(`${where}: acquireStock chance must be in (0, 1]`);
    }
  },
};

/** The handlers of every kind of corporation effect. */
export const CORPORATION_EFFECTS: Registry = { upgradeRandomItem, acquireStock };

/**
 * Applies one effect for a batch of completed runs.
 *
 * Called by: `corporation.ts` (`Corporation`). Calls: the handler of the effect's kind.
 *
 * @param effect the configured effect
 * @param runs how many runs completed
 * @param ctx what the effect may use
 */
export function applyCorporationEffect(effect: CorporationEffect, runs: number, ctx: CorporationEffectContext): void {
  (CORPORATION_EFFECTS[effect.kind] as CorporationEffectHandler<CorporationEffect>).apply(effect, runs, ctx);
}

/**
 * Checks one configured effect.
 *
 * Called by: `config.ts` (`validateConfig`). Calls: the handler of the effect's kind.
 *
 * @param effect the configured effect
 * @param where how to name the effect in a message
 * @param items the item configuration
 * @param errors where messages are added
 */
export function validateCorporationEffect(effect: CorporationEffect, where: string, items: GameConfig['items'], errors: string[]): void {
  const handler = CORPORATION_EFFECTS[effect.kind] as CorporationEffectHandler<CorporationEffect> | undefined;
  if (!handler) errors.push(`${where}: unknown effect kind`);
  else handler.validate(effect, where, items, errors);
}
