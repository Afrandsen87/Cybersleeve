/**
 * @module ui
 *
 * How much faster the Moles held make heat cool once Deep Cover keeps them (for the tips).
 */
import { formatPlain } from '../../numbers';

/**
 * The speed-up in percent that Moles give with Deep Cover, as text: `((1 + bonusPerOrder) ^ log10(moles) - 1) * 100`.
 *
 * Called by: `sleeveView.ts`, `networkView.ts`. Calls: `formatPlain`.
 *
 * @param moleAggregation the skill's bonus per order of magnitude, or `null` while Moles are still spent
 * @param moles Moles held
 * @returns the percent as text, `null` while Moles are still spent, `"0"` for 1 Mole or fewer
 */
export function aggregatedMoleText(moleAggregation: number | null, moles: number): string | null {
  if (moleAggregation === null) return null;
  return formatPlain(moles > 1 ? ((1 + moleAggregation) ** Math.log10(moles) - 1) * 100 : 0);
}
