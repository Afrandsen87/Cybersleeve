/**
 * @module core
 *
 * Creation and resetting of {@link GameState}.
 */
import type { NumberFactory } from '../numbers';
import { initialScalars } from './fields';
import type { ActionState, Currency, GameConfig, GameState } from './types';

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
  | 'actions'
  | 'purchased'
  | 'inventory'
  | 'runs'
  | 'synths'
>;

/** Config the state is created and reset from. */
type StateConfig = Pick<GameConfig, 'actions' | 'progression' | 'sleeve'>;

/**
 * The currencies whose buyables survive a re-sleeve: re-sleeve skills are permanent. Skills paid in skill points (and everything else
 * bought) reset with the sleeve.
 */
export const CARRIED_OVER_BUYABLE_CURRENCIES = ['resleevePoints'] as const satisfies readonly Currency[];

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
export function createInitialState(config: StateConfig, factory: NumberFactory): GameState {
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
    runs: [],
    synths: [],
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
export function resetForNewGame(state: GameState, config: StateConfig, factory: NumberFactory): void {
  Object.assign(state, createInitialState(config, factory));
}

/**
 * Applies a re-sleeve to `state`.
 *
 * @remarks
 * Starts from a fresh game state and carries over only what is named on the positive lists: {@link CARRIED_OVER_ACTION_FIELDS} (every
 * action's sleeve XP and its run counter towards the next sleeve-XP batch), the record of finished runs and the synthetic sleeves
 * (`runs`, `synths`), and the owned buyables paid in a currency of {@link CARRIED_OVER_BUYABLE_CURRENCIES} (the re-sleeve skills).
 * Everything else resets, including fields added in the future (nothing has to be listed to be reset; to carry something over, add it
 * to a list).
 *
 * Called by: `resleever.ts`.
 *
 * @param state state to mutate
 * @param config game content (`buyables` decides which purchases are carried over)
 * @param factory number factory
 */
export function resetForResleeve(state: GameState, config: StateConfig & Pick<GameConfig, 'buyables'>, factory: NumberFactory): void {
  const fresh = createInitialState(config, factory);
  for (const [id, action] of Object.entries(fresh.actions)) {
    const old = state.actions[id];
    if (old) Object.assign(action, pickCarried(old));
  }
  fresh.runs = state.runs;
  fresh.synths = state.synths;
  const carried = new Set<string>(CARRIED_OVER_BUYABLE_CURRENCIES);
  for (const b of config.buyables) {
    const owned = state.purchased[b.id] ?? 0;
    if (owned > 0 && b.currency !== undefined && carried.has(b.currency)) fresh.purchased[b.id] = owned;
  }
  Object.assign(state, fresh);
}
