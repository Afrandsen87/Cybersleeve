import type { TipTerm } from './actionTipParts';

/** The curve that turns Hacking Proficiency into the hacking multiplier (see `sleeve.earnedSpeedScale` and `earnedSpeedExponent`). */
export interface HackingCurve {
  readonly scale: number;
  readonly exponent: number;
  /** The shape of the curve past a knee, when it has a second one that differs from `exponent` (`sleeve.earnedSpeedKnee` and `earnedSpeedExponentBeyond`). */
  readonly beyond?: { readonly knee: number; readonly exponent: number };
}

/** Pre-formatted pieces of the interface speed explanation. */
export interface InterfaceSpeedTipParts {
  /** Interface speed of a new sleeve. */
  readonly base: string;
  /** What the owned boosts add to the base. */
  readonly boosts: string;
  /** `null` while no network-based purchase is owned. */
  readonly networkFactor: string | null;
  /** Nodes owned (what the node bonus is computed from). */
  readonly nodes: string;
  /** The hacking multiplier (`1 +` the curve applied to Hacking Proficiency). */
  readonly hackingMultiplier: string;
  readonly curve: HackingCurve;
  /** Factor from skills, or `null` while there is none. */
  readonly skillFactor: string | null;
  readonly total: string;
}

/** Pre-formatted pieces of the Hacking Proficiency explanation. */
export interface HackingProficiencyTipParts {
  /** Hacking Proficiency: what hacking has paid out so far, before the curve. */
  readonly proficiency: string;
  /** The Hacking Multiplier it gives. */
  readonly hackingMultiplier: string;
  readonly curve: HackingCurve;
}

/** Pre-formatted pieces of the Access Level explanation. */
export interface AccessTipParts {
  /** Access level of a new sleeve. */
  readonly start: string;
  /** What purchases have added to it. */
  readonly purchases: string;
  /** Access level now. */
  readonly level: string;
  /** The next action that opens with a higher level, or `null` when every action is open. */
  readonly next: { readonly name: string; readonly level: string } | null;
}

/** Pre-formatted pieces of the heat explanation. */
export interface HeatTipParts {
  readonly heat: string;
  /** Tax one point of heat takes, in percent. */
  readonly perPointPercent: string;
  /** Share of the heat's effect removed by ICE Rating, in percent. */
  readonly reductionPercent: string;
  /** Resulting tax in percent. */
  readonly taxPercent: string;
  /** Heat at which credits stop, e.g. `"200 heat"`, or `null` when they never do. */
  readonly stopsAt: string | null;
  /** With Blackout: the most the tax can take, in percent; `null` without a cap. */
  readonly taxCapPercent: string | null;
  /** Heat removed per cooldown cycle. */
  readonly amount: string;
  /** Length of one cooldown cycle in seconds (Legend and skills included). */
  readonly cycleSeconds: string;
  /** Moles held and the extra speed they give in percent, or `null` while there are none. */
  readonly moles: { readonly moles: string; readonly boostPercent: string; readonly aggregatedPercent: string | null } | null;
}

/** Pre-formatted pieces of the ICE Rating explanation. */
export interface IceRatingTipParts {
  /** ICE Rating earned by runs. */
  readonly earned: string;
  /** Base ICE Rating that purchases add per action level, or `null` when there is none. */
  readonly levelBonus: string | null;
  /** Name of the purchase(s) that give {@link levelBonus}, e.g. `"Hardened payload"`. */
  readonly levelBonusSource: string;
  /** The purchases that multiply ICE Rating, one named factor each (empty when none is owned). */
  readonly multipliers: readonly TipTerm[];
  /** ICE Rating now. */
  readonly total: string;
  readonly orders: string;
  readonly perOrderPercent: string;
  readonly reductionPercent: string;
  /** Where the reduction reaches 100%, e.g. `"1e200"`, or `null` when it never does. */
  readonly fullAt: string | null;
}

/** Pre-formatted pieces of the Legend explanation. */
export interface LegendTipParts {
  /** Legend points held. */
  readonly legend: string;
  /** Length of a heat cooldown cycle without Legend, in seconds. */
  readonly baseSeconds: string;
  /** How much faster one point of Legend makes a cycle, in percent. */
  readonly speedupPercent: string;
  /** Length of a heat cooldown cycle now, in seconds. */
  readonly cycleSeconds: string;
  /** Minutes until Legend falls by 1. */
  readonly decayMinutes: string;
}
