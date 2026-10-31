/**
 * @module core
 *
 * Context: economy (purchase reveal). The reveal ledger: what the player has ever been shown, so it never goes away again.
 *
 * @remarks
 * `wallet.revealed` is a set kept as an array of typed keys: `stat:<id>` (a sleeve stat row), `tab:<id>` (a tab), `skill:<id>` (a skill
 * made readable) and `buyable:<id>` (a purchase shown). It survives re-sleeving (`CARRIED_OVER_WALLET_FIELDS`). The ledger only
 * ever grows. Queries never write it: the view build collects the keys it shows (`ui/view/revealTracker.ts`) and the UI calls the engine
 * command `noteRevealed` once, only when a key is new. Readers (UI) keep a noted thing shown; a skill or purchase whose requirements are
 * no longer met is shown faded and cannot be bought (the rule that decides buying stays `Shop.isAvailable`).
 *
 * Called by: `engine.ts` (`noteRevealed`), `testing/invariantChecks/wallet.ts`, `ui/view/revealTracker.ts`, `ui/view/statReveal.ts`.
 * Calls: nothing outside this file.
 */
import type { BuyableDefinition, GameConfig, StateSlice } from '../types';

/** The stats that start hidden (one `stat:` key each): three sleeve stat rows and the top bar's income rate. */
export const REVEALABLE_STATS = ['heat', 'iceRating', 'legend', 'incomeRate'] as const;

/** The tabs (one `tab:` key each). */
export const TAB_IDS = ['character', 'skills', 'automation', 'stats', 'corporation'] as const;

/** The kinds of thing the ledger remembers. */
export const REVEAL_KINDS = ['stat', 'tab', 'skill', 'buyable'] as const;

/** One kind of ledger key. */
export type RevealKind = (typeof REVEAL_KINDS)[number];

/**
 * The ledger key of a thing.
 *
 * Called by: `ui/view/` readers, tests. Calls: nothing.
 *
 * @param kind what sort of thing
 * @param id its id (a stat id, tab id or buyable id)
 * @returns e.g. `stat:heat`
 */
export function revealKey(kind: RevealKind, id: string): string {
  return `${kind}:${id}`;
}

/**
 * Whether a key names something that exists: a known stat or tab, or a buyable of the content (resolved by id, so content that moves between
 * files or branches does not matter).
 *
 * Called by: {@link noteRevealed}, `readRevealed`, the wallet invariant. Calls: nothing.
 *
 * @param key a ledger key
 * @param buyables the content's purchases
 */
export function isKnownRevealKey(key: string, buyables: readonly Pick<BuyableDefinition, 'id'>[]): boolean {
  const at = key.indexOf(':');
  if (at < 0) return false;
  const id = key.slice(at + 1);
  switch (key.slice(0, at)) {
    case 'stat':
      return (REVEALABLE_STATS as readonly string[]).includes(id);
    case 'tab':
      return (TAB_IDS as readonly string[]).includes(id);
    case 'skill':
    case 'buyable':
      return buyables.some((b) => b.id === id);
    default:
      return false;
  }
}

/**
 * Adds keys to the ledger. Keys already in it, repeated keys and keys that name nothing known are ignored.
 *
 * Called by: `GameEngine.noteRevealed`. Calls: {@link isKnownRevealKey}.
 *
 * @param state state to mutate (`wallet.revealed`)
 * @param config content (decides which ids exist)
 * @param keys the keys the view showed
 * @returns how many keys were new
 */
export function noteRevealed(state: StateSlice<'revealed'>, config: Pick<GameConfig, 'buyables'>, keys: readonly string[]): number {
  const have = new Set(state.wallet.revealed);
  let added = 0;
  for (const key of keys) {
    if (have.has(key) || !isKnownRevealKey(key, config.buyables)) continue;
    have.add(key);
    state.wallet.revealed.push(key);
    added++;
  }
  return added;
}
