/**
 * @module core
 *
 * Creation and resetting of {@link GameState}.
 */
import type { NumberFactory } from '../../numbers';
import { traitsOf } from '../effects/effectTraits';
import { createAutomationState } from '../automation/automation';
import { createCorporationState } from '../corporation/corporationState';
import { carryRetention, recordLastLife } from '../resleeve/resleeveCarry';
import { CARRIED_OVER_CURRENCIES } from '../kernel/currencies';
import { initialScalars } from '../kernel/fields';
import type { ActionState, Currency, GameConfig, GameState, SleeveState, Wallet } from '../types';

/** Config the state is created and reset from. */
type StateConfig = Pick<GameConfig, 'actions' | 'automation' | 'corporation' | 'progression' | 'sleeve'>;

/**
 * The currencies whose buyables survive a re-sleeve: re-sleeve skills are permanent. Skills paid in skill points (and everything else
 * bought) reset with the sleeve.
 */
export const CARRIED_OVER_BUYABLE_CURRENCIES: readonly Currency[] = CARRIED_OVER_CURRENCIES;

/**
 * THE positive list of what survives a re-sleeve: these per-action fields. Nothing else carries over; everything not
 * named here (scalars, purchases, inventory, action XP, ...) resets, including anything added to the state later.
 * The sleeve level is derived from `sleeveXp`; `runsTowardSleeveXp` is the partial progress to the next sleeve XP.
 */
export const CARRIED_OVER_ACTION_FIELDS = ['sleeveXp', 'runsTowardSleeveXp'] as const satisfies readonly (keyof ActionState)[];

/**
 * The positive list of the wallet fields a re-sleeve keeps as they are: the record of finished runs, the synthetic sleeves, the corporation (it is
 * not the character) and the all-time peak statistics. The rest of the wallet resets (`lastLifePurchases` is rewritten and `automation` kept only by a
 * retention skill, see `resleeveCarry.ts`).
 */
export const CARRIED_OVER_WALLET_FIELDS = [
  'runs',
  'synths',
  'corporation',
  'allTimePeakCredits',
  'allTimePeakNetwork',
] as const satisfies readonly (keyof Wallet)[];

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
  const actions: SleeveState['actions'] = {};
  for (const a of config.actions) actions[a.id] = freshActionState(factory);
  const scalars = initialScalars(config, factory);
  return {
    wallet: {
      ...(scalars.wallet as Pick<Wallet, 'credits' | 'allTimePeakCredits' | 'allTimePeakNetwork'>),
      lastLifePurchases: {},
      runs: [],
      synths: [],
      automation: createAutomationState(config),
      corporation: createCorporationState(config.corporation, factory),
      inventory: {},
    },
    sleeve: {
      ...(scalars.sleeve as Pick<
        SleeveState,
        | 'peakCredits'
        | 'network'
        | 'peakNetwork'
        | 'heat'
        | 'heatCooldownMs'
        | 'iceRating'
        | 'legend'
        | 'legendCooldownMs'
        | 'resleeveLockoutMs'
        | 'moles'
        | 'networkRemainder'
        | 'nodePayoutBonus'
        | 'hackingProficiency'
      >),
      autoRunOff: {},
      overclocked: {},
      focused: {},
      focusStacks: {},
      keyToggles: {},
      chains: {},
      bankedCriticals: {},
      actions,
      purchased: {},
    },
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
  const fresh = createInitialState(config, factory);
  state.wallet = fresh.wallet;
  state.sleeve = fresh.sleeve;
}

/**
 * Applies a re-sleeve to `state`.
 *
 * @remarks
 * Starts from a fresh game state and carries over only what is named on the positive lists: {@link CARRIED_OVER_ACTION_FIELDS} (every
 * action's sleeve XP and its run counter towards the next sleeve-XP batch), {@link CARRIED_OVER_WALLET_FIELDS} (the record of finished runs, the
 * synthetic sleeves, the corporation, the all-time peaks), and the owned buyables paid in a currency of {@link CARRIED_OVER_BUYABLE_CURRENCIES} (the re-sleeve skills) or
 * with an effect of a `carriedOverResleeve` effect trait (the sleeve-levels unlock, the corporate rank).
 * The retention skills add to that (see `resleeveCarry.ts`): a record of last life's action-card purchases, the Automation tab, and shares of
 * Hacking Proficiency and ICE Rating. Everything else resets, including fields added in the future (nothing has to be listed to be reset; to carry something over, add it
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
  for (const [id, action] of Object.entries(fresh.sleeve.actions)) {
    const old = state.sleeve.actions[id];
    if (old) Object.assign(action, pickCarried(old));
  }
  const keep = fresh.wallet as unknown as Record<string, unknown>;
  for (const key of CARRIED_OVER_WALLET_FIELDS) keep[key] = state.wallet[key];
  const carried = new Set<string>(CARRIED_OVER_BUYABLE_CURRENCIES);
  for (const b of config.buyables) {
    const owned = state.sleeve.purchased[b.id] ?? 0;
    const kept = (b.currency !== undefined && carried.has(b.currency)) || traitsOf(b).carriedOverResleeve === true;
    if (owned > 0 && kept) fresh.sleeve.purchased[b.id] = owned;
  }
  recordLastLife(state, fresh, config.buyables);
  carryRetention(state, fresh, config.buyables, factory);
  state.wallet = fresh.wallet;
  state.sleeve = fresh.sleeve;
}
