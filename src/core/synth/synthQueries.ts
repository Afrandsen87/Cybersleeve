/**
 * @module core
 *
 * What other contexts may ask of the synthetic sleeves: how many there are and how much they boost something.
 */

/**
 * The narrow face of the synthetic sleeves. A context that scales with them (the corporation) takes this, never the synth records or
 * the wallet's `synths` list.
 *
 * Called by: `corporation/corporation.ts`. Implemented by: {@link SynthSleeves}.
 */
export interface SynthQueries {
  /** How many synthetic sleeves the player has. */
  count(): number;
  /**
   * The factor an owned `perLn` skill gives from the synthetic sleeves: `(1 + perLn x ln(1 + count)) ^ copies` (the shared `synthBoost`; 1 with no copies or no sleeves).
   *
   * @param perLn the skill's gain per ln of the sleeve count
   * @param copies how many copies of the skill are owned
   * @returns a factor >= 1
   */
  boost(perLn: number, copies: number): number;
}
