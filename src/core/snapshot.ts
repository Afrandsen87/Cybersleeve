/**
 * @module core
 *
 * A short-lived scope in which derived values are computed once.
 */

/**
 * Lets read-only code compute a derived value once per scope instead of once per question.
 *
 * @remarks
 * Building a screen asks the same questions (the sleeve stats, the skill points) from dozens of places. Inside {@link Snapshot.run}
 * the first answer is kept and handed out again; when the outermost scope ends the answers are dropped. Outside any scope
 * {@link Snapshot.memo} just computes, so code that never opens a scope is unaffected.
 *
 * The state must not change inside a scope (no commands, no ticks), or later answers would describe the state before the change.
 *
 * Called by: `engine.ts` (`GameEngine.snapshot`), `stats.ts` and `shop.ts` (`memo`). Side effects: none outside this object.
 */
export class Snapshot {
  private cache: Map<string, unknown> | null = null;
  private depth = 0;

  /**
   * Runs a read-only piece of work in a scope. Scopes may nest; the answers are kept until the outermost one ends, also when it throws.
   *
   * @param read the work; it must not change the game state
   * @returns whatever `read` returns
   */
  run<T>(read: () => T): T {
    if (this.depth++ === 0) this.cache = new Map();
    try {
      return read();
    } finally {
      if (--this.depth === 0) this.cache = null;
    }
  }

  /**
   * The value for a key: computed on the first ask inside a scope, remembered for the rest of it. Outside a scope it computes every time.
   *
   * @param key names the question (the same key must always mean the same computation)
   * @param compute computes the answer
   * @returns the answer
   */
  memo<T>(key: string, compute: () => T): T {
    const cache = this.cache;
    if (cache === null) return compute();
    if (cache.has(key)) return cache.get(key) as T;
    const value = compute();
    cache.set(key, value);
    return value;
  }
}
