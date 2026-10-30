/**
 * @module core
 *
 * Effects of re-sleeving: synthetic sleeves, the sleeve-level gate and the newer re-sleeve skills.
 *
 * Called by: `effects/kinds/index.ts` (the {@link BuyableEffect} union). Calls: nothing.
 */
import type { ResleeveEffect } from '../../resleeve/resleeveEffectTypes';

/** Effects of re-sleeving: synthetic sleeves, the sleeve-level gate and the newer re-sleeve skills. */
export type ResleeveKindEffect =
  /**
   * Synthetic sleeves: buying it gives one synthetic sleeve (copied from the last finished sleeve-run), and every re-sleeve after that
   * gives one more (copied from the run that just ended). See `synthSleeves.ts`.
   */
  | { readonly kind: 'synthSleeves' }
  /**
   * The gate of sleeve levels. Until it is owned, sleeve XP does not accrue, sleeve levels read 0 (no bonuses) and stay hidden, and the
   * Re-sleeve button is hidden. Owning it opens all three; it survives re-sleeving. At most one buyable may have this effect.
   * See `Progression.sleeveXpOpen` and `ui/view/sleeveGate.ts`.
   */
  | { readonly kind: 'unlockSleeveLevels' }
  /**
   * The permission to re-sleeve. Until it is owned the Re-sleeve button is this purchase; owning it allows re-sleeving after a short
   * lockout (`resleeve.lockoutMs`) and it survives re-sleeving. At most one buyable may have this effect. See `resleeveGate.ts`.
   */
  | { readonly kind: 'unlockResleeve' }
  /** The effects of the newer re-sleeve skills (see `resleeveEffectTypes.ts`). */
  | ResleeveEffect;
