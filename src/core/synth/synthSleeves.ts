/**
 * @module core
 *
 * Synthetic sleeves: extra sleeves that earn credits for you, each one a copy of a finished sleeve-run.
 */
import { ownsKind } from '../effects/ownedOfKind';
import { synthBoost } from '../kernel/curves';
import type { SynthQueries } from './synthQueries';
import type { BigNum, NumberFactory } from '../../numbers';
import type { Progression } from '../actions/progression';
import type { ActionId, BuyableDefinition, GameConfig, GameState, SleeveRunRecord, StateSlice } from '../types';

/**
 * The action-level total one synthetic sleeve is measured against (the "current levels" of {@link synthCreditsPerSecond}).
 * Each synthetic sleeve asks for its own, so a later layer can measure a sleeve against another sleeve than the live one; today every
 * sleeve is measured against the live sleeve ({@link SynthSleeves.creditsPerSecond} passes the live total).
 */
export type SynthLevelInput = (synth: Readonly<{ runIndex: number }>) => number;

/**
 * The credits per second one synthetic sleeve earns, given how far the current sleeve has come.
 *
 * @remarks
 * A synthetic sleeve earns the final credits per second of the run it copies, interpolated in orders of magnitude (so one level never
 * jumps it from nothing to millions): `(1 + record)^p - 1`, where `p = min(1, current levels / recorded levels)`. The current levels
 * include the fraction of each action's current level, so income rises continuously. Once the current sleeve has caught up (p = 1) it
 * stays at the full recorded amount (more levels never raise it). A run that had no action levels (a total of 0) has nothing to catch
 * up to, so it pays in full at once. Zero or NaN current levels pay nothing; the result is clamped to [0, record].
 *
 * Called by: {@link SynthSleeves.creditsPerSecond}.
 *
 * @param record the finished run the synthetic sleeve copies
 * @param currentLevels the total of all action levels of the current sleeve, fractions included (>= 0)
 * @param factory number factory
 * @returns credits per second (>= 0, <= the recorded amount)
 */
export function synthCreditsPerSecond(record: SleeveRunRecord, currentLevels: number, factory: NumberFactory): BigNum {
  const recorded = record.actionLevelsTotal;
  if (!(recorded > 0) || currentLevels >= recorded) return record.creditsPerSecond;
  if (!(currentLevels > 0) || !record.creditsPerSecond.gt(factory.fromNumber(0))) return factory.fromNumber(0);
  const one = factory.fromNumber(1);
  const interpolated = record.creditsPerSecond
    .add(one)
    .pow(currentLevels / recorded)
    .sub(one);
  if (!interpolated.isFinite() || !interpolated.gt(factory.fromNumber(0))) return factory.fromNumber(0);
  return interpolated.gt(record.creditsPerSecond) ? record.creditsPerSecond : interpolated;
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
 * Calls: {@link synthCreditsPerSecond}, {@link Progression.totalActionLevelsWithProgress}.
 */
export class SynthSleeves implements SynthQueries {
  /**
   * Creates the service.
   *
   * @param config game content (decides which buyable unlocks synthetic sleeves)
   * @param state the live game state (mutated when a sleeve is gained)
   * @param progression gives the total of the current action levels
   * @param factory number factory
   * @param networkIncome the credits per second the sleeve's own network earns now, after the heat tax and without synthetic income
   *   (read only while Perfect Copies is owned; default: nothing)
   * @param levelInput the action-level total each synthetic sleeve is measured against (default: the live sleeve's total)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables'>,
    private readonly state: GameState,
    private readonly progression: Progression,
    private readonly factory: NumberFactory,
    private readonly networkIncome: () => BigNum = () => factory.fromNumber(0),
    levelInput?: SynthLevelInput,
  ) {
    this.levelInput = levelInput ?? (() => this.progression.totalActionLevelsWithProgress(this.state));
  }

  private readonly levelInput: SynthLevelInput;

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

  /** Active sleeves, zero while locked; saved records stay dormant. Called by: engine queries, boost, income. Calls: isUnlocked. */
  count(): number {
    return this.isUnlocked() ? this.state.wallet.synths.length : 0;
  }

  /**
   * The boost the synthetic sleeves give a `perLn` skill (see {@link SynthQueries.boost}).
   *
   * Called by: `corporation/corporation.ts`. Calls: `synthBoost`.
   */
  boost(perLn: number, copies: number): number {
    return synthBoost(perLn, this.count(), copies);
  }

  /** Active synthetic income, zero while locked. Called by: network, engine queries. Calls: income. */
  creditsPerSecond(): BigNum {
    return this.income((synth) => this.levelInput(synth));
  }

  /**
   * What all synthetic sleeves earn together once the current sleeve has full action levels (every sleeve at progress 1): each one
   * pays its recorded amount, and with Perfect Copies no less than the network earns now. The same per-sleeve formula as
   * {@link SynthSleeves.creditsPerSecond}, only with the level input at infinity.
   *
   * Called by: `engine.ts` (shown in the synthetic sleeves tip). Calls: {@link SynthSleeves.income}.
   *
   * @returns credits per second (>= 0; 0 while locked or with no sleeves)
   */
  incomeCeiling(): BigNum {
    return this.income(() => Number.POSITIVE_INFINITY);
  }

  /** Sums active sleeve income for the given levels. Called by: creditsPerSecond, incomeCeiling. Calls: count, isPerfect, synthCreditsPerSecond. */
  private income(levelOf: SynthLevelInput): BigNum {
    let total = this.factory.fromNumber(0);
    if (this.count() === 0) return total;
    const live = this.isPerfect() ? this.networkIncome() : null;
    for (const synth of this.state.wallet.synths) {
      const record = this.state.wallet.runs[synth.runIndex];
      if (!record) continue;
      const own = synthCreditsPerSecond(record, levelOf(synth), this.factory);
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
   * Reacts to a purchase: gives the first sleeve only when no saved sleeves exist, so re-buying resumes dormant sleeves.
   *
   * Called by: `shop.ts` (after every purchase). Calls: addForLatestRun.
   *
   * @param buyable the buyable that was just bought
   */
  onPurchased(buyable: BuyableDefinition): void {
    if (buyable.effect.kind === 'synthSleeves' && this.state.wallet.synths.length === 0) this.addForLatestRun();
  }
}
