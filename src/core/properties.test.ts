import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { gameConfig } from '../content/gameConfig';
import { num, numberFactory } from '../numbers';
import { findInvariantViolations } from '../testing/invariants';
import { pick, randomInt, seededRandom, type Random } from '../testing/random';
import {
  killAction,
  legendAction,
  malwareAction,
  networkAction,
  payoutAction,
  percentKillAction,
  practiceAction,
  testConfig,
} from '../testing/testConfig';
import { createConfig, deserializeState, serializeState, type BuyableDefinition, type GameConfig, type GameEngine } from './index';

const buyable = (b: Partial<BuyableDefinition> & Pick<BuyableDefinition, 'id' | 'effect'>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(5),
  ...b,
});

/** The test content plus every kind of action and some buyables to own, so random play reaches every code path. */
const richTestConfig: GameConfig = createConfig(testConfig, {
  actions: [
    testConfig.actions[0]!,
    networkAction,
    killAction,
    percentKillAction,
    payoutAction,
    legendAction,
    practiceAction,
    malwareAction,
  ],
  buyables: [
    ...testConfig.buyables,
    buyable({ id: 'unlock', effect: { kind: 'unlock' } }),
    buyable({ id: 'net-auto', actionId: 'net', effect: { kind: 'autoRun' } }),
    buyable({ id: 'net-x2', actionId: 'net', costGrowth: 3, maxPurchases: Infinity, effect: { kind: 'rewardMultiplier', factor: 2 } }),
    buyable({ id: 'grow', actionId: 'net', effect: { kind: 'networkGrowth', ratePerSecond: 0.001 } }),
    buyable({
      id: 'grow-lvl',
      actionId: 'net',
      effect: { kind: 'networkGrowthFromActionLevel', sourceActionId: 'net', percentPerLevel: 0.05 },
    }),
    buyable({ id: 'syn', actionId: 'net', effect: { kind: 'interfaceSpeedPerLnNodes', perLn: 0.01 } }),
    buyable({
      id: 'circ',
      actionId: 'push',
      costGrowth: 2,
      maxPurchases: Infinity,
      effect: { kind: 'iceRatingMultiplier', factor: 2 },
    }),
    buyable({ id: 'payout', costGrowth: 2, maxPurchases: Infinity, effect: { kind: 'nodePayoutMultiplier', factor: 1.5 } }),
    buyable({
      id: 'uplink',
      currency: 'networkNodes',
      cost: num(10),
      costGrowth: 10,
      maxPurchases: Infinity,
      effect: { kind: 'interfaceSpeed', amount: 0.1 },
    }),
    buyable({ id: 'skill', actionId: 'a', effect: { kind: 'levelBonusFromSleeveLevel', sourceActionId: 'a', targetActionId: 'net' } }),
    buyable({ id: 'study', actionId: 'a', effect: { kind: 'sleeveXpReduction', sourceActionId: 'a', perLevel: 0.01, maxReduction: 0.25 } }),
  ],
});

const contents: [string, GameConfig][] = [
  ['the test content', richTestConfig],
  ['the shipped content', gameConfig],
];

const TICKS = [0, 1, 16, 50, 999, 1_000, 5_000, 60_000, 3_600_000];

type Mutable = { credits: unknown; network: unknown; heat: number; infamy: number };

/** Does one random thing to the game: a command, a tick, or a gift of credits, nodes, heat or Infamy. */
function randomStep(g: GameEngine, config: GameConfig, random: Random): void {
  const state = g.getState() as unknown as Mutable;
  const roll = random();
  if (roll < 0.25) g.startAction(pick(random, config.actions).id);
  else if (roll < 0.5) g.activateBuyable(pick(random, config.buyables).id);
  else if (roll < 0.56) g.resleeve();
  else if (roll < 0.62) state.credits = num(10 ** randomInt(random, 40));
  else if (roll < 0.68) state.network = num(randomInt(random, 5_000));
  else if (roll < 0.72) state.heat = randomInt(random, 300);
  else if (roll < 0.74) state.infamy = randomInt(random, 5);
  else g.tick(pick(random, TICKS));
}

describe.each(contents)('random play on %s', (_name, config) => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))('seed %i: every invariant holds after every step', (seed) => {
    const random = seededRandom(seed);
    const g = createGame({ config });
    for (let step = 0; step < 150; step++) {
      randomStep(g, config, random);
      expect(findInvariantViolations(g.getState(), config), `seed ${seed}, step ${step}`).toEqual([]);
    }
  });

  it.each(Array.from({ length: 12 }, (_, i) => i + 100))('seed %i: saving and loading gives back the same content', (seed) => {
    const random = seededRandom(seed);
    const g = createGame({ config });
    for (let step = 0; step < 100; step++) randomStep(g, config, random);
    const saved = serializeState(g.getState());
    const restored = deserializeState(saved, config, numberFactory);
    expect(restored).not.toBeNull();
    expect(JSON.parse(serializeState(restored!))).toEqual(JSON.parse(saved)); // key order may differ, the content may not
  });
});

describe('tick size does not matter', () => {
  it.each(Array.from({ length: 16 }, (_, i) => i + 200))('seed %i: 30 s in one tick equals 30 ticks of 1 s', (seed) => {
    const setup = (): GameEngine => {
      const random = seededRandom(seed);
      const g = createGame({ config: richTestConfig });
      const state = g.getState() as unknown as Mutable;
      state.credits = num(10 ** (3 + randomInt(random, 6)));
      state.network = num(randomInt(random, 3_000));
      for (const b of richTestConfig.buyables) if (random() < 0.5) g.activateBuyable(b.id);
      for (const a of richTestConfig.actions) if (random() < 0.7) g.startAction(a.id);
      return g;
    };
    const once = setup();
    const stepped = setup();
    once.tick(30_000);
    for (let i = 0; i < 30; i++) stepped.tick(1_000);

    const close = (a: { toNumber(): number }, b: { toNumber(): number }, what: string): void => {
      const x = a.toNumber();
      const y = b.toNumber();
      const scale = Math.max(Math.abs(x), Math.abs(y), 1);
      expect(Math.abs(x - y) / scale, `${what}: ${x} vs ${y}`).toBeLessThan(1e-9);
    };
    const a = once.getState();
    const b = stepped.getState();
    close(a.credits, b.credits, 'credits');
    close(a.network, b.network, 'network');
    close(a.iceRating, b.iceRating, 'iceRating');
    close(a.hackingProficiency, b.hackingProficiency, 'hacking proficiency');
    close(a.nodePayoutBonus, b.nodePayoutBonus, 'node payout bonus');
    expect(a.heat).toBeCloseTo(b.heat, 6);
    expect(a.infamy).toBe(b.infamy);
    for (const action of richTestConfig.actions) close(a.actions[action.id]!.xp, b.actions[action.id]!.xp, `${action.id} xp`);
  });
});
