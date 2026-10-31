/**
 * @module core
 *
 * Context: economy. The save part of the reveal ledger (`wallet.revealed`) and its migration piece.
 *
 * @remarks
 * Called by: `save/saveParts.ts`, and `save/migrate.ts` through {@link addRevealedLedger}.
 * A save without the field loads with an empty ledger, so adding it needs no version change on its own; an empty ledger is left out of the text.
 */
import { isRecord } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import type { GameConfig } from '../types';
import { isKnownRevealKey } from './revealLedger';

/**
 * Reads the ledger from a saved wallet: strings that name something known, each once, in saved order (anything else is dropped).
 *
 * Called by: {@link revealedSavePart}. Calls: `isKnownRevealKey`.
 */
export function readRevealed(v: unknown, buyables: GameConfig['buyables']): string[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<string>();
  for (const key of v) if (typeof key === 'string' && isKnownRevealKey(key, buyables)) out.add(key);
  return [...out];
}

/**
 * The ledger part. Called by: `save/saveParts.ts`. Calls: {@link readRevealed}.
 */
export const revealedSavePart: SavePart<Pick<GameConfig, 'buyables'>> = {
  name: 'revealed',
  write: (state) => (state.wallet.revealed.length > 0 ? { wallet: { revealed: [...state.wallet.revealed] } } : {}),
  read: (state, raw, config) => {
    state.wallet.revealed = readRevealed(raw.wallet['revealed'], config.buyables);
  },
};

/**
 * Migration piece for the next save version: gives a parsed save a `wallet.revealed = []` when it has none. Pure; returns a new object and
 * leaves an existing ledger alone. Wired into `migrate.ts` (`migrateV8`).
 *
 * Called by: `save/migrate.ts` (`migrateV8`). Calls: `isRecord`.
 *
 * @param save a parsed save (untrusted)
 * @returns the save with a wallet that has a `revealed` array (a save that is not an object, or has no wallet object, is returned as it is)
 */
export function addRevealedLedger(save: unknown): unknown {
  if (!isRecord(save) || !isRecord(save['wallet'])) return save;
  if (Array.isArray(save['wallet']['revealed'])) return save;
  return { ...save, wallet: { ...save['wallet'], revealed: [] } };
}
