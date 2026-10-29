/**
 * @module core
 *
 * Decides when a purchase appears: once its price is close enough to what the player has held.
 */
import type { GameState } from '../types';

/**
 * Raises the recorded peaks to what is held now. The peaks only ever go up within a life, so a purchase that has appeared stays
 * even after the credits that revealed it are spent.
 *
 * Called by: `engine.ts` after anything that can raise credits or nodes (every tick slice, selling, starting an action, test aids).
 * Calls: `BigNum.gt`.
 *
 * @param state state to mutate (`peakCredits`, `peakNetwork`)
 */
export function notePeaks(state: GameState): void {
  if (state.credits.gt(state.peakCredits)) state.peakCredits = state.credits;
  if (state.network.gt(state.peakNetwork)) state.peakNetwork = state.network;
}
