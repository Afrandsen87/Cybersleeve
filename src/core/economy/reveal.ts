/**
 * @module core
 *
 * Decides when a purchase appears: once its price is close enough to what the player has held.
 */
import type { GameState } from '../types';

/**
 * Raises the recorded peaks to what is held now. The sleeve's peaks only ever go up within a life, so a purchase that has appeared stays
 * even after the credits that revealed it are spent; the wallet's all-time peaks (statistics) only ever go up.
 *
 * Called by: `engine.ts` after anything that can raise credits or nodes (every tick slice, selling, starting an action, test aids).
 * Calls: `BigNum.gt`.
 *
 * @param state state to mutate (`sleeve.peakCredits`, `sleeve.peakNetwork`, `wallet.allTimePeakCredits`, `wallet.allTimePeakNetwork`)
 */
export function notePeaks(state: GameState): void {
  const { wallet, sleeve } = state;
  if (wallet.credits.gt(sleeve.peakCredits)) sleeve.peakCredits = wallet.credits;
  if (sleeve.network.gt(sleeve.peakNetwork)) sleeve.peakNetwork = sleeve.network;
  // the all-time statistics never reset and nothing reads them for gameplay
  if (wallet.credits.gt(wallet.allTimePeakCredits)) wallet.allTimePeakCredits = wallet.credits;
  if (sleeve.network.gt(wallet.allTimePeakNetwork)) wallet.allTimePeakNetwork = sleeve.network;
}
