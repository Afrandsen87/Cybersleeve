/**
 * @module core
 *
 * The synthetic sleeves' part of a save (wallet `synths`).
 */
import { isRecord } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig, GameState, Wallet } from '../types';

/**
 * Reads the synthetic sleeves: only ones that point at a run that exists, and none at all unless the player owns the skill that gives them
 * (a save cannot hand out sleeves).
 *
 * Called by: {@link synthSavePart}. Calls: nothing.
 */
export function readSynths(v: unknown, state: GameState, buyables: GameConfig['buyables']): Wallet['synths'] {
  const unlocked = buyables.some((b) => b.effect.kind === 'synthSleeves' && (state.sleeve.purchased[b.id] ?? 0) > 0);
  if (!unlocked || !Array.isArray(v)) return [];
  const out: Wallet['synths'] = [];
  for (const entry of v) {
    const index = isRecord(entry) ? entry['runIndex'] : undefined;
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < state.wallet.runs.length)
      out.push({ runIndex: index });
  }
  return out;
}

/**
 * The synths part. Must be read after the purchases and the runs.
 *
 * Called by: `save/saveParts.ts`. Calls: {@link readSynths}.
 */
export const synthSavePart: SavePart<Pick<GameConfig, 'buyables'>> = {
  name: 'synths',
  write: (state) => ({ wallet: { synths: state.wallet.synths.map((s) => ({ runIndex: s.runIndex })) } }),
  read: (state, raw, config) => {
    state.wallet.synths = readSynths(raw.wallet['synths'], state, config.buyables);
  },
};
