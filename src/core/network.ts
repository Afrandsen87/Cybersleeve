/**
 * @module core
 *
 * The passive-income network: credits produced by the nodes, and nodes that grow by themselves.
 */
import type { NumberFactory } from '../numbers';
import { resolveNetworkGrowth } from './effects';
import type { DerivedStats } from './stats';
import type { GameConfig, GameState } from './types';

/**
 * Advances the network over a stretch of game time.
 *
 * Called by: `engine.ts` (`GameEngine.advance`). Calls: {@link DerivedStats.passiveCreditsPerSecond}, `resolveNetworkGrowth`.
 */
export class NetworkSystem {
  /**
   * Creates the network system.
   *
   * @param config reads `buyables` (for growth effects)
   * @param state the live game state (mutated)
   * @param stats derived values
   * @param factory number factory
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables'>,
    private readonly state: GameState,
    private readonly stats: DerivedStats,
    private readonly factory: NumberFactory,
  ) {}

  /**
   * Pays the credits the network produced over `deltaMs`, using the nodes and heat held now (nodes finished during the
   * slice start producing in the next one).
   * @param deltaMs game time in milliseconds
   */
  payPassiveIncome(deltaMs: number): void {
    if (this.state.network.isZero()) return;
    const income = this.stats.passiveCreditsPerSecond().mul(this.factory.fromNumber(deltaMs / 1000));
    this.state.credits = this.state.credits.add(income);
  }

  /**
   * Compounds the network by its growth rate over `deltaMs` (closed form, so slice length does not matter). Nodes are
   * whole: the growth is added to a carried fraction and only complete nodes join the network.
   * @param deltaMs game time in milliseconds
   */
  grow(deltaMs: number): void {
    const rate = resolveNetworkGrowth(this.config.buyables, this.state);
    if (!(rate > 0) || this.state.network.isZero()) return;
    const factor = Math.expm1(Math.log1p(rate) * (deltaMs / 1000));
    const growth = this.state.network.mul(this.factory.fromNumber(factor)).add(this.factory.fromNumber(this.state.networkRemainder));
    const whole = growth.floor();
    this.state.networkRemainder = growth.sub(whole).toNumber();
    this.state.network = this.state.network.add(whole);
  }
}
