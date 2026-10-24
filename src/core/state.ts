/**
 * @module core
 *
 * Creation and resetting of {@link GameState}.
 */
import type { NumberFactory } from '../numbers';
import type { ActionState, GameConfig, GameState } from './types';

/** A fresh action state: no XP, no sleeve XP, idle. */
function freshActionState(factory: NumberFactory): ActionState {
  return { xp: factory.fromNumber(0), sleeveXp: factory.fromNumber(0), runsTowardSleeveXp: 0, running: false, progressMs: 0 };
}

/**
 * Creates the state of a brand-new game.
 *
 * Called by: `app/createGame.ts`, `serialization.ts`.
 *
 * @param config game content (one entry per action) and `progression.startingCredits`
 * @param factory number factory
 */
export function createInitialState(config: Pick<GameConfig, 'actions' | 'progression' | 'sleeve'>, factory: NumberFactory): GameState {
  const actions: GameState['actions'] = {};
  for (const a of config.actions) actions[a.id] = freshActionState(factory);
  return {
    credits: factory.fromNumber(config.progression.startingCredits),
    network: factory.fromNumber(0),
    heat: config.sleeve.baseHeat,
    heatCooldownMs: 0,
    circumvention: factory.fromNumber(config.sleeve.baseCircumvention),
    infamy: 0,
    infamyCooldownMs: 0,
    networkRemainder: 0,
    nodePayoutBonus: 0,
    unlockedActions: {},
    autoRunOff: {},
    interfaceSpeedBonus: 0,
    actions,
    purchased: {},
  };
}

/**
 * Wipes `state` back to a brand-new game: everything is reset, including the sleeve XP that a re-sleeve keeps.
 *
 * Called by: `engine.ts` (`GameEngine.newGame`).
 *
 * @param state state to mutate (the object identity is kept)
 * @param config game content
 * @param factory number factory
 */
export function resetForNewGame(
  state: GameState,
  config: Pick<GameConfig, 'actions' | 'progression' | 'sleeve'>,
  factory: NumberFactory,
): void {
  Object.assign(state, createInitialState(config, factory));
}

/**
 * Applies a re-sleeve to `state`.
 *
 * @remarks
 * Kept: every action's sleeve XP and its run counter towards the next sleeve-XP batch.
 * Reset: credits (to the starting amount), the network, the interface speed bonus earned by actions, Circumvention, Infamy and its cycle, the node payout bonus, the growth carry, unlocked actions, auto-run switches, heat (to `sleeve.baseHeat`) and its cooldown, all action XP/progress, all purchases.
 *
 * Called by: `engine.ts`.
 *
 * @param state state to mutate
 * @param config game content
 * @param factory number factory
 */
export function resetForResleeve(
  state: GameState,
  config: Pick<GameConfig, 'actions' | 'progression' | 'sleeve'>,
  factory: NumberFactory,
): void {
  const fresh = createInitialState(config, factory);
  state.credits = fresh.credits;
  state.network = fresh.network;
  state.heat = fresh.heat;
  state.heatCooldownMs = fresh.heatCooldownMs;
  state.interfaceSpeedBonus = fresh.interfaceSpeedBonus;
  state.circumvention = fresh.circumvention;
  state.infamy = fresh.infamy;
  state.infamyCooldownMs = fresh.infamyCooldownMs;
  state.networkRemainder = fresh.networkRemainder;
  state.nodePayoutBonus = fresh.nodePayoutBonus;
  state.unlockedActions = fresh.unlockedActions;
  state.autoRunOff = fresh.autoRunOff;
  for (const [id, action] of Object.entries(fresh.actions)) {
    const old = state.actions[id];
    if (old) {
      action.sleeveXp = old.sleeveXp;
      action.runsTowardSleeveXp = old.runsTowardSleeveXp;
    }
  }
  state.actions = fresh.actions;
  state.purchased = fresh.purchased;
}
