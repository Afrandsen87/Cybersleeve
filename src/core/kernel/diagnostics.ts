/**
 * @module core
 *
 * A channel for "this should not normally happen" messages, so the core can report them without knowing about consoles.
 */

/** Receives warnings about situations that are legal but lose something (for example, game time that had to be dropped). */
export interface Diagnostics {
  /**
   * Reports one warning.
   * @param message what happened, in a sentence
   */
  warn(message: string): void;
}

/** A {@link Diagnostics} that ignores everything. The default in tests and production builds. */
export const silentDiagnostics: Diagnostics = { warn: () => {} };
