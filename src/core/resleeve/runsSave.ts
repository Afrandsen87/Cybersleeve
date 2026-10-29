/**
 * @module core
 *
 * The record of finished runs' part of a save (wallet `runs`).
 */
import type { BigNum, NumberFactory } from '../../numbers';
import { INFINITY } from '../kernel/infinity';
import { isRecord, readAmount, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { Wallet } from '../types';

/**
 * Reads the record of finished runs. An entry that cannot be read becomes a run that earned nothing (rather than being dropped), so the
 * runs keep their positions and the synthetic sleeves that point at them still point at the right run.
 *
 * Called by: {@link runsSavePart}. Calls: `readAmount`, `readCount`.
 *
 * @param v the stored value
 * @param factory number factory
 * @param infinity cap on a saved action level
 */
export function readRuns(v: unknown, factory: NumberFactory, infinity: number): Wallet['runs'] {
  if (!Array.isArray(v)) return [];
  return v.map((entry): Wallet['runs'][number] => {
    if (!isRecord(entry)) return { creditsPerSecond: factory.fromNumber(0), actionLevelsTotal: 0 };
    let creditsPerSecond: BigNum;
    try {
      creditsPerSecond = readAmount(entry['creditsPerSecond'], factory);
    } catch {
      creditsPerSecond = factory.fromNumber(0);
    }
    const saved = entry['actionLevels'];
    const actionLevels: Record<string, number> = {};
    if (isRecord(saved)) for (const [id, level] of Object.entries(saved)) actionLevels[id] = Math.min(readCount(level), infinity);
    return {
      creditsPerSecond,
      actionLevelsTotal: readCount(entry['actionLevelsTotal']),
      ...(isRecord(saved) ? { actionLevels } : {}),
    };
  });
}

/**
 * The finished-runs part. Must be read before the synths (they point at runs).
 *
 * Called by: `save/saveParts.ts`. Calls: {@link readRuns}.
 */
export const runsSavePart: SavePart<unknown> = {
  name: 'runs',
  write: (state) => ({
    wallet: {
      runs: state.wallet.runs.map((r) => ({
        creditsPerSecond: r.creditsPerSecond.toString(),
        actionLevelsTotal: r.actionLevelsTotal,
        ...(r.actionLevels ? { actionLevels: { ...r.actionLevels } } : {}),
      })),
    },
  }),
  read: (state, raw, _config, factory) => {
    state.wallet.runs = readRuns(raw.wallet['runs'], factory, INFINITY);
  },
};
