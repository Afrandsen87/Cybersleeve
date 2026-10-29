/**
 * @module core
 *
 * The hook a context implements to write and read its own part of a save.
 *
 * @remarks
 * `save/serialization.ts` only composes the parts listed in `save/saveParts.ts`; it knows no context's data. A part writes fragments of the wallet and
 * of the sleeve (the save keeps both as objects) and reads from the same two raw objects, defensively: it turns what it cannot use into the neutral
 * value. Lives in the kernel so that a context can define a part without importing `save/`.
 */
import type { NumberFactory } from '../../numbers';
import type { GameState, GameStateView } from '../types';

/** Id of the only sleeve (and the only corporation) in a save: both are saved as maps keyed by id, with one entry under this id. */
export const DEFAULT_SLEEVE_ID = 'main';

/** One object of a save, as parsed (untrusted). */
export type RawSection = Readonly<Record<string, unknown>>;

/** What a part writes: keys to add to the saved wallet and to the saved sleeve (plain data, numbers as strings). */
export interface SaveFragments {
  readonly wallet?: Record<string, unknown>;
  readonly sleeve?: Record<string, unknown>;
}

/** The saved wallet and the saved sleeve a part reads from. */
export interface RawSave {
  readonly wallet: RawSection;
  readonly sleeve: RawSection;
}

/**
 * A context's saved part.
 *
 * Called by: `save/serialization.ts` (through `save/saveParts.ts`). Calls: the context's own types and helpers.
 *
 * @typeParam C the part of the game content its `read` needs
 */
export interface SavePart<C> {
  /** Unique name (for tests and error messages). */
  readonly name: string;
  /**
   * Writes the part.
   *
   * @param state the state to save (not changed)
   * @returns the keys it adds to the saved wallet and sleeve
   */
  write(state: GameStateView): SaveFragments;
  /**
   * Reads the part into a freshly created state, defensively. Runs in the order of `SAVE_PARTS`: a part may rely on what an earlier one read
   * (a toggle needs its unlock, a key toggle needs the key held).
   *
   * @param state the state being restored (changed)
   * @param raw the saved wallet and sleeve
   * @param config game content
   * @param factory number factory
   * @throws Error if a required value is unusable (the save is then rejected)
   */
  read(state: GameState, raw: RawSave, config: C, factory: NumberFactory): void;
}
