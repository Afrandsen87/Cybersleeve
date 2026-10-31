/**
 * @module testing
 *
 * Invariants of the wallet's records: finished runs, synthetic sleeves and the corporation.
 */
import { isKnownRevealKey } from '../../core';
import { type InvariantCheck, validAmount, validCount } from './shared';

/**
 * Runs have valid income and level totals; synthetic sleeves point at recorded runs within the copy limit including dormant sleeves without their skill;
 * every corporation action has a state with valid progress.
 *
 * Called by: `testing/invariants.ts`. Calls: nothing.
 */
export const checkWallet: InvariantCheck = (state, config, problems) => {
  state.wallet.runs.forEach((run, i) => {
    if (!validAmount(run.creditsPerSecond)) problems.push(`run ${i} has an invalid income: ${run.creditsPerSecond.toString()}`);
    if (!validCount(run.actionLevelsTotal)) problems.push(`run ${i} has an invalid level total: ${run.actionLevelsTotal}`);
  });
  // Cloning Vats (`synthsPerResleeve`) gives several copies of the run that just ended, so a run may have up to the largest count in the content
  const copiesAllowed = Math.max(1, ...config.buyables.map((b) => (b.effect.kind === 'synthsPerResleeve' ? b.effect.count : 1)));
  const copies = new Map<number, number>();
  for (const synth of state.wallet.synths) {
    if (!(Number.isInteger(synth.runIndex) && synth.runIndex >= 0 && synth.runIndex < state.wallet.runs.length))
      problems.push(`a synthetic sleeve points at a run that does not exist: ${synth.runIndex}`);
    const n = (copies.get(synth.runIndex) ?? 0) + 1;
    if (n === copiesAllowed + 1) problems.push(`more than ${copiesAllowed} synthetic sleeves copy run ${synth.runIndex}`);
    copies.set(synth.runIndex, n);
  }
  // the reveal ledger: a set of keys that name something that exists (resolved by id)
  const revealed = state.wallet.revealed;
  if (new Set(revealed).size !== revealed.length) problems.push('the reveal ledger holds a key twice');
  for (const key of revealed) if (!isKnownRevealKey(key, config.buyables)) problems.push(`the reveal ledger holds an unknown key: ${key}`);
  for (const def of config.corporation?.actions ?? []) {
    const action = state.wallet.corporation.actions[def.id];
    if (!action) problems.push(`corporation action ${def.id} has no state`);
    else if (!(Number.isFinite(action.progress) && action.progress >= 0 && action.progress < 1))
      problems.push(`corporation action ${def.id} has progress outside [0, 1): ${action.progress}`);
    else if (!action.running && action.progress !== 0)
      problems.push(`corporation action ${def.id} is idle but has progress ${action.progress}`);
  }
};
