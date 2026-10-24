/**
 * @module core
 *
 * Creation and resetting of {@link GameState}.
 */
import type { NumberFactory } from '../numbers';
import { initialScalars } from './fields';
import type { ActionState, GameConfig, GameState } from './types';

/** The scalar fields of the state (see `fields.ts`). */
type ScalarKey = Exclude<keyof GameState, 'unlockedActions' | 'autoRunOff' | 'actions' | 'purchased'>;

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
    ...(initialScalars(config, factory) as Pick<GameState, ScalarKey>),
    unlockedActions: {},
    autoRunOff: {},
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
 * Starts from a fresh game state and carries over only what survives: every action's sleeve XP and its run counter
 * towards the next sleeve-XP batch. Everything else resets, including fields added in the future (nothing has to be
 * listed here to be reset).
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
  for (const [id, action] of Object.entries(fresh.actions)) {
    const old = state.actions[id];
    if (old) {
      action.sleeveXp = old.sleeveXp;
      action.runsTowardSleeveXp = old.runsTowardSleeveXp;
    }
  }
  Object.assign(state, fresh);
}
