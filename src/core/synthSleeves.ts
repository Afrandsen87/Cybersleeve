/**
 * @module core
 *
 * Synthetic sleeves: extra sleeves that earn credits for you, each one a copy of a finished sleeve-run.
 */
import type { BigNum, NumberFactory } from '../numbers';
import type { Progression } from './progression';
import type { BuyableDefinition, GameConfig, GameState, SleeveRunRecord } from './types';

/** Something that earns credits per second on top of the network (what {@link NetworkSystem} adds to its income). */
export interface SynthIncome {
  /** Credits per second all synthetic sleeves together earn right now (>= 0). Not taxed by heat. */
  creditsPerSecond(): BigNum;
}

/**
 * The credits per second one synthetic sleeve earns, given how far the current sleeve has come.
 *
 * @remarks
 * A synthetic sleeve earns the final credits per second of the run it copies, scaled by how far the current sleeve has come in
 * action levels: `creditsPerSecond x min(1, current levels total / recorded levels total)`. Once the current sleeve has caught up it
 * stays at the full recorded amount (more levels never raise it): the base behaviour is a speed-up, not a source of growth. A run
 * that had no action levels at all (a total of 0) has nothing to catch up to, so it pays in full at once.
 *
 * Called by: {@link SynthSleeves.creditsPerSecond}.
 *
 * @param record the finished run the synthetic sleeve copies
 * @param currentLevels the total of all action levels of the current sleeve (>= 0)
 * @param factory number factory
 * @returns credits per second (>= 0)
 */
export function synthCreditsPerSecond(record: SleeveRunRecord, currentLevels: number, factory: NumberFactory): BigNum {
  const recorded = record.actionLevelsTotal;
  if (!(recorded > 0) || currentLevels >= recorded) return record.creditsPerSecond;
  if (!(currentLevels > 0)) return factory.fromNumber(0);
  return record.creditsPerSecond.mul(factory.fromNumber(currentLevels / recorded));
}

/**
 * The synthetic sleeves of the player: how many there are, what they earn, and when one is gained.
 *
 * @remarks
 * The sleeves themselves live in the state (`GameState.synths`, each pointing at a record in `GameState.runs`). They are gained in
 * two ways: buying the skill with the `synthSleeves` effect gives one at once, copied from the last finished run, and every re-sleeve
 * after that gives one more, copied from the run that just ended (see `Resleever`). Runs that finished before the skill was bought are
 * never copied.
 *
 * Called by: `network.ts` (income), `resleever.ts`, `shop.ts` (purchase listener), `engine.ts` (queries).
 * Calls: {@link synthCreditsPerSecond}, {@link Progression.totalActionLevels}.
 */
export class SynthSleeves implements SynthIncome {
  /**
   * Creates the service.
   *
   * @param config game content (decides which buyable unlocks synthetic sleeves)
   * @param state the live game state (mutated when a sleeve is gained)
   * @param progression gives the total of the current action levels
   * @param factory number factory
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables'>,
    private readonly state: GameState,
    private readonly progression: Progression,
    private readonly factory: NumberFactory,
  ) {}

  /** True when the player owns a buyable with the `synthSleeves` effect. */
  isUnlocked(): boolean {
    return this.config.buyables.some((b) => b.effect.kind === 'synthSleeves' && (this.state.purchased[b.id] ?? 0) > 0);
  }

  /** How many synthetic sleeves the player has. */
  count(): number {
    return this.state.synths.length;
  }

  /** Credits per second all synthetic sleeves earn together, not taxed by heat (they have paid their tax already). */
  creditsPerSecond(): BigNum {
    let total = this.factory.fromNumber(0);
    if (this.state.synths.length === 0) return total;
    const levels = this.progression.totalActionLevels(this.state);
    for (const synth of this.state.synths) {
      const record = this.state.runs[synth.runIndex];
      if (record) total = total.add(synthCreditsPerSecond(record, levels, this.factory));
    }
    return total;
  }

  /**
   * Gains a synthetic sleeve that copies the latest finished run. Does nothing while no run has finished.
   *
   * Called by: `resleever.ts`, {@link SynthSleeves.onPurchased}.
   */
  addForLatestRun(): void {
    if (this.state.runs.length > 0) this.state.synths.push({ runIndex: this.state.runs.length - 1 });
  }

  /**
   * Reacts to a purchase: buying the synthetic sleeves skill gives the first sleeve at once.
   *
   * Called by: `shop.ts` (after every purchase).
   *
   * @param buyable the buyable that was just bought
   */
  onPurchased(buyable: BuyableDefinition): void {
    if (buyable.effect.kind === 'synthSleeves') this.addForLatestRun();
  }
}
