/**
 * @module app
 *
 * Composition root: the one place where concrete implementations are wired together.
 */
import { gameConfig } from '../content/gameConfig';
import {
  ActionRunner,
  DerivedStats,
  ActionToggles,
  Augments,
  BackChannel,
  BurnLeads,
  CriticalLinks,
  CriticalSuccesses,
  Economy,
  GameEngine,
  Inventory,
  ItemDrops,
  NetworkSystem,
  Progression,
  Shop,
  alwaysAllowResleeve,
  createActionLookup,
  createClampOverflowPolicy,
  createInitialState,
  createSpeedModifiers,
  earnedSkillPoints,
  silentDiagnostics,
  Snapshot,
  SkillShards,
  ZeroDays,
  validateConfig,
  type Diagnostics,
  type GameConfig,
  type GameState,
  type RandomSource,
} from '../core';
import { numberFactory, type NumberFactory } from '../numbers';

/** Optional overrides, mainly for tests. */
export interface CreateGameOptions {
  config?: GameConfig;
  state?: GameState;
  factory?: NumberFactory;
  /** Receives warnings about dropped game time (default: ignored). */
  diagnostics?: Diagnostics;
  /** Randomness for item drops (default: `Math.random`). Inject a seeded one for reproducible tests. */
  random?: RandomSource;
}

/**
 * Builds a fully wired {@link GameEngine}.
 *
 * Called by: `main.ts`, tests.
 * Calls: `validateConfig`, `createInitialState`, `createSpeedModifiers`, constructors of `Progression`, `Shop`, `Economy`,
 * `DerivedStats`, `ActionRunner`, `NetworkSystem`, `GameEngine`.
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
  const progression = new Progression(config, factory);
  const snapshot = new Snapshot();
  const shop = new Shop(
    config.buyables,
    factory,
    config.global.costMultiplier,
    (s) => earnedSkillPoints(config.actions.map((a) => progression.actionLevel(s, a.id))),
    snapshot,
  );
  const economy = new Economy(config, factory);
  const definition = createActionLookup(config.actions);
  const stats = new DerivedStats(config, state, progression, economy, createSpeedModifiers(config), factory, definition, snapshot);
  const diagnostics = options.diagnostics ?? silentDiagnostics;
  const inventory = new Inventory(config, state, factory);
  const random = options.random ?? Math.random;
  const drops = new ItemDrops(config, stats, inventory, random);
  const criticals = new CriticalSuccesses(stats, random);
  const zeroDays = new ZeroDays(config, state, inventory);
  const adminKeys = new ZeroDays(config, state, inventory, 'adminKey', random);
  const links = new CriticalLinks(stats, state);
  const runner = new ActionRunner(
    config,
    state,
    stats,
    progression,
    economy,
    factory,
    definition,
    drops,
    criticals,
    zeroDays,
    adminKeys,
    links,
    diagnostics,
  );
  return new GameEngine(config, state, {
    progression,
    shop,
    stats,
    runner,
    inventory,
    backChannel: new BackChannel(state, stats, inventory),
    burnLeads: new BurnLeads(config, state, inventory, () => stats.heatCoolingBlocked()),
    zeroDays,
    adminKeys,
    skillShards: new SkillShards(config, state, inventory, (id) => runner.isUnlocked(id), random),
    toggles: new ActionToggles(state, stats),
    drops,
    augments: new Augments(config, state, inventory),
    network: new NetworkSystem(state, stats, factory),
    resleevePolicy: alwaysAllowResleeve,
    overflowPolicy: createClampOverflowPolicy(factory),
    factory,
    snapshot,
  });
}
