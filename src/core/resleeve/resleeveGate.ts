/**
 * @module core
 *
 * The gate on sleeve levels and re-sleeving: the one buyable with the `unlockSleeveLevels` effect, and the short lockout after it is
 * bought.
 *
 * @remarks
 * A game whose content has no such buyable has no gate: sleeve levels count and re-sleeving is always allowed (the unit-test configs).
 * Called by: `app/createGame.ts` (builds it), `engine.ts` (`advance`, through the {@link ResleevePolicy} it is), `shop.ts` (purchase
 * listener). `Progression` reads the same rule through {@link sleeveLevelsGateId}.
 */
import type { ResleevePolicy } from './resleeve';
import type { BuyableDefinition, GameConfig, GameState } from '../types';

/**
 * Id of the buyable that opens sleeve levels and re-sleeving.
 *
 * Called by: {@link ResleeveGate}, `Progression`.
 *
 * @param buyables the content
 * @returns its id, or `null` when the content has none (no gate)
 */
export function sleeveLevelsGateId(buyables: readonly BuyableDefinition[] | undefined): string | null {
  return buyables?.find((b) => b.effect.kind === 'unlockSleeveLevels')?.id ?? null;
}

/**
 * Allows re-sleeving only once the gate buyable is owned and its lockout has run out; starts and counts down that lockout.
 *
 * Called by: `createGame.ts`, `engine.ts`. Mutates `GameState.resleeveLockoutMs` only.
 */
export class ResleeveGate implements ResleevePolicy {
  private readonly gateId: string | null;
  private readonly lockoutMs: number;

  /**
   * Finds the gate buyable in the content and reads the lockout length.
   *
   * @param config reads `buyables` and `resleeve.lockoutMs`
   * @param state the live state (lockout is written to it)
   */
  constructor(
    config: Pick<GameConfig, 'buyables' | 'resleeve'>,
    private readonly state: GameState,
  ) {
    this.gateId = sleeveLevelsGateId(config.buyables);
    this.lockoutMs = config.resleeve.lockoutMs ?? 0;
  }

  /** True when the player may re-sleeve: no gate in the content, or the gate is owned and the lockout is over. */
  canResleeve(state: GameState): boolean {
    if (this.gateId === null) return true;
    return (state.sleeve.purchased[this.gateId] ?? 0) > 0 && state.sleeve.resleeveLockoutMs <= 0;
  }

  /** Called by the shop after every purchase: buying the gate starts the lockout. */
  onPurchased(buyable: BuyableDefinition): void {
    if (buyable.id === this.gateId) this.state.sleeve.resleeveLockoutMs = this.lockoutMs;
  }

  /**
   * Counts the lockout down.
   *
   * Called by: `GameEngine.advance`.
   *
   * @param deltaMs game time that passed
   */
  advance(deltaMs: number): void {
    if (this.state.sleeve.resleeveLockoutMs > 0)
      this.state.sleeve.resleeveLockoutMs = Math.max(0, this.state.sleeve.resleeveLockoutMs - deltaMs);
  }
}
