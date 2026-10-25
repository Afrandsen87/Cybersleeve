import { describe, expect, it } from 'vitest';
import { claimGame, GAME_LOCK, type LockManagerLike } from './tabGuard';

/** A lock manager that grants a named lock to the first requester only, and holds it for good. */
function fakeLocks(): LockManagerLike {
  const held = new Set<string>();
  return {
    request(name, _options, callback) {
      if (held.has(name)) return callback(null) as Promise<unknown>;
      held.add(name);
      const done = callback({ name });
      return done;
    },
  };
}

describe('claimGame', () => {
  it('gives the game to the first tab and tells every later tab it is taken, before they start', async () => {
    const locks = fakeLocks();
    expect(await claimGame(locks)).toBe('owner');
    expect(await claimGame(locks)).toBe('taken');
    expect(await claimGame(locks)).toBe('taken');
  });

  it('asks for one fixed lock name without waiting for it', async () => {
    const seen: { name: string; options: unknown }[] = [];
    await claimGame({
      request: (name, options, callback) => {
        seen.push({ name, options });
        return callback(null);
      },
    });
    expect(seen).toEqual([{ name: GAME_LOCK, options: { ifAvailable: true } }]);
  });

  it('reports "unsupported" without a lock manager, or when the request fails', async () => {
    expect(await claimGame(undefined)).toBe('unsupported');
    expect(await claimGame({ request: () => Promise.reject(new Error('blocked')) })).toBe('unsupported');
  });
});
