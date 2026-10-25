/**
 * @module core
 *
 * The pure formulas of what actions pay: rewards, XP and passive network income (the only thing the heat tax applies to).
 */
import type { BigNum, NumberFactory } from '../numbers';
import { heatTaxFactor } from './heat';
import { rewardOf } from './rewards';
import type { ActionDefinition, GameConfig } from './types';

/**
 * Computes what runs and the network earn. Stateless; reads only the global levers, the heat tax rate and the network rate.
 *
 * Called by: `engine.ts`, `stats.ts`, `actionRunner.ts`. Calls: {@link heatTaxFactor} (for node income), `rewardOf`.
 */
export class Economy {
  private readonly creditLever: BigNum;
  private readonly xpLever: BigNum;
  private readonly nodeBase: number;
  private readonly creditLeverNumber: number;
  private readonly taxPerPoint: number;

  /**
   * Creates the economy from the configuration.
   *
   * @param config reads `global.creditMultiplier`, `global.xpMultiplier`, `network.creditsPerNodePerSecond` and `sleeve.heatTaxPerPoint`
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'global' | 'network' | 'sleeve'>,
    private readonly factory: NumberFactory,
  ) {
    this.creditLever = factory.fromNumber(config.global.creditMultiplier);
    this.xpLever = factory.fromNumber(config.global.xpMultiplier);
    this.nodeBase = config.network.creditsPerNodePerSecond;
    this.creditLeverNumber = config.global.creditMultiplier;
    this.taxPerPoint = config.sleeve.heatTaxPerPoint;
  }

  /**
   * The share of earned credits kept after the heat tax.
   *
   * @param heat current heat
   * @param reduction share of the heat's effect removed by ICE Rating (0..1)
   */
  keepFactor(heat: number, reduction: number): number {
    return heatTaxFactor(heat, reduction, this.taxPerPoint);
  }

  /**
   * Amount one completed run earns (credits or network nodes, see `ActionDefinition.rewardKind`):
   * `reward * (nodes, if rewardPerNetworkNode) * rewardMultiplier`, and for credits also `* global.creditMultiplier`.
   * The credit lever scales credits only: only a reward kind marked `scaledByCreditMultiplier` is touched by it.
   * Heat is not involved.
   *
   * @param def the action
   * @param network network nodes owned
   * @param rewardMultiplier multiplier on this reward from purchases (nothing else is scaled by it)
   */
  grossReward(def: ActionDefinition, network: BigNum, rewardMultiplier: BigNum): BigNum {
    const base = def.rewardPerNetworkNode ? def.reward.mul(network) : def.reward;
    const amount = base.mul(rewardMultiplier);
    return rewardOf(def.rewardKind).scaledByCreditMultiplier ? amount.mul(this.creditLever) : amount;
  }

  /**
   * What one run actually adds to the balance: the gross reward, rounded down for rewards that come in whole units.
   * Heat does not tax it: heat applies only to the credits network nodes produce.
   *
   * @param def the action
   * @param gross result of {@link Economy.grossReward}
   */
  payout(def: ActionDefinition, gross: BigNum): BigNum {
    return rewardOf(def.rewardKind).wholePerRun ? gross.floor() : gross;
  }

  /**
   * Action XP gained per completed run: `xpPerRun * global.xpMultiplier`. Reward multipliers do not touch it.
   *
   * @param def the action
   */
  xpPerRun(def: ActionDefinition): BigNum {
    return def.xpPerRun.mul(this.xpLever);
  }

  /**
   * Credits the network delivers per second: `nodes * (creditsPerNodePerSecond + baseBonus) * global.creditMultiplier * payoutMultiplier * keep`.
   *
   * @param network network nodes owned
   * @param heat current heat (for the tax)
   * @param reduction share of the heat's effect removed by ICE Rating (0..1)
   * @param payoutMultiplier multiplier on what each node produces (from buyables; default 1)
   * @param baseBonus credits per second added to the base of every node (earned by actions; default 0)
   */
  passiveCreditsPerSecond(network: BigNum, heat: number, reduction = 0, payoutMultiplier = 1, baseBonus = 0): BigNum {
    return network.mul(this.passiveCreditsPerNode(heat, reduction, payoutMultiplier, baseBonus));
  }

  /**
   * Credits ONE network node delivers per second: `(creditsPerNodePerSecond + baseBonus) * global.creditMultiplier * payoutMultiplier * keep`.
   * The bonus earned by actions is added to the BASE value of a node; the multiplier from buyables then multiplies the sum.
   * The network's income is this times the number of nodes.
   *
   * Called by: {@link Economy.passiveCreditsPerSecond}, `stats.ts`.
   *
   * @param heat current heat (for the tax)
   * @param reduction share of the heat's effect removed by ICE Rating (0..1)
   * @param payoutMultiplier multiplier on what each node produces (from buyables; default 1)
   * @param baseBonus credits per second added to the base of every node (earned by actions; default 0)
   */
  passiveCreditsPerNode(heat: number, reduction = 0, payoutMultiplier = 1, baseBonus = 0): BigNum {
    const base = (this.nodeBase + baseBonus) * this.creditLeverNumber;
    return this.factory.fromNumber(base * payoutMultiplier * this.keepFactor(heat, reduction));
  }
}
