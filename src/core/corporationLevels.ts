/**
 * @module core
 *
 * The action levels of the corporation's actions.
 */
import type { BigNum, NumberFactory } from '../numbers';
import { LevelRule } from './level';
import type { CorporationActionId, CorporationState, GameConfig } from './types';

/**
 * Action XP and action levels of the corporation's actions.
 *
 * @remarks
 * Same rule as the character's action levels (`progression.actionLevels`, see {@link LevelRule}), but a corporation action has no
 * sleeve levels, no XP reductions and no delays, and its level does not change its run time (nothing does: see `Corporation`).
 * The XP is kept as one running total per action (`CorporationActionState.xp`).
 *
 * Called by: `corporation.ts` (awards XP), `engine.ts` (queries). Calls: {@link LevelRule}.
 */
export class CorporationLevels {
  private readonly rule: LevelRule;
  private readonly zero: BigNum;
  private readonly xpPerRun = new Map<CorporationActionId, BigNum>();

  /**
   * Creates the unit.
   *
   * @param config reads `progression.actionLevels` and each corporation action's `xpPerRun` (default 1)
   * @param state the live game state (mutated: the XP of `corporation.actions`)
   * @param factory number factory
   */
  constructor(
    config: Pick<GameConfig, 'corporation' | 'progression'>,
    private readonly state: { corporation: CorporationState },
    private readonly factory: NumberFactory,
  ) {
    this.rule = new LevelRule(config.progression.actionLevels, this.factory);
    this.zero = this.factory.fromNumber(0);
    for (const a of config.corporation?.actions ?? []) this.xpPerRun.set(a.id, this.factory.fromNumber(a.xpPerRun ?? 1));
  }

  private xp(id: CorporationActionId): BigNum {
    return this.state.corporation.actions[id]?.xp ?? this.zero;
  }

  /** Gives an action the XP of `runs` completed runs. Does nothing for an unknown action. */
  award(id: CorporationActionId, runs: number): void {
    const action = this.state.corporation.actions[id];
    const perRun = this.xpPerRun.get(id);
    if (action && perRun) action.xp = action.xp.add(perRun.mul(this.factory.fromNumber(runs)));
  }

  /** The action level (0 at the start). */
  level(id: CorporationActionId): number {
    return this.rule.levelForXp(this.xp(id));
  }

  /** XP gathered inside the current level. */
  xpIntoLevel(id: CorporationActionId): BigNum {
    return this.rule.xpIntoLevel(this.xp(id));
  }

  /** XP the current level costs on its own. */
  xpForLevel(id: CorporationActionId): BigNum {
    return this.rule.xpCostOfLevel(this.level(id));
  }

  /** How far through the current level the action is, from 0 to 1. */
  progress(id: CorporationActionId): number {
    return this.rule.progressFraction(this.xp(id));
  }
}
