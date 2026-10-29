/**
 * @module core
 *
 * Shifting item drop ratios towards the rarer rarities.
 */

/**
 * Most shift steps worth computing. Each step moves 1% (or whatever the fraction is) of every weight on, so after this many
 * steps almost nothing is left outside the last rarity and further steps change nothing visible; the cap only bounds the loop
 * for absurdly large proficiency.
 */
const MAX_STEPS = 10_000;

/**
 * Shifts drop weights towards the last rarity, one step per order of magnitude.
 *
 * @remarks
 * One step moves `fraction` of EACH weight to the next rarity. The amounts moved are all worked out from the weights as they
 * stand before the step, and then applied at once, so a rarity that starts at 0 passes nothing on in the step in which it
 * first receives something: with weights 90/9/1/0/0 and a fraction of 0.01 the first step gives 89.1/9.81/1.08/0.01/0, and
 * only the second step moves anything into the last rarity. The last rarity has nothing to move to and keeps what it has.
 * The total never changes.
 *
 * Called by: `stats.ts` (`DerivedStats.itemDrops`).
 *
 * @param weights relative weight per rarity, most common first
 * @param steps how many steps to take (a whole number >= 0)
 * @param fraction share of each weight moved per step (0..1)
 * @returns the shifted weights (a new array)
 */
export function shiftWeights(weights: readonly number[], steps: number, fraction: number): number[] {
  let current = [...weights];
  const last = current.length - 1;
  for (let step = 0; step < Math.min(steps, MAX_STEPS); step++) {
    const moved = current.map((w, i) => (i < last ? w * fraction : 0)); // all worked out up front
    if (moved.every((m) => m === 0)) break;
    current = current.map((w, i) => w - moved[i]! + (i > 0 ? moved[i - 1]! : 0)); // then applied at once
  }
  return current;
}
