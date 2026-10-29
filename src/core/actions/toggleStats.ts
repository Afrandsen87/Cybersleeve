/**
 * @module core
 *
 * What the per-action switches and run modifiers of an action are now: auto-run, Overclock (and its chain), Focus, start cost scale,
 * Credit Siphon, linked payouts and the level bonus. Read only.
 */
import type { NumberFactory } from '../../numbers';
import { resolveEffects, resolveLevelBonus, type SleeveStats } from '../effects/effects';
import type { ActionId, GameConfig, GameState, PaysActionRule } from '../types';
import type { ActionLookup } from './actionLookup';
import type { FocusStatus, ModeStatuses, OverclockStatus } from './actionToggles';
import type { Progression } from './progression';

/**
 * Answers the questions about an action's switches. Holds no state; reads the `GameState` it was given every time.
 *
 * Called by: `DerivedStats` (the facade), `runStats.ts`. Calls: `resolveEffects`, `resolveLevelBonus`, {@link Progression}.
 */
export class ToggleStats implements ModeStatuses {
  /**
   * Creates the unit.
   *
   * @param config reads `buyables`, `actions` and `focus`
   * @param state the live game state (read only)
   * @param factory number factory
   * @param definition action lookup
   * @param progression action and sleeve levels
   * @param sleeveStats the sleeve-wide stats (computed once per snapshot by the facade)
   */
  constructor(
    private readonly config: Pick<GameConfig, 'buyables' | 'actions' | 'focus'>,
    private readonly state: GameState,
    private readonly factory: NumberFactory,
    private readonly definition: ActionLookup,
    private readonly progression: Pick<Progression, 'actionLevel' | 'sleeveLevel'>,
    private readonly sleeveStats: () => SleeveStats,
  ) {}

  /** True when the action restarts itself (an owned, switched-on auto-run buyable). */
  isAutoRun(id: ActionId): boolean {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).autoRun;
  }

  /**
   * What each completed run of the action may also pay: one reward of another action, by chance. The one source list of linked payouts:
   * Overclock's `alsoPays` (a certain chance, first) and the owned `paysActionReward` buyables.
   */
  paysActions(id: ActionId): readonly PaysActionRule[] {
    const owned = this.sleeveStats().paysActions.filter((rule) => rule.sourceActionId === id);
    const also = this.activeOverclock(id)?.alsoPays;
    return !also ? owned : [{ sourceActionId: id, targetActionId: also, chance: 1 }, ...owned];
  }

  /**
   * The chain links an action holds now: what its runs have built up while Overclock is on (0 when Overclock is off, the rule has no chain,
   * or the chain is broken).
   */
  chainLinks(id: ActionId): number {
    const chain = this.activeOverclock(id)?.chain;
    return chain ? Math.min(chain.maxLinks, this.state.sleeve.chains[id] ?? 0) : 0;
  }

  /**
   * How the start cost share of an action is scaled now: `factor` is `(1 - perLevel)^level` for every owned `startCostReduction` buyable of
   * the action, times `1 + links x nodesPerLink` while an Overclock chain is held; `atLeastOne` says a node cost that rounds down to 0 is
   * raised to 1 (a reduction is owned, so the cost must never vanish).
   */
  startCostScale(id: ActionId): { readonly factor: number; readonly atLeastOne: boolean } {
    const { startCostReductions } = resolveEffects(this.config.buyables, this.state, id, this.factory);
    const level = this.progression.actionLevel(this.state, id);
    let factor = 1;
    for (const perLevel of startCostReductions) factor *= (1 - perLevel) ** level;
    const chain = this.activeOverclock(id)?.chain;
    if (chain) factor *= 1 + this.chainLinks(id) * chain.nodesPerLink;
    return { factor, atLeastOne: startCostReductions.length > 0 };
  }

  /** Seconds of node income paid per node the start cost of this action destroys (0 without a Credit Siphon). */
  siphonSeconds(id: ActionId): number {
    return resolveEffects(this.config.buyables, this.state, id, this.factory).siphonSeconds;
  }

  /** Levels added to an action's level for speed by buyables; its XP progress is not affected. */
  levelBonus(id: ActionId): number {
    return resolveLevelBonus(this.config.buyables, this.state, id, (source) => this.progression.sleeveLevel(this.state, source));
  }

  /**
   * Overclock for an action: its rule scaled by the strength of the owned Overclock upgrades, and whether the player has it on.
   * @returns the status, or `null` while the action's Overclock is not unlocked or the action has no Overclock rule (then there is no toggle)
   * @throws Error if the action id is unknown
   */
  overclockStatus(id: ActionId): OverclockStatus | null {
    const rule = this.definition(id).overclock;
    const owned = resolveEffects(this.config.buyables, this.state, id, this.factory);
    if (!rule || !owned.overclockUnlocked) return null;
    const chain = owned.chain;
    const strength = this.sleeveStats().overclockStrength;
    const on = this.state.sleeve.overclocked[id] === true;
    return {
      on,
      blocksHeatCooling: rule.stopsHeatCooling === true,
      chain: chain
        ? {
            links: on ? Math.min(chain.maxLinks, this.state.sleeve.chains[id] ?? 0) : 0,
            maxLinks: chain.maxLinks,
            rewardPerLink: chain.rewardPerLink * strength,
            nodesPerLink: chain.nodesPerLink,
          }
        : null,
      speedBonus: (rule.speedBonus ?? 0) * strength,
      rewardBonus: (rule.rewardBonus ?? 0) * strength,
      heatPerMinute: rule.heatPerMinute ?? 0,
      heatPerRunFactor: Math.min(rule.heatPerRunFactor ?? 1, this.sleeveStats().overclockHeatFactors[id] ?? Infinity),
      heatChanceFactor: rule.heatChanceFactor ?? 1,
      completionEffects: rule.completionEffects ?? [],
      alsoPays: rule.alsoPays ?? null,
      strength,
    };
  }

  /** Overclock for an action while the player has it switched on (what it does to the action now), or `null` while it is off or unavailable. */
  activeOverclock(id: ActionId): OverclockStatus | null {
    if (this.state.sleeve.overclocked[id] !== true) return null;
    const status = this.overclockStatus(id);
    return status?.on ? status : null;
  }

  /**
   * Focus for an action: whether it is focused, and how many of the Focus slots are taken.
   * @returns the status, or `null` while the action's Focus is not unlocked (then there is no toggle)
   * @throws Error if the action id is unknown
   */
  focusStatus(id: ActionId): FocusStatus | null {
    this.definition(id);
    if (!resolveEffects(this.config.buyables, this.state, id, this.factory).focusUnlocked) return null;
    const { speedBonus, baseSlots } = this.config.focus;
    const { extraFocusSlots, focusStacking } = this.sleeveStats();
    const slots = baseSlots + extraFocusSlots;
    const slotsOn = (actionId: ActionId): number =>
      this.state.sleeve.focused[actionId] === true ? 1 + (focusStacking ? (this.state.sleeve.focusStacks[actionId] ?? 0) : 0) : 0;
    const count = slotsOn(id);
    const used = this.config.actions.reduce((n, a) => n + slotsOn(a.id), 0);
    // every slot on the action multiplies its speed by the bonus again
    return {
      on: count > 0,
      speedBonus: (1 + speedBonus) ** Math.max(1, count) - 1,
      slots,
      used,
      canSwitchOn: count > 0 || used < slots,
      count,
      stacking: focusStacking,
      canAdd: used < slots && (count === 0 || focusStacking),
      canRemove: count > 0,
    };
  }
}
