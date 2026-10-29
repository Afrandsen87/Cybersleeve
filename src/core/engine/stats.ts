/**
 * @module core
 *
 * Derived values: everything that is computed from the state, the content and the tuning but changes nothing. A facade over the
 * per-context services that answer each question (`ToggleStats`, `RunStats`, `CritStats`, `ItemStats`, `IncomeStats`, `HeatStats`).
 */
import type { BigNum, NumberFactory } from '../../numbers';
import type { ActionLookup } from '../actions/actionLookup';
import type { FocusStatus, ModeStatuses, OverclockStatus } from '../actions/actionToggles';
import type { Progression } from '../actions/progression';
import { RunStats } from '../actions/runStats';
import type { SpeedFactor, SpeedModifier } from '../actions/speed';
import { ToggleStats } from '../actions/toggleStats';
import { CritStats } from '../crits/critStats';
import { resolveSleeveStats, type SleeveStats } from '../effects/effects';
import type { Economy } from '../economy/economy';
import { IncomeStats } from '../economy/incomeStats';
import { HeatStats } from '../heat/heatStats';
import { distinctAugmentRarities } from '../items/augments';
import { ItemStats } from '../items/itemStats';
import type { BackChannelRule } from '../items/leverageEffects';
import { Snapshot } from '../kernel/snapshot';
import { bestSynthActionLevel } from '../synth/synthSleeves';
import type { ActionId, CriticalSuccessRule, GameConfig, GameState, ItemDropRule, PaysActionRule } from '../types';

/**
 * Read-only calculations over the game state: sleeve stats, speed, durations, rewards and passive income.
 *
 * @remarks
 * Holds no state of its own; it reads the `GameState` it was given every time, so it always reflects the current game. It computes the
 * sleeve-wide stats once per snapshot and hands every other question to the service of the context that owns it; the methods here only
 * delegate, so a question has one answer wherever it is asked.
 * Called by: `engine.ts`, `actionRunner.ts`, `network.ts`.
 * Calls: `resolveSleeveStats`, {@link ToggleStats}, {@link RunStats}, {@link CritStats}, {@link ItemStats}, {@link IncomeStats}, {@link HeatStats}.
 */
export class DerivedStats implements ModeStatuses {
  private readonly toggles: ToggleStats;
  private readonly run: RunStats;
  private readonly crits: CritStats;
  private readonly items: ItemStats;
  private readonly income: IncomeStats;
  private readonly heat: HeatStats;

  /**
   * Creates the unit.
   *
   * @param config content and tuning
   * @param state the live game state (read only)
   * @param progression XP/level service
   * @param economy reward formulas
   * @param speedModifiers factors of the speed multiplier
   * @param factory number factory
   * @param definition action lookup
   * @param snapshot scope in which the sleeve stats are computed once (default: a private one that is never opened)
   */
  constructor(
    private readonly config: GameConfig,
    private readonly state: GameState,
    private readonly progression: Progression,
    economy: Economy,
    speedModifiers: readonly SpeedModifier[],
    private readonly factory: NumberFactory,
    definition: ActionLookup,
    private readonly snapshot: Snapshot = new Snapshot(),
  ) {
    const sleeve = (): SleeveStats => this.sleeveStats();
    this.toggles = new ToggleStats(config, state, factory, definition, progression, sleeve);
    this.crits = new CritStats(config, state, factory, definition, sleeve);
    this.run = new RunStats(
      config,
      state,
      factory,
      definition,
      economy,
      progression,
      this.toggles,
      sleeve,
      this.crits,
      speedModifiers,
      (id) => bestSynthActionLevel(state, id),
    );
    this.items = new ItemStats(config, state, factory, sleeve);
    this.income = new IncomeStats(config, state, economy, sleeve, (id) => progression.actionLevel(state, id));
    this.heat = new HeatStats(config, state, this.toggles, () => sleeve().idleHeatCooldownActions);
  }

  /** The global sleeve stats (access level, interface speed, heat, ...) after sleeve-wide purchases. */
  sleeveStats(): SleeveStats {
    return this.snapshot.memo('sleeveStats', () =>
      resolveSleeveStats(
        this.config.buyables,
        this.state,
        this.config.sleeve,
        this.factory,
        (id) => this.progression.actionLevel(this.state, id),
        (id) => this.progression.sleeveLevel(this.state, id),
        () => distinctAugmentRarities(this.state.actions),
      ),
    );
  }

  /** The share of node income kept after the heat tax (with the current ICE Rating). */
  creditKeepFactor(): number {
    return this.income.creditKeepFactor();
  }

  /** See {@link RunStats.rewardMultiplier}. */
  rewardMultiplier(id: ActionId): BigNum {
    return this.run.rewardMultiplier(id);
  }

  /** See {@link ItemStats.itemDrops}. */
  itemDrops(id: ActionId): readonly ItemDropRule[] {
    return this.items.itemDrops(id);
  }

  /** See {@link ItemStats.dropSources}. */
  dropSources(itemId: string, rarityId: string): readonly { readonly actionId: ActionId; readonly chance: number }[] {
    return this.items.dropSources(itemId, rarityId);
  }

  /** Hacking Proficiency as it counts: the stored total times the factor of owned `hackingProficiencyMultiplier` buyables. */
  effectiveHackingProficiency(): BigNum {
    return this.items.effectiveHackingProficiency();
  }

  /** The back channel the player has unlocked (an owned `backChannel` buyable), or `null`. */
  backChannel(): BackChannelRule | null {
    return this.items.backChannel();
  }

  /** True when the action restarts itself (an owned, switched-on auto-run buyable). */
  isAutoRun(id: ActionId): boolean {
    return this.toggles.isAutoRun(id);
  }

  /** Chance (0..1) that a completed run is a critical success (owned `criticalChance` buyables). */
  criticalChance(): number {
    return this.crits.criticalChance();
  }

  /** What a critical success does for this action: the global rule with the action's own fields laid over it. @throws Error if the id is unknown */
  criticalRule(id: ActionId): CriticalSuccessRule {
    return this.crits.criticalRule(id);
  }

  /** Chance (0..1) that a critical success brings one extra, free critical success (owned `criticalExtraChance` buyables). */
  criticalExtraChance(): number {
    return this.crits.criticalExtraChance();
  }

  /** See {@link ToggleStats.paysActions}: Overclock's `alsoPays` first, then the owned `paysActionReward` rules. */
  paysActions(id: ActionId): readonly PaysActionRule[] {
    return this.toggles.paysActions(id);
  }

  /** The actions that every critical run of this action banks a guaranteed critical success for (owned `criticalLink` buyables). */
  criticalLinks(id: ActionId): readonly ActionId[] {
    return this.crits.criticalLinks(id);
  }

  /** True when a completed run of this action can be critical now: by chance, by a Zero-day that is switched on, or by a banked success. */
  criticalPossible(id: ActionId): boolean {
    return this.crits.criticalPossible(id);
  }

  /** The most critical successes one completed run of this action can have now (see {@link CritStats.maxCritsPerRun}). */
  maxCritsPerRun(id: ActionId): number {
    return this.crits.maxCritsPerRun(id);
  }

  /** The chain links an action holds now (0 when Overclock is off, the rule has no chain, or the chain is broken). */
  chainLinks(id: ActionId): number {
    return this.toggles.chainLinks(id);
  }

  /** How the start cost share of an action is scaled now (see {@link ToggleStats.startCostScale}). */
  startCostScale(id: ActionId): { readonly factor: number; readonly atLeastOne: boolean } {
    return this.toggles.startCostScale(id);
  }

  /** Seconds of node income paid per node the start cost of this action destroys (0 without a Credit Siphon). */
  siphonSeconds(id: ActionId): number {
    return this.toggles.siphonSeconds(id);
  }

  /** True while an action is running overclocked with an Overclock that stops heat from cooling (see {@link HeatStats.heatCoolingBlocked}). */
  heatCoolingBlocked(): boolean {
    return this.heat.heatCoolingBlocked();
  }

  /** True while no action is in progress, so heat cools at the idle pace (see {@link HeatStats.heatIsIdle}). */
  heatIsIdle(): boolean {
    return this.heat.heatIsIdle();
  }

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return this.toggles.levelBonus(id);
  }

  /** Overclock for an action: its rule scaled by the upgrades, and whether the player has it on (see {@link ToggleStats.overclockStatus}). */
  overclockStatus(id: ActionId): OverclockStatus | null {
    return this.toggles.overclockStatus(id);
  }

  /** Overclock for an action while the player has it switched on, or `null` while it is off or unavailable. */
  activeOverclock(id: ActionId): OverclockStatus | null {
    return this.toggles.activeOverclock(id);
  }

  /** Focus for an action: whether it is focused, and how many of the Focus slots are taken (see {@link ToggleStats.focusStatus}). */
  focusStatus(id: ActionId): FocusStatus | null {
    return this.toggles.focusStatus(id);
  }

  /** Current speed multiplier of an action. */
  currentSpeed(id: ActionId): number {
    return this.run.currentSpeed(id);
  }

  /** The factors the current speed of an action is made of (action level, sleeve level, interface speed, global lever). */
  speedFactors(id: ActionId): readonly SpeedFactor[] {
    return this.run.speedFactors(id);
  }

  /** Current duration of one run of an action, after speed modifiers. @throws Error if the action id is unknown */
  currentDurationMs(id: ActionId): number {
    return this.run.currentDurationMs(id);
  }

  /** Amount earned per completed run (heat does not tax it). @throws Error if the action id is unknown */
  rewardPerRun(id: ActionId): BigNum {
    return this.run.rewardPerRun(id);
  }

  /** What a completed run actually adds now: `rewardPerRun`, rounded down for whole-unit rewards. @throws Error if unknown */
  payoutPerRun(id: ActionId): BigNum {
    return this.run.payoutPerRun(id);
  }

  /** Action XP gained per completed run now. @throws Error if the action id is unknown */
  xpPerRun(id: ActionId): BigNum {
    return this.run.xpPerRun(id);
  }

  /** The most action XP one run can give now (see {@link RunStats.maxXpPerRun}). @throws Error if the id is unknown */
  maxXpPerRun(id: ActionId): BigNum {
    return this.run.maxXpPerRun(id);
  }

  /** Fraction of its size the network grows by per second right now. */
  networkGrowthRate(): number {
    return this.income.networkGrowthRate();
  }

  /** Credits one network node delivers per second right now, after the payout multiplier (the heat tax is not part of it). */
  passiveCreditsPerNode(): BigNum {
    return this.income.passiveCreditsPerNode();
  }

  /** What one node delivers per second right now once the heat tax has taken its share. */
  taxedCreditsPerNode(): BigNum {
    return this.income.taxedCreditsPerNode();
  }

  /** Credits the network delivers per second right now: nodes times the taxed per-node payout. */
  passiveCreditsPerSecond(): BigNum {
    return this.income.passiveCreditsPerSecond();
  }
}
