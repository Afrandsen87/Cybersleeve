/**
 * @module ui
 *
 * The fill-in parts of the two XP bar tips (action level XP and sleeve XP): pure types, what the text functions receive.
 *
 * @remarks
 * Built by `ui/view/xpTipView.ts` from owner values (`xpPerRunBreakdown`, `actionXpCurve`, `sleeveXpCurve`, `sleeveXpGrant`); the text is in
 * `ui/tipTextXp.ts`. Re-exported by `uiTextParts.ts`.
 */

/** One factor of the XP per run that is not 1 (a factor equal to 1 is left out, so the player only reads what changes the number). */
export interface XpFactorPart {
  /** Name of the factor as the tip writes it. */
  readonly name: string;
  /** The factor, formatted. */
  readonly value: string;
}

/** The level curve of one XP track: what the next level costs and the numbers behind it. */
export interface XpCurveParts {
  /** The level being worked on now. */
  readonly level: number;
  /** What the first level costs, before delay and reduction. */
  readonly firstLevel: string;
  /** How much more each further level costs. */
  readonly growth: string;
  /** Levels the growth is delayed by (Skill shards), or `null` when there is no delay. */
  readonly delay: string | null;
  /** Share of every level's cost that is taken off in percent, or `null` when nothing is taken off. */
  readonly reductionPercent: string | null;
  /** What leaving the current level costs: the owner's figure, after delay and reduction. */
  readonly next: string;
}

/** Pre-formatted pieces of the tip of an action's level XP bar. */
export interface LevelXpTipParts {
  /** The action's own XP per run. */
  readonly base: string;
  /** The factors that are not 1, in the order they are multiplied. */
  readonly factors: readonly XpFactorPart[];
  /** XP one non-critical run gives (the owner's figure). */
  readonly xpPerRun: string;
  /** What a critical success multiplies the XP by, or `null` while a critical run is not possible. */
  readonly criticalMultiplier: string | null;
  readonly curve: XpCurveParts;
}

/** Pre-formatted pieces of the tip of an action's sleeve XP bar. */
export interface SleeveXpTipParts {
  /** Completed runs of this action that make one grant. */
  readonly runsPerGrant: string;
  /** Sleeve XP one grant gives. */
  readonly xpPerGrant: string;
  readonly curve: XpCurveParts;
}
