/**
 * @module core
 *
 * The owned buyables' part of a save (sleeve `purchased`, wallet `lastLifePurchases`).
 *
 * @remarks
 * Kept in `save/` rather than in a context: `purchased` is read against the effect caps and the re-sleeve action-card rule, and every other part
 * depends on it, so it is the one part that belongs to the state core.
 */
import { BuyableCaps } from '../effects/buyableCaps';
import { isRecord, readCount } from '../kernel/readValues';
import type { SavePart } from '../kernel/savePart';
import { isActionCardPurchase } from '../resleeve/resleeveCarry';
import type { GameConfig, GameState, SleeveState } from '../types';

/** Removes owned buyables whose requirements are not owned, until the state is consistent (a save cannot skip a gate). */
function dropUnmetRequirements(purchased: SleeveState['purchased'], buyables: GameConfig['buyables']): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of buyables) {
      if ((purchased[b.id] ?? 0) > 0 && ![...(b.requires ?? []), ...(b.parents ?? [])].every((r) => (purchased[r] ?? 0) > 0)) {
        delete purchased[b.id];
        changed = true;
      }
    }
  }
}

/**
 * Reads the owned buyables and last life's purchases (a wallet field that is judged against them): copy counts are capped, a buyable whose
 * `requires` or `parents` are not owned is dropped, and only action-card purchases that exist are kept for Reflex Archive.
 */
function readPurchases(state: GameState, rawPurchased: unknown, rawLastLife: unknown, buyables: GameConfig['buyables']): void {
  const owned: Record<string, number> = {};
  if (isRecord(rawPurchased)) for (const [id, n] of Object.entries(rawPurchased)) owned[id] = readCount(n);
  const purchased = state.sleeve.purchased;
  const caps = new BuyableCaps(buyables);
  for (const b of buyables) {
    const count = Math.min(owned[b.id] ?? 0, caps.maxCopies(b, owned), Number.MAX_SAFE_INTEGER);
    if (count > 0) purchased[b.id] = count;
  }
  dropUnmetRequirements(purchased, buyables);
  // last life's purchases: only action-card purchases that exist, whole counts, never above what could have been owned
  const savedLastLife = isRecord(rawLastLife) ? rawLastLife : {};
  for (const b of buyables) {
    const count = Math.min(readCount(savedLastLife[b.id]), caps.maxCopies(b, purchased), Number.MAX_SAFE_INTEGER);
    if (count > 0 && isActionCardPurchase(b)) state.wallet.lastLifePurchases[b.id] = count;
  }
  // a skill dropped above may have been the one that allowed the extra copies of another buyable
  for (const b of buyables) {
    const count = purchased[b.id] ?? 0;
    if (count > caps.maxCopies(b, purchased)) purchased[b.id] = caps.maxCopies(b, purchased);
  }
}

/**
 * The purchases part. Read before every part that checks an unlock.
 *
 * Called by: `save/saveParts.ts`. Calls: `BuyableCaps`, `isActionCardPurchase`.
 */
export const purchasesSavePart: SavePart<Pick<GameConfig, 'buyables'>> = {
  name: 'purchases',
  write: (state) => ({
    wallet: { lastLifePurchases: { ...state.wallet.lastLifePurchases } },
    sleeve: { purchased: { ...state.sleeve.purchased } },
  }),
  read: (state, raw, config) => readPurchases(state, raw.sleeve['purchased'], raw.wallet['lastLifePurchases'], config.buyables),
};
