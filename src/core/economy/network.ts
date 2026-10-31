/**
 * @module core
 *
 * The passive-income network: credits produced by the nodes, and nodes that grow by themselves.
 */
import type { BigNum, NumberFactory } from '../../numbers';
import type { DerivedStats } from '../engine/stats';
import type { GameState } from '../types';

/**
 * Something that earns credits per second on top of the network. Owned here, by the consumer, so economy does not import `synth`.
 *
 * Called by: {@link NetworkSystem}. Implemented by: `SynthSleeves` (structurally).
 */
export interface SynthIncome {
  /** Credits per second all synthetic sleeves together earn right now (>= 0). Not taxed by heat. */
  creditsPerSecond(): BigNum;
}

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
    private readonly stats: Pick<DerivedStats, 'passiveCreditsPerSecond' | 'networkGrowthRate'>,
    private readonly factory: NumberFactory,
    private readonly synths: SynthIncome | null = null,
  ) {}

  /**
   * Total current passive income owned by economy: taxed network plus synthetic sleeves.
   * Called by: GameEngine.creditsPerSecond. Calls: incomeRates.
   * @returns credits earned per second; reads state without mutation
   */
  creditsPerSecond(): BigNum {
    return this.incomeRates().total;
  }

  /**
   * Reads both the network-only peak rate and the total paid rate from one calculation.
   * Called by: creditsPerSecond, payPassiveIncome. Calls: DerivedStats.passiveCreditsPerSecond, SynthIncome.creditsPerSecond.
   * @returns current network and total rates without changing state
   */
  private incomeRates(): { network: BigNum; total: BigNum } {
    const network = this.state.sleeve.network.isZero() ? this.factory.fromNumber(0) : this.stats.passiveCreditsPerSecond();
    return { network, total: this.synths ? network.add(this.synths.creditsPerSecond()) : network };
  }

  /**
   * Pays the credits the network produced over `deltaMs`, using the nodes and heat held now (nodes finished during the
   * slice start producing in the next one), plus what the synthetic sleeves earned. The synthetic income is not taxed by heat.
   * Also raises `sleeve.peakNetworkIncome` to the network's rate of this slice (synthetic income excluded), the peak the re-sleeve record keeps.
   * @param deltaMs game time in milliseconds
   */
  payPassiveIncome(deltaMs: number): void {
    const seconds = this.factory.fromNumber(deltaMs / 1000);
    const rates = this.incomeRates();
    if (rates.network.gt(this.state.sleeve.peakNetworkIncome)) this.state.sleeve.peakNetworkIncome = rates.network;
    this.state.wallet.credits = this.state.wallet.credits.add(rates.total.mul(seconds));
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
