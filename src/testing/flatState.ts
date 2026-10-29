/**
 * Test aid: a flat, writable view of the game state.
 *
 * Purpose: the state is nested (`wallet`, `sleeve`) and read-only to callers; many tests only want to set one field (credits, network, heat, an
 * action's XP, the inventory) and should not care which part holds it. `flat<T>(engine)` returns an object that reads and writes the named fields
 * of whichever part has them, typed as the `T` the test spells out.
 * Called by: tests and the kits in this folder. Calls: nothing (works on any engine exposing `getState()`).
 */

/** An engine, or anything else that hands out the live state. */
interface StateSource {
  getState(): unknown;
}

/** The two parts a flat view reads and writes through. */
interface Parts {
  wallet: Record<string, unknown>;
  sleeve: Record<string, unknown>;
}

/**
 * A flat view over the live state: a property is read from, or written to, the wallet when it has that field, otherwise the sleeve.
 *
 * @param source an engine (anything with `getState()`)
 * @returns a proxy typed as `T`; assignments change the real state (nothing is copied)
 */
export function flat<T extends object>(source: StateSource): T {
  const parts = source.getState() as Parts;
  const partOf = (key: string | symbol): Record<string, unknown> =>
    typeof key === 'string' && key in parts.wallet ? parts.wallet : parts.sleeve;
  return new Proxy({} as T, {
    get: (_t, key) => partOf(key)[key as string],
    set: (_t, key, value) => {
      partOf(key)[key as string] = value;
      return true;
    },
    has: (_t, key) => typeof key === 'string' && (key in parts.wallet || key in parts.sleeve),
  });
}
