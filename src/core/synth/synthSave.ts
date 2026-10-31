/**
 * @module core
 *
 * The synthetic sleeves' part of a save (wallet `synths`).
 */
import { isRecord } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameState, Wallet } from '../types';

/**
 * Reads synthetic sleeves pointing at existing runs, including dormant sleeves while their skill is unowned.
 *
 * Called by: {@link synthSavePart}. Calls: nothing.
 */
export function readSynths(v: unknown, state: GameState): Wallet['synths'] {
  if (!Array.isArray(v)) return [];
  const out: Wallet['synths'] = [];
  for (const entry of v) {
    const index = isRecord(entry) ? entry['runIndex'] : undefined;
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < state.wallet.runs.length)
      out.push({ runIndex: index });
  }
  return out;
}

/**
 * The synths part. Must be read after the runs; ownership gates effects, never persisted records.
 *
 * Called by: `save/saveParts.ts`. Calls: {@link readSynths}.
 */
export const synthSavePart: SavePart<unknown> = {
  name: 'synths',
  write: (state) => ({ wallet: { synths: state.wallet.synths.map((s) => ({ runIndex: s.runIndex })) } }),
  read: (state, raw) => {
    state.wallet.synths = readSynths(raw.wallet['synths'], state);
  },
};
