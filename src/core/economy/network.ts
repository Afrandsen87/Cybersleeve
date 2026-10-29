/**
 * @module core
 *
 * The passive-income network: credits produced by the nodes, and nodes that grow by themselves.
 */
import type { NumberFactory } from '../../numbers';
import type { DerivedStats } from '../engine/stats';
import type { SynthIncome } from '../synth/synthSleeves';
import type { GameState } from '../types';

/**
 * Advances the network over a stretch of game time.
 *
 * Called by: `engine.ts` (`GameEngine.advance`). Calls: {@link DerivedStats.passiveCreditsPerSecond}, {@link DerivedStats.networkGrowthRate}.
 */
export class NetworkSystem {
  /**
   * Creates the network system.
   *
   * @param state the live game state (mutated)
   * @param stats derived values
   * @param factory number factory
   * @param synths what the synthetic sleeves earn on top (default: nothing)
   */
  constructor(
    private readonly state: GameState,
    private readonly stats: DerivedStats,
    private readonly factory: NumberFactory,
    private readonly synths: SynthIncome | null = null,
  ) {}

  /**
   * Pays the credits the network produced over `deltaMs`, using the nodes and heat held now (nodes finished during the
   * slice start producing in the next one), plus what the synthetic sleeves earned. The synthetic income is not taxed by heat.
   * @param deltaMs game time in milliseconds
   */
  payPassiveIncome(deltaMs: number): void {
    const seconds = this.factory.fromNumber(deltaMs / 1000);
    if (!this.state.sleeve.network.isZero())
      this.state.wallet.credits = this.state.wallet.credits.add(this.stats.passiveCreditsPerSecond().mul(seconds));
    if (this.synths) this.state.wallet.credits = this.state.wallet.credits.add(this.synths.creditsPerSecond().mul(seconds));
  }

  /**
   * Compounds the network by its growth rate over `deltaMs` (closed form, so slice length does not matter). Nodes are
   * whole: the growth is added to a carried fraction and only complete nodes join the network.
   * @param deltaMs game time in milliseconds
   */
  grow(deltaMs: number): void {
    const rate = this.stats.networkGrowthRate();
    if (!(rate > 0) || this.state.sleeve.network.isZero()) return;
    const factor = Math.expm1(Math.log1p(rate) * (deltaMs / 1000));
    const growth = this.state.sleeve.network
      .mul(this.factory.fromNumber(factor))
      .add(this.factory.fromNumber(this.state.sleeve.networkRemainder));
    const whole = growth.floor();
    this.state.sleeve.networkRemainder = growth.sub(whole).toNumber();
    this.state.sleeve.network = this.state.sleeve.network.add(whole);
  }
}
