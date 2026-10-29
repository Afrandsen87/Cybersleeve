/**
 * @module core
 *
 * Synthetic sleeves: extra sleeves that earn credits for you, each one a copy of a finished sleeve-run.
 */
import { ownsKind } from '../effects/ownedOfKind';
import type { BigNum, NumberFactory } from '../../numbers';
import type { Progression } from '../actions/progression';
import type { ActionId, BuyableDefinition, GameConfig, GameState, SleeveRunRecord, StateSlice } from '../types';

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
 * The highest action level any synthetic sleeve reached on an action: the best of the levels written down in the runs the sleeves copy.
 *
 * Called by: `stats.ts` (Neural Mirror), `ui/view/` (tips). Calls: nothing.
 *
 * @param state the runs and the synthetic sleeves (reads `runs`, `synths`)
 * @param actionId the action
 * @returns the level, or 0 when there is no synthetic sleeve or no run kept that action's level
 */
export function bestSynthActionLevel(state: StateSlice<'runs' | 'synths'>, actionId: ActionId): number {
  let best = 0;
  for (const synth of state.wallet.synths) best = Math.max(best, state.wallet.runs[synth.runIndex]?.actionLevels?.[actionId] ?? 0);
  return best;
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
 * Two skills of the synthetics lane change them: Cloning Vats makes every re-sleeve give more than one ({@link SynthSleeves.perResleeve}),
 * and Perfect Copies makes each earn at least what the sleeve's own network earns right now.
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
   * @param networkIncome the credits per second the sleeve's own network earns now, after the heat tax and without synthetic income
   *   (read only while Perfect Copies is owned; default: nothing)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables'>,
    private readonly state: GameState,
    private readonly progression: Progression,
    private readonly factory: NumberFactory,
    private readonly networkIncome: () => BigNum = () => factory.fromNumber(0),
  ) {}

  /** True when the player owns a buyable with the given effect kind. */
  private owns(kind: BuyableDefinition['effect']['kind']): boolean {
    return ownsKind(this.config.buyables, this.state.sleeve.purchased, kind);
  }

  /** True when the player owns a buyable with the `perfectCopies` effect. */
  isPerfect(): boolean {
    return this.owns('perfectCopies');
  }

  /** How many synthetic sleeves one re-sleeve gives: 1, or the `count` of the owned `synthsPerResleeve` buyable (the largest, if several). */
  perResleeve(): number {
    let count = 1;
    for (const b of this.config.buyables) {
      if (b.effect.kind === 'synthsPerResleeve' && (this.state.sleeve.purchased[b.id] ?? 0) > 0) count = Math.max(count, b.effect.count);
    }
    return count;
  }

  /** True when the player owns a buyable with the `synthSleeves` effect. */
  isUnlocked(): boolean {
    return this.config.buyables.some((b) => b.effect.kind === 'synthSleeves' && (this.state.sleeve.purchased[b.id] ?? 0) > 0);
  }

  /** How many synthetic sleeves the player has. */
  count(): number {
    return this.state.wallet.synths.length;
  }

  /** Credits per second all synthetic sleeves earn together, not taxed by heat (they have paid their tax already). */
  creditsPerSecond(): BigNum {
    let total = this.factory.fromNumber(0);
    if (this.state.wallet.synths.length === 0) return total;
    const levels = this.progression.totalActionLevels(this.state);
    const live = this.isPerfect() ? this.networkIncome() : null;
    for (const synth of this.state.wallet.synths) {
      const record = this.state.wallet.runs[synth.runIndex];
      if (!record) continue;
      const own = synthCreditsPerSecond(record, levels, this.factory);
      total = total.add(live?.gt(own) ? live : own);
    }
    return total;
  }

  /**
   * Gains a synthetic sleeve that copies the latest finished run. Does nothing while no run has finished.
   *
   * Called by: `resleever.ts`, {@link SynthSleeves.onPurchased}.
   */
  addForLatestRun(): void {
    if (this.state.wallet.runs.length > 0) this.state.wallet.synths.push({ runIndex: this.state.wallet.runs.length - 1 });
  }

  /**
   * Gains the synthetic sleeves a re-sleeve gives ({@link SynthSleeves.perResleeve} of them), all copies of the run that just ended.
   *
   * Called by: `resleever.ts`.
   */
  addForResleeve(): void {
    for (let i = 0; i < this.perResleeve(); i++) this.addForLatestRun();
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
