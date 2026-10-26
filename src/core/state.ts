/**
 * @module core
 *
 * Creation and resetting of {@link GameState}.
 */
import type { NumberFactory } from '../numbers';
import { createAutomationState } from './automation';
import { initialScalars } from './fields';
import type { ActionState, GameConfig, GameState } from './types';

/** The scalar fields of the state (see `fields.ts`). */
type ScalarKey = Exclude<
  keyof GameState,
  | 'autoRunOff'
  | 'overclocked'
  | 'focused'
  | 'zeroDaysOn'
  | 'adminKeysOn'
  | 'chains'
  | 'bankedCriticals'
  | 'automation'
  | 'actions'
  | 'purchased'
  | 'inventory'
>;

/**
 * THE positive list of what survives a re-sleeve: these per-action fields. Nothing else carries over; everything not
 * named here (scalars, purchases, inventory, action XP, ...) resets, including anything added to the state later.
 * The sleeve level is derived from `sleeveXp`; `runsTowardSleeveXp` is the partial progress to the next sleeve XP.
 */
export const CARRIED_OVER_ACTION_FIELDS = ['sleeveXp', 'runsTowardSleeveXp'] as const satisfies readonly (keyof ActionState)[];

/** The carried-over part of one action's state. */
function pickCarried(action: ActionState): Partial<ActionState> {
  const carried: Record<string, unknown> = {};
  for (const key of CARRIED_OVER_ACTION_FIELDS) carried[key] = action[key];
  return carried as Partial<ActionState>;
}

/** A fresh action state: no XP, no sleeve XP, idle. */
function freshActionState(factory: NumberFactory): ActionState {
  return {
    xp: factory.fromNumber(0),
    sleeveXp: factory.fromNumber(0),
    runsTowardSleeveXp: 0,
    augments: {},
    skillShards: 0,
    running: false,
    progress: 0,
  };
}

/**
 * Creates the state of a brand-new game.
 *
 * Called by: `app/createGame.ts`, `serialization.ts`.
 *
 * @param config game content (one entry per action) and `progression.startingCredits`
 * @param factory number factory
 */
export function createInitialState(
  config: Pick<GameConfig, 'actions' | 'automation' | 'progression' | 'sleeve'>,
  factory: NumberFactory,
): GameState {
  const actions: GameState['actions'] = {};
  for (const a of config.actions) actions[a.id] = freshActionState(factory);
  return {
    ...(initialScalars(config, factory) as Pick<GameState, ScalarKey>),
    autoRunOff: {},
    overclocked: {},
    focused: {},
    zeroDaysOn: false,
    adminKeysOn: false,
    chains: {},
    bankedCriticals: {},
    automation: createAutomationState(config),
    actions,
    purchased: {},
    inventory: {},
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
  config: Pick<GameConfig, 'actions' | 'automation' | 'progression' | 'sleeve'>,
  factory: NumberFactory,
): void {
  Object.assign(state, createInitialState(config, factory));
}

/**
 * Applies a re-sleeve to `state`.
 *
 * @remarks
 * Starts from a fresh game state and carries over only what {@link CARRIED_OVER_ACTION_FIELDS} names: every action's
 * sleeve XP and its run counter towards the next sleeve-XP batch. Everything else resets, including fields added in the
 * future (nothing has to be listed to be reset; to carry something over, add it to the list).
 *
 * Called by: `engine.ts`.
 *
 * @param state state to mutate
 * @param config game content
 * @param factory number factory
 */
export function resetForResleeve(
  state: GameState,
  config: Pick<GameConfig, 'actions' | 'automation' | 'progression' | 'sleeve'>,
  factory: NumberFactory,
): void {
  const fresh = createInitialState(config, factory);
  for (const [id, action] of Object.entries(fresh.actions)) {
    const old = state.actions[id];
    if (old) Object.assign(action, pickCarried(old));
  }
  Object.assign(state, fresh);
}
