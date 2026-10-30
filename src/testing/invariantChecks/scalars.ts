/**
 * @module testing
 *
 * Invariants of the scalar fields, the all-time peaks and the Forensic hardening counts.
 */
import type { BigNum } from '../../numbers';
import { SCALAR_FIELDS, scalarValue } from '../../core';
import { type InvariantCheck, validAmount, validCount } from './shared';

/**
 * Every scalar is finite and >= 0 (amounts also not NaN); the wallet's all-time peaks are never below this life's peaks; each hardening count
 * is a whole number > 0 of a buyable that listens to critical successes and is owned.
 *
 * Called by: `testing/invariants.ts`. Calls: `scalarValue`.
 */
export const checkScalars: InvariantCheck = (state, config, problems) => {
  for (const field of SCALAR_FIELDS) {
    const value = scalarValue(state, field);
    if (field.kind === 'big') {
      if (!validAmount(value as BigNum)) problems.push(`${field.key} is not a valid amount: ${String(value)}`);
    } else if (!Number.isFinite(value as number) || (value as number) < 0) {
      problems.push(`${field.key} is not a finite number >= 0: ${String(value)}`);
    }
  }
  // the wallet's all-time peaks are statistics that only ever go up, so they are never below this life's peaks (which a re-sleeve resets)
  const { wallet, sleeve: life } = state;
  if (wallet.allTimePeakCredits.lt(life.peakCredits)) problems.push("allTimePeakCredits is below this life's peakCredits");
  if (wallet.allTimePeakNetwork.lt(life.peakNetwork)) problems.push("allTimePeakNetwork is below this life's peakNetwork");
  for (const [id, count] of Object.entries(life.hardeningCrits)) {
    const b = config.buyables.find((x) => x.id === id);
    if (!validCount(count) || count < 1) problems.push(`hardeningCrits.${id} is not a whole number >= 1: ${count}`);
    else if (b?.effect.kind !== 'hardenedPayloadFromCrits' || (life.purchased[id] ?? 0) <= 0)
      problems.push(`hardeningCrits.${id} is counted without an owned buyable that listens to critical successes`);
  }
};
