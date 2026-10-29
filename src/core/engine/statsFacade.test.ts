/**
 * `DerivedStats` only composes: every question it answers equals the answer of the service of the context that owns it, built on the
 * same inputs. The game is played a while with purchases of several kinds, so the answers are not just the defaults.
 */
import { describe, expect, it } from 'vitest';
import { numberFactory } from '../../numbers';
import { buy, cyberneticsConfig, cyberneticsGame } from '../../testing/cyberneticsKit';
import { createActionLookup } from '../actions/actionLookup';
import { Progression } from '../actions/progression';
import { RunStats } from '../actions/runStats';
import { createSpeedModifiers } from '../actions/speed';
import { ToggleStats } from '../actions/toggleStats';
import { CritStats } from '../crits/critStats';
import { Economy } from '../economy/economy';
import { IncomeStats } from '../economy/incomeStats';
import { HeatStats } from '../heat/heatStats';
import { ItemStats } from '../items/itemStats';
import { bestSynthActionLevel } from '../synth/synthSleeves';
import type { GameState } from '../types';
import { DerivedStats } from './stats';

const FACTORY = numberFactory;

/** A played game and the facade and services built beside the engine's own, on the same state. */
function setup() {
  const config = cyberneticsConfig([
    buy({ id: 'x2', actionId: 'a', effect: { kind: 'rewardMultiplier', factor: 2 } }),
    buy({ id: 'tap', effect: { kind: 'paysActionReward', sourceActionId: 'a', targetActionId: 'net', chance: 0.5 } }),
    buy({ id: 'income', effect: { kind: 'nodePayoutMultiplier', factor: 3 } }),
  ]);
  const g = cyberneticsGame(config);
  for (const id of ['auto', 'crit', 'x2', 'tap']) g.buy(id);
  g.startAction('a');
  g.tick(35_000);
  const state = g.getState() as GameState;
  state.network = FACTORY.fromNumber(40);
  state.heat = 12;
  const progression = new Progression(config, FACTORY);
  const economy = new Economy(config, FACTORY);
  const definition = createActionLookup(config.actions);
  const modifiers = createSpeedModifiers(config);
  const facade = new DerivedStats(config, state, progression, economy, modifiers, FACTORY, definition);
  const sleeve = () => facade.sleeveStats();
  const toggles = new ToggleStats(config, state, FACTORY, definition, progression, sleeve);
  const crits = new CritStats(config, state, FACTORY, definition, sleeve);
  const run = new RunStats(config, state, FACTORY, definition, economy, progression, toggles, sleeve, crits, modifiers, (id) =>
    bestSynthActionLevel(state, id),
  );
  const items = new ItemStats(config, state, FACTORY, sleeve);
  const income = new IncomeStats(config, state, economy, sleeve, (id) => progression.actionLevel(state, id));
  const heat = new HeatStats(config, state, toggles, () => sleeve().idleHeatCooldownActions);
  return { config, facade, toggles, crits, run, items, income, heat, state };
}

const big = (x: { toNumber(): number }) => x.toNumber();

describe('DerivedStats equals the services it composes', () => {
  const s = setup();
  const ids = s.config.actions.map((a) => a.id);

  it('run questions (RunStats)', () => {
    for (const id of ids) {
      expect(s.facade.currentSpeed(id)).toBe(s.run.currentSpeed(id));
      expect(s.facade.currentDurationMs(id)).toBe(s.run.currentDurationMs(id));
      expect(big(s.facade.rewardMultiplier(id))).toBe(big(s.run.rewardMultiplier(id)));
      expect(big(s.facade.rewardPerRun(id))).toBe(big(s.run.rewardPerRun(id)));
      expect(big(s.facade.payoutPerRun(id))).toBe(big(s.run.payoutPerRun(id)));
      expect(big(s.facade.xpPerRun(id))).toBe(big(s.run.xpPerRun(id)));
      expect(big(s.facade.maxXpPerRun(id))).toBe(big(s.run.maxXpPerRun(id)));
      expect(s.facade.speedFactors(id)).toEqual(s.run.speedFactors(id));
    }
  });

  it('toggle questions (ToggleStats)', () => {
    for (const id of ids) {
      expect(s.facade.isAutoRun(id)).toBe(s.toggles.isAutoRun(id));
      expect(s.facade.paysActions(id)).toEqual(s.toggles.paysActions(id));
      expect(s.facade.startCostScale(id)).toEqual(s.toggles.startCostScale(id));
      expect(s.facade.overclockStatus(id)).toEqual(s.toggles.overclockStatus(id));
      expect(s.facade.focusStatus(id)).toEqual(s.toggles.focusStatus(id));
      expect(s.facade.chainLinks(id)).toBe(s.toggles.chainLinks(id));
      expect(s.facade.levelBonus(id)).toBe(s.toggles.levelBonus(id));
    }
  });

  it('critical questions (CritStats)', () => {
    expect(s.facade.criticalChance()).toBe(s.crits.criticalChance());
    for (const id of ids) {
      expect(s.facade.criticalRule(id)).toEqual(s.crits.criticalRule(id));
      expect(s.facade.criticalPossible(id)).toBe(s.crits.criticalPossible(id));
      expect(s.facade.maxCritsPerRun(id)).toBe(s.crits.maxCritsPerRun(id));
      expect(s.facade.criticalLinks(id)).toEqual(s.crits.criticalLinks(id));
    }
  });

  it('item questions (ItemStats)', () => {
    for (const id of ids) expect(s.facade.itemDrops(id)).toEqual(s.items.itemDrops(id));
    expect(big(s.facade.effectiveHackingProficiency())).toBe(big(s.items.effectiveHackingProficiency()));
    expect(s.facade.backChannel()).toEqual(s.items.backChannel());
  });

  it('income questions (IncomeStats): the per-second income is the node count times the taxed income of one node', () => {
    expect(big(s.facade.passiveCreditsPerSecond())).toBe(big(s.income.passiveCreditsPerSecond()));
    expect(big(s.facade.taxedCreditsPerNode())).toBe(big(s.income.taxedCreditsPerNode()));
    expect(big(s.facade.passiveCreditsPerNode())).toBe(big(s.income.passiveCreditsPerNode()));
    expect(s.facade.creditKeepFactor()).toBe(s.income.creditKeepFactor());
    expect(s.facade.networkGrowthRate()).toBe(s.income.networkGrowthRate());
    const perSecond = s.income.taxedCreditsPerNode().toNumber() * s.state.network.toNumber();
    expect(s.income.passiveCreditsPerSecond().toNumber()).toBeCloseTo(perSecond, 9);
  });

  it('heat questions (HeatStats)', () => {
    expect(s.facade.heatCoolingBlocked()).toBe(s.heat.heatCoolingBlocked());
    expect(s.facade.heatIsIdle()).toBe(s.heat.heatIsIdle());
  });
});
