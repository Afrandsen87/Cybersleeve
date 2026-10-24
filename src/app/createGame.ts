/**
 * @module app
 *
 * Composition root: the one place where concrete implementations are wired together.
 */
import { gameConfig } from '../content/gameConfig';
import {
  Economy,
  GameEngine,
  Progression,
  Shop,
  alwaysAllowResleeve,
  createClampOverflowPolicy,
  createInitialState,
  createSpeedModifiers,
  validateConfig,
  type GameConfig,
  type GameState,
} from '../core';
import { numberFactory, type NumberFactory } from '../numbers';

/** Optional overrides, mainly for tests. */
export interface CreateGameOptions {
  config?: GameConfig;
  state?: GameState;
  factory?: NumberFactory;
}

/**
 * Builds a fully wired {@link GameEngine}.
 *
 * Called by: `main.ts`, tests.
 * Calls: `validateConfig`, `createInitialState`, `createSpeedModifiers`, constructors of `Progression`, `Shop`, `Economy`, `GameEngine`.
 *
 * @param options overrides for config, initial state and number factory
 * @returns a ready engine
 * @throws Error listing every problem if the configuration is invalid
 */
export function createGame(options: CreateGameOptions = {}): GameEngine {
  const config = options.config ?? gameConfig;
  const problems = validateConfig(config);
  if (problems.length > 0) throw new Error(`Invalid game configuration:\n- ${problems.join('\n- ')}`);

  const factory = options.factory ?? numberFactory;
  const state = options.state ?? createInitialState(config, factory);
  return new GameEngine(config, state, {
    progression: new Progression(config, factory),
    shop: new Shop(config.buyables, factory, config.global.costMultiplier),
    economy: new Economy(config, factory),
    speedModifiers: createSpeedModifiers(config),
    resleevePolicy: alwaysAllowResleeve,
    overflowPolicy: createClampOverflowPolicy(factory),
    factory,
  });
}
