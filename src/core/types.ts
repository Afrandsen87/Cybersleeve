/**
 * @module core
 *
 * Shared data shapes for the game: configuration, definitions and state.
 * Pure data, no behaviour, no DOM, no timers.
 *
 * @remarks
 * Everything that tunes progression lives in {@link GameConfig}. Definitions (static content)
 * are separate from state (what changes while playing), so content and tuning can change
 * without touching engine code (open/closed).
 */
export * from './actionTypes';
export * from './itemTypes';
export * from './buyableTypes';
export * from './corporationTypes';
export * from './configTypes';
export * from './stateTypes';
