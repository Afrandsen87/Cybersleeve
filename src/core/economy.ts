/**
 * @module core
 *
 * The pure formulas of what actions pay: rewards, XP, the heat tax and passive network income.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { heatTaxFactor } from './heat';
import type { ActionDefinition, GameConfig } from './types';

/**
 * Computes what runs and the network earn. Stateless; reads only the global levers and the network rate.
 *
 * Called by: `engine.ts`. Calls: {@link heatTaxFactor}.
 */
export class Economy {
  private readonly rewardLever: BigNum;
  private readonly xpLever: BigNum;
  private readonly nodeRate: number;

  /**
   * Creates the economy from the configuration.
   *
   * @param config reads `global.rewardMultiplier`, `global.xpMultiplier` and `network.creditsPerNodePerSecond`
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'global' | 'network'>,
    private readonly factory: NumberFactory,
  ) {
    this.rewardLever = factory.fromNumber(config.global.rewardMultiplier);
    this.xpLever = factory.fromNumber(config.global.xpMultiplier);
    this.nodeRate = config.network.creditsPerNodePerSecond * config.global.rewardMultiplier;
  }

  /**
   * Amount one completed run earns BEFORE the heat tax (credits or network nodes, see `ActionDefinition.rewardKind`):
   * `reward * (nodes, if rewardPerNetworkNode) * outputMultiplier * global.rewardMultiplier`.
   *
   * @param def the action
   * @param network network nodes owned
   * @param outputMultiplier output multiplier from purchases
   */
  grossReward(def: ActionDefinition, network: BigNum, outputMultiplier: BigNum): BigNum {
    const base = def.rewardPerNetworkNode ? def.reward.mul(network) : def.reward;
    return base.mul(outputMultiplier).mul(this.rewardLever);
  }

  /**
   * What one run actually adds to the balance at the given heat: the gross reward, and for credits also after the
   * heat tax. Everything else is untaxed. Network nodes are whole: the gross amount is rounded down.
   *
   * @param def the action
   * @param gross result of {@link Economy.grossReward}
   * @param heat current heat
   * @param reduction share of the heat's effect removed by Circumvention (0..1)
   */
  payout(def: ActionDefinition, gross: BigNum, heat: number, reduction = 0): BigNum {
    if (def.rewardKind === undefined || def.rewardKind === 'credits') {
      return gross.mul(this.factory.fromNumber(heatTaxFactor(heat, reduction)));
    }
    return def.rewardKind === 'networkNodes' ? gross.floor() : gross;
  }

  /**
   * Credits earned by `runs` consecutive runs that each add `heatPerRun` heat, in closed form.
   *
   * @remarks
   * Run k (from 0) pays `gross * keep(heat + k * heatPerRun)`, where `keep` is {@link heatTaxFactor}. The sum is an
   * arithmetic series that stops contributing once heat reaches 100, so the cost does not depend on `runs`.
   *
   * @param gross credits per run before tax
   * @param runs number of runs (>= 0)
   * @param heat heat before the first run
   * @param heatPerRun heat each run adds (>= 0)
   * @param reduction share of the heat's effect removed by Circumvention (0..1); heat and heat per run both count
   *   `(1 - reduction)` times as much towards the tax
   * @returns the total credits after tax
   */
  creditsForRuns(gross: BigNum, runs: number, heat: number, heatPerRun: number, reduction = 0): BigNum {
    if (!(runs > 0)) return this.factory.fromNumber(0);
    const effective = Math.max(0, heat) * (1 - reduction);
    const step = heatPerRun * (1 - reduction);
    if (!(step > 0)) return gross.mul(this.factory.fromNumber(runs * heatTaxFactor(effective)));
    if (effective >= 100) return this.factory.fromNumber(0);
    const paying = Math.min(runs, Math.ceil((100 - effective) / step));
    const keepSum = paying * heatTaxFactor(effective) - (step / 100) * ((paying * (paying - 1)) / 2);
    return gross.mul(this.factory.fromNumber(Math.max(0, keepSum)));
  }

  /**
   * Action XP gained per completed run: `xpPerRun * outputMultiplier * global.xpMultiplier`.
   *
   * @param def the action
   * @param outputMultiplier output multiplier from purchases
   */
  xpPerRun(def: ActionDefinition, outputMultiplier: BigNum): BigNum {
    return def.xpPerRun.mul(outputMultiplier).mul(this.xpLever);
  }

  /**
   * Credits the network delivers per second: `nodes * creditsPerNodePerSecond * global.rewardMultiplier * payoutMultiplier * keep`.
   *
   * @param network network nodes owned
   * @param heat current heat (for the tax)
   * @param reduction share of the heat's effect removed by Circumvention (0..1)
   * @param payoutMultiplier multiplier on what each node produces (from buyables; default 1)
   */
  passiveCreditsPerSecond(network: BigNum, heat: number, reduction = 0, payoutMultiplier = 1): BigNum {
    return network.mul(this.factory.fromNumber(this.nodeRate * payoutMultiplier * heatTaxFactor(heat, reduction)));
  }
}
