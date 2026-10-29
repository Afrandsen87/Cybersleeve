/**
 * @module core
 *
 * Random draws for events that happen once per run, computed for a whole batch of runs at once.
 *
 * @remarks
 * Runs are applied in closed-form batches (a long tick can hold millions of runs), so chance cannot be rolled run by
 * run. Instead the number of successes among `n` runs is drawn directly from the binomial distribution, and a number
 * of drops is split over categories with a multinomial draw. Small batches are exact; large batches use the standard
 * Poisson and normal approximations, which are indistinguishable at those sizes. All randomness comes from an injected
 * {@link RandomSource}, so tests can make every draw deterministic.
 */

/** A source of numbers in [0, 1). `Math.random` satisfies it; tests inject a seeded one. */
export type RandomSource = () => number;

/** Batches up to this many trials are drawn exactly, trial by trial. */
const EXACT_LIMIT = 1_000;
/** Expected successes below this use the Poisson approximation; above it the normal one. */
const POISSON_LIMIT = 30;

/** Most steps a Poisson draw takes. */
const POISSON_CAP = 1_000;

/** A uniform number in (0, 1], so its logarithm is always finite. */
const open = (random: RandomSource): number => 1 - random();

/** A standard normal draw (Box-Muller). */
function standardNormal(random: RandomSource): number {
  return Math.sqrt(-2 * Math.log(open(random))) * Math.cos(2 * Math.PI * random());
}

/** A Poisson draw with a small mean (Knuth's method). */
function poisson(mean: number, random: RandomSource): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let product = open(random);
  // The cap only matters for a broken source that never gets small (e.g. a constant); a mean below 30 never gets near it.
  while (product > limit && k < POISSON_CAP) {
    k++;
    product *= open(random);
  }
  return k;
}

/**
 * The number of successes in `trials` independent trials that each succeed with probability `chance`.
 *
 * @remarks
 * Exact for up to 1000 trials; beyond that the Poisson (mean below 30) or normal approximation, clamped to `0..trials`.
 * Called by: {@link perRunEvents}, {@link multinomial}.
 *
 * @param trials number of trials (a whole number >= 0; non-finite or negative counts as 0)
 * @param chance probability of one success (clamped into 0..1; NaN counts as 0)
 * @param random randomness
 * @returns a whole number in `0..trials`
 */
export function binomial(trials: number, chance: number, random: RandomSource): number {
  const n = Number.isFinite(trials) ? Math.floor(trials) : 0;
  if (n <= 0 || !(chance > 0)) return 0;
  if (chance >= 1) return n;
  if (n <= EXACT_LIMIT) {
    let hits = 0;
    for (let i = 0; i < n; i++) if (random() < chance) hits++;
    return hits;
  }
  // Work with the rarer side, so the approximation is always applied to a small probability when it can be.
  if (chance > 0.5) return n - binomial(n, 1 - chance, random);
  const mean = n * chance;
  const drawn = mean < POISSON_LIMIT ? poisson(mean, random) : Math.round(mean + Math.sqrt(mean * (1 - chance)) * standardNormal(random));
  return Math.min(n, Math.max(0, drawn));
}

/**
 * How many of a batch of `runs` completed runs trigger an event that each run triggers with probability `chance`.
 *
 * @remarks
 * The one entry point for a per-run chance applied to a batch (item drops, linked payouts, heat, stocks, upgrades, critical
 * successes, shard drops). Exactly one {@link binomial} draw per call: no draw at all for no runs, no chance or a certain chance, so
 * one long tick and many short ones agree in distribution and the random source is consumed once per batch.
 * Called by: `items/drops.ts`, `actions/linkedPayouts.ts`, `actions/actionRunner.ts`, `corporation/corporationEffects.ts`,
 * `crits/zeroDays.ts`, `crits/critical.ts`. Calls: {@link binomial}.
 *
 * @param runs number of runs in the batch (a whole number >= 0; non-finite or negative counts as 0)
 * @param chance probability that one run triggers the event (clamped into 0..1; NaN counts as 0)
 * @param random randomness
 * @returns a whole number in `0..runs`
 */
export function perRunEvents(runs: number, chance: number, random: RandomSource): number {
  return binomial(runs, chance, random);
}

/**
 * Splits `total` items over categories with the given relative weights.
 *
 * @remarks
 * Drawn as a chain of binomials (each category takes its share of what is left), so the counts always add up to `total`.
 * Called by: `drops.ts`.
 *
 * @param total number of items to place (a whole number >= 0)
 * @param weights relative weight per category (negative and NaN count as 0)
 * @param random randomness
 * @returns the count per category, in the order of `weights`; all zeros when every weight is 0
 */
export function multinomial(total: number, weights: readonly number[], random: RandomSource): number[] {
  const clean = weights.map((w) => (w > 0 && Number.isFinite(w) ? w : 0));
  const counts = clean.map(() => 0);
  let remaining = total;
  let weightLeft = clean.reduce((sum, w) => sum + w, 0);
  // The last category with weight takes whatever is left: judged by position, not by the running sum, which floating-point
  // residue can leave a hair above 0.
  const lastWeighted = clean.findLastIndex((w) => w > 0);
  for (let i = 0; i < clean.length && remaining > 0 && weightLeft > 0; i++) {
    const w = clean[i]!;
    const last = i === lastWeighted;
    const count = last ? remaining : binomial(remaining, w / weightLeft, random);
    counts[i] = count;
    remaining -= count;
    weightLeft -= w;
  }
  return counts;
}
