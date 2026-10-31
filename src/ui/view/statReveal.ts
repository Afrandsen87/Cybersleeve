/**
 * @module ui
 *
 * When a sleeve stat row first appears. A stat stays hidden until something exists that produces or boosts it, so the
 * player is never shown a number nothing can change yet.
 *
 * @remarks
 * Called by: `sleeveView.ts`. Calls: the core heat predicates (`actionMakesHeat`, `overclockMakesHeat`), `squareRules.ts`. Pure: no DOM, no state of its own.
 * The rules are data (`REVEAL_RULES`): a new hidden stat adds one entry, it does not add an `if` to the view.
 */
import { type REVEALABLE_STATS, actionMakesHeat, overclockMakesHeat } from '../../core';
import type { ActionDefinition, BuyableDefinition, GameConfig, SleeveStats } from '../../core';
import { numberFactory } from '../../numbers';
import type { RevealTracker } from './revealTracker';
import { type OwnsAutoRun, overclockOnOffer } from './squareRules';

/** The stats that start hidden. */
export type RevealableStat = (typeof REVEALABLE_STATS)[number];

/** What a reveal rule can look at. */
export interface RevealContext {
  readonly config: GameConfig;
  /** The sleeve's access level now (an action is open at or above its `requiredAccessLevel`). */
  readonly accessLevel: number;
  /** Copies owned of a buyable. */
  readonly owned: (buyableId: string) => number;
  /** Whether an action's Auto-run is owned (`ownsAutoRun` of the core). */
  readonly ownsAuto: OwnsAutoRun;
  /** The reveal ledger reader: a stat it already holds is never hidden again (default: no ledger, the rule decides alone). */
  readonly tracker?: RevealTracker;
}

/** Whether an action is open at the current access level. */
const isOpen = (a: ActionDefinition, ctx: RevealContext): boolean => (a.requiredAccessLevel ?? 1) <= ctx.accessLevel;

/** Whether any buyable the player owns has one of the effect kinds. */
const ownsEffect = (ctx: RevealContext, kinds: readonly BuyableDefinition['effect']['kind'][]): boolean =>
  ctx.config.buyables.some((b) => kinds.includes(b.effect.kind) && ctx.owned(b.id) > 0);

/** The Overclock unlock of an action when the player owns it or its cell is shown in the square. */
const overclockUnlockOf = (a: ActionDefinition, ctx: RevealContext): BuyableDefinition | undefined =>
  overclockOnOffer(ctx.config, a.id, ctx.ownsAuto) ??
  ctx.config.buyables.find((b) => b.actionId === a.id && b.effect.kind === 'overclockUnlock' && ctx.owned(b.id) > 0);

/** An owned buyable drops the Burn lead item: a lead only makes sense for heat, so owning the drop reveals heat. */
const ownsBurnLeadDrop = (ctx: RevealContext): boolean => {
  const leadId = ctx.config.items.burnLead?.itemId;
  return (
    leadId !== undefined &&
    ctx.config.buyables.some((b) => b.effect.kind === 'itemDrop' && b.effect.drop.itemId === leadId && ctx.owned(b.id) > 0)
  );
};

/**
 * Heat is made or on offer: an open action that makes heat, an Overclock unlock (owned, or shown in the square) whose overclock makes
 * heat, or an owned Burn lead drop.
 */
const heatExists = (ctx: RevealContext): boolean =>
  ctx.config.actions.some((a) => isOpen(a, ctx) && actionMakesHeat(a)) ||
  ctx.config.actions.some((a) => overclockMakesHeat(a) && overclockUnlockOf(a, ctx) !== undefined) ||
  ownsBurnLeadDrop(ctx);

/** ICE Rating is boosted or earned: an owned buyable that boosts it, or an open action that earns it. */
const iceExists = (ctx: RevealContext): boolean =>
  ownsEffect(ctx, ['iceRatingMultiplier', 'iceRatingFromActionLevel']) ||
  ctx.config.actions.some((a) => isOpen(a, ctx) && a.rewardKind === 'iceRating');

/** Heat and ICE Rating work together (ICE Rating is what cuts the heat tax), so they appear at the same moment: when either exists. */
const heatAndIce = (ctx: RevealContext): boolean => heatExists(ctx) || iceExists(ctx);

/**
 * One rule per stat: `true` once something that produces or boosts the stat is unlocked.
 *
 * - Heat and ICE Rating (linked, one shared rule): an open action that makes heat (`heatPerRun`, `heatPerSecond`), an Overclock
 *   unlock (owned, or shown in the square) whose overclock makes heat (`heatPerMinute`, or the action makes heat itself), an owned buyable that boosts ICE Rating, or an open action that earns it.
 * - Legend: an open action that earns it.
 */
export const REVEAL_RULES: Readonly<Record<RevealableStat, (ctx: RevealContext) => boolean>> = {
  heat: heatAndIce,
  iceRating: heatAndIce,
  legend: (ctx) => ctx.config.actions.some((a) => isOpen(a, ctx) && a.rewardKind === 'legend'),
};

/**
 * Whether a stat is still hidden.
 *
 * Called by: `sleeveRows`. Calls: `RevealTracker.reveals` (a stat the ledger holds stays shown, and a newly shown stat is collected for the ledger).
 *
 * @param stat which stat
 * @param ctx config, access level, ownership and the ledger reader
 * @param hasValue the stat already moved off its starting value (a loaded save never hides a stat that has progressed); for linked
 *   stats (heat and ICE Rating) the caller passes whether ANY of the group has moved
 * @returns `true` when the row should not be shown yet
 */
export function isStatHidden(stat: RevealableStat, ctx: RevealContext, hasValue: boolean): boolean {
  const natural = hasValue || REVEAL_RULES[stat](ctx);
  return !(ctx.tracker ? ctx.tracker.reveals('stat', stat, natural) : natural);
}

/**
 * Whether heat or ICE Rating has already moved off its starting value (they are revealed together, so either one keeps both shown).
 *
 * Called by: `sleeveView.ts`, `branchMask.ts`.
 *
 * @param stats the sleeve stats now
 * @param config game configuration (reads the base ICE Rating)
 */
export function heatOrIceMoved(stats: Pick<SleeveStats, 'heat' | 'iceRatingEarned'>, config: Pick<GameConfig, 'sleeve'>): boolean {
  return stats.heat > 0 || stats.iceRatingEarned.gt(numberFactory.fromNumber(config.sleeve.baseIceRating));
}
