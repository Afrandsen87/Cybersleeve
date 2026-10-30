/**
 * @module core
 *
 * "Does the player own a buyable of effect kind X?" in one place.
 *
 * Purpose: five files each wrote `buyables.some(b => b.effect.kind === kind && purchased[b.id] > 0)` for their own kind. This is the
 * single owner of that rule; a context asks it instead of re-implementing it.
 * Called by: `synth/synthSleeves.ts`, `resleeve/resleeveCarry.ts`, `resleeve/reflexArchive.ts`, `corporation/corporation.ts`.
 * Calls: nothing (pure).
 */
import type { BuyableDefinition, BuyableEffect } from '../types';

/** The kind names of {@link BuyableDefinition} effects. */
export type EffectKind = BuyableDefinition['effect']['kind'];

/** A buyable whose effect is known to be of kind `K`, with the copies owned (0 when only the definition was asked for). */
export interface KindedBuyable<K extends EffectKind> {
  readonly buyable: BuyableDefinition;
  /** The buyable's effect, narrowed to its kind. */
  readonly effect: Extract<BuyableEffect, { kind: K }>;
  readonly owned: number;
}

/**
 * Every buyable of one effect kind, with its effect narrowed to that kind, whatever is owned (`owned` is 0).
 *
 * @remarks
 * The typed replacement for `buyables.filter(b => b.effect.kind === kind)`: a query function instead of a comparison of kind names,
 * so the narrowing happens once here.
 * Called by: `effects/buyableCaps.ts`, {@link ownedEffects}. Calls: nothing (pure).
 *
 * @param buyables every buyable definition of the content
 * @param kind the effect kind to look for
 * @returns the buyables of that kind, in configuration order
 */
export function effectsOfKind<K extends EffectKind>(buyables: readonly BuyableDefinition[], kind: K): KindedBuyable<K>[] {
  const found: KindedBuyable<K>[] = [];
  for (const buyable of buyables) {
    if (buyable.effect.kind === kind) found.push({ buyable, effect: buyable.effect as Extract<BuyableEffect, { kind: K }>, owned: 0 });
  }
  return found;
}

/**
 * The buyables of one effect kind of which at least one copy is owned, with the copies.
 *
 * Called by: `effects/queries.ts`. Calls: {@link effectsOfKind}.
 *
 * @param buyables every buyable definition of the content
 * @param purchased copies owned per buyable id (`GameState.purchased`)
 * @param kind the effect kind to look for
 * @returns the owned buyables of that kind (`owned` >= 1), in configuration order
 */
export function ownedEffects<K extends EffectKind>(
  buyables: readonly BuyableDefinition[],
  purchased: Readonly<Record<string, number>>,
  kind: K,
): KindedBuyable<K>[] {
  return effectsOfKind(buyables, kind).flatMap((k) => {
    const owned = purchased[k.buyable.id] ?? 0;
    return owned > 0 ? [{ ...k, owned }] : [];
  });
}

/**
 * Id of the buyable that opens sleeve levels and re-sleeving (the one with the `unlockSleeveLevels` effect). Lives here, below both,
 * because `Progression` (actions) and `ResleeveGate` (resleeve) read the same rule.
 *
 * Called by: `resleeve/resleeveGate.ts`, `actions/progression.ts`. Calls: nothing (pure).
 *
 * @param buyables the content
 * @returns its id, or `null` when the content has none (no gate)
 */
export function sleeveLevelsGateId(buyables: readonly BuyableDefinition[] | undefined): string | null {
  return buyables?.find((b) => b.effect.kind === 'unlockSleeveLevels')?.id ?? null;
}

/**
 * True when at least one copy of a buyable with this effect kind is owned.
 *
 * @param buyables every buyable definition of the content
 * @param purchased copies owned per buyable id (`GameState.purchased`)
 * @param kind the effect kind to look for
 * @returns whether any buyable of that kind has a count above 0
 */
export function ownsKind(buyables: readonly BuyableDefinition[], purchased: Readonly<Record<string, number>>, kind: EffectKind): boolean {
  return buyables.some((b) => b.effect.kind === kind && (purchased[b.id] ?? 0) > 0);
}
