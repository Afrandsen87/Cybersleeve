/**
 * @module core
 *
 * What the network earns now: the heat tax share, income per node and in total, and how fast the network grows. Read only.
 */
import type { BigNum } from '../../numbers';
import { resolveNetworkGrowth, type SleeveStats } from '../effects/effects';
import type { ActionId, GameConfig, GameState } from '../types';
import type { Economy } from './economy';

/**
 * Answers the questions about passive income. Holds no state; reads the `GameState` it was given every time. The heat tax is applied
 * in ONE place ({@link Economy.taxedCreditsPerNode}); the per-second income is the node count times that.
 *
 * Called by: `DerivedStats` (the facade). Calls: {@link Economy}, `resolveNetworkGrowth`.
 */
export class IncomeStats {
  /**
   * Creates the unit.
   *
   * @param config reads `buyables`
   * @param state the live game state (read only)
   * @param economy income formulas
   * @param sleeveStats the sleeve-wide stats (computed once per snapshot by the facade)
   * @param actionLevel the level of an action (what level-based network growth reads)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables'>,
    private readonly state: GameState,
    private readonly economy: Economy,
    private readonly sleeveStats: () => SleeveStats,
    private readonly actionLevel: (id: ActionId) => number,
  ) {}

  /** The share of node income kept after the heat tax (with the current ICE Rating). */
  creditKeepFactor(): number {
    const stats = this.sleeveStats();
    return this.economy.keepFactor(this.state.sleeve.heat, stats.heatReduction, stats.heatTaxCap);
  }

  /** Fraction of its size the network grows by per second right now (fixed rates plus level-based rates of the growth buyables). */
  networkGrowthRate(): number {
    return resolveNetworkGrowth(this.config.buyables, this.state, this.actionLevel);
  }

  /** Credits one network node delivers per second right now, after the payout multiplier. The heat tax is not part of it (it applies to the income, see below). */
  passiveCreditsPerNode(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerNode(stats.nodePayoutMultiplier, stats.nodePayoutBonus);
  }

  /** What one node delivers per second right now once the heat tax has taken its share. */
  taxedCreditsPerNode(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.taxedCreditsPerNode(
      this.state.sleeve.heat,
      stats.heatReduction,
      stats.nodePayoutMultiplier,
      stats.nodePayoutBonus,
      stats.heatTaxCap,
    );
  }

  /** Credits the network delivers per second right now: nodes times {@link IncomeStats.taxedCreditsPerNode}. */
  passiveCreditsPerSecond(): BigNum {
    const stats = this.sleeveStats();
    return this.economy.passiveCreditsPerSecond(
      this.state.sleeve.network,
      this.state.sleeve.heat,
      stats.heatReduction,
      stats.nodePayoutMultiplier,
      stats.nodePayoutBonus,
      stats.heatTaxCap,
    );
  }
}
