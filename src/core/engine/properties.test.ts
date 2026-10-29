import { describe, expect, it } from 'vitest';
import { createGame } from '../../app/createGame';
import { gameConfig } from '../../content/gameConfig';
import { num, numberFactory } from '../../numbers';
import { automationLaneBuyables } from '../../testing/automationKit';
import { findInvariantViolations } from '../../testing/invariants';
import { pick, randomInt, seededRandom, type Random } from '../../testing/random';
import {
  killAction,
  legendAction,
  malwareAction,
  networkAction,
  payoutAction,
  percentKillAction,
  practiceAction,
  testConfig,
} from '../../testing/testConfig';
import {
  AUTOMATION_FEATURES,
  createConfig,
  deserializeState,
  serializeState,
  type BuyableDefinition,
  type GameConfig,
  type GameEngine,
} from '..';

const buyable = (b: Partial<BuyableDefinition> & Pick<BuyableDefinition, 'id' | 'effect'>): BuyableDefinition => ({
  name: b.id,
  description: '',
  cost: num(5),
  ...b,
});

/** The test content plus every kind of action and some buyables to own, so random play reaches every code path. */
const richTestConfig: GameConfig = createConfig(testConfig, {
  actions: [
    { ...testConfig.actions[0]!, overclock: { speedBonus: 0.5, heatPerMinute: 1 } },
    networkAction,
    killAction,
    percentKillAction,
    { ...payoutAction, overclock: { alsoPays: 'net', heatPerRunFactor: 3 } },
    legendAction,
    { ...practiceAction, overclock: { rewardBonus: 2, completionEffects: [{ kind: 'removeNodes', amount: 5 }] } },
    malwareAction,
  ],
  buyables: [
    ...testConfig.buyables,
    ...automationLaneBuyables(),
    buyable({ id: 'unlock', effect: { kind: 'accessLevel', amount: 1 } }),
    buyable({
      id: 'euphoria',
      currency: 'resleevePoints',
      cost: num(1),
      effect: { kind: 'actionXpReductionFromSleeveLevel', remainingPerOrder: 0.5, maxReduction: 0.99 },
    }),
    buyable({ id: 'synth', currency: 'resleevePoints', cost: num(1), parents: ['euphoria'], effect: { kind: 'synthSleeves' } }),
    buyable({ id: 'incorp', currency: 'resleevePoints', cost: num(1), parents: ['euphoria'], effect: { kind: 'placeholder' } }),
    // the newer re-sleeve skills, so random play reaches their code (each costs one re-sleeve point)
    ...(
      [
        { id: 'r-caps', effect: { kind: 'buyableCapBonus', targetId: 'slots', extra: 2 } },
        { id: 'r-stack', effect: { kind: 'focusStacking' } },
        { id: 'r-vats', effect: { kind: 'synthsPerResleeve', count: 2 } },
        { id: 'r-hive', effect: { kind: 'interfaceSpeedPerLnSynths', perLn: 0.1 } },
        { id: 'r-mirror', effect: { kind: 'synthXpBoost', factor: 1.25 } },
        { id: 'r-perfect', effect: { kind: 'perfectCopies' } },
        { id: 'r-workers', effect: { kind: 'corporationSpeedPerLnSynths', perLn: 0.1 } },
        { id: 'r-procure', effect: { kind: 'unlocksSynthPurchase' } },
        { id: 'r-reflex', effect: { kind: 'autoRepurchase' } },
        { id: 'r-daemon', effect: { kind: 'keepsAutomation' } },
        { id: 'r-prof', effect: { kind: 'carriesProficiency', scale: 1 } },
        { id: 'r-ice', effect: { kind: 'carriesIceRating', share: 0.5 } },
      ] satisfies Pick<BuyableDefinition, 'id' | 'effect'>[]
    ).map((s) => buyable({ ...s, currency: 'resleevePoints', cost: num(1) })),
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
    buyable({ id: 'oc-a', actionId: 'a', effect: { kind: 'overclockUnlock' } }),
    buyable({ id: 'oc-practice', actionId: 'practice', effect: { kind: 'overclockUnlock' } }),
    buyable({ id: 'oc-push', actionId: 'push', effect: { kind: 'overclockUnlock' } }),
    buyable({ id: 'fo-a', actionId: 'a', effect: { kind: 'focusUnlock' } }),
    buyable({ id: 'fo-net', actionId: 'net', effect: { kind: 'focusUnlock' } }),
    buyable({ id: 'fo-push', actionId: 'push', effect: { kind: 'focusUnlock' } }),
    buyable({ id: 'ocs', costGrowth: 3, maxPurchases: Infinity, effect: { kind: 'overclockStrength', perCopy: 0.1 } }),
    buyable({ id: 'slots', costGrowth: 3, maxPurchases: 3, effect: { kind: 'focusSlots', perCopy: 1 } }),
    buyable({ id: 'boost', actionId: 'push', effect: { kind: 'criticalBoost', factor: 3 } }),
    buyable({ id: 'link', actionId: 'push', effect: { kind: 'criticalLink', targetActionId: 'net' } }),
    buyable({ id: 'obf', effect: { kind: 'overclockHeatFactor', targetActionId: 'push', factor: 2 } }),
    buyable({ id: 'crit', maxPurchases: 3, effect: { kind: 'criticalChance', chance: 0.3 } }),
    buyable({ id: 'zds', actionId: 'push', effect: { kind: 'itemDrop', drop: { itemId: 'zd', chance: 0.5 } } }),
    buyable({
      id: 'leads',
      actionId: 'net',
      effect: { kind: 'itemDrop', drop: { itemId: 'lead', chance: 0.5, rarityWeights: { common: 1 } } },
    }),
  ],
  items: {
    ...testConfig.items,
    definitions: [
      ...testConfig.items.definitions,
      { id: 'lead', name: 'Lead', sellable: false },
      { id: 'zd', name: 'Zero-day', sellable: false, hasRarity: false },
    ],
    burnLead: { itemId: 'lead', heatFraction: 0.05 },
    zeroDay: { itemId: 'zd', actionId: 'push' },
  },
});

const contents: [string, GameConfig][] = [
  ['the test content', richTestConfig],
  ['the shipped content', gameConfig],
];

const TICKS = [0, 1, 16, 50, 999, 1_000, 5_000, 60_000, 3_600_000];

type Mutable = { credits: unknown; network: unknown; heat: number; legend: number; inventory: Record<string, Record<string, number>> };

/** Half the time buys the buyable of an effect kind first, so that its toggle can be reached in a few random steps. */
function maybeBuy(g: GameEngine, config: GameConfig, random: Random, kind: BuyableDefinition['effect']['kind']): void {
  const options = config.buyables.filter((x) => x.effect.kind === kind);
  if (options.length > 0 && random() < 0.5) g.activateBuyable(pick(random, options).id);
}

/** Does one random thing to the game: a command, a tick, or a gift of credits, nodes, heat or Legend. */
function randomStep(g: GameEngine, config: GameConfig, random: Random): void {
  const state = g.getState() as unknown as Mutable;
  const roll = random();
  if (roll < 0.25) g.startAction(pick(random, config.actions).id);
  else if (roll < 0.5) g.activateBuyable(pick(random, config.buyables).id);
  else if (roll < 0.53) {
    maybeBuy(g, config, random, 'overclockUnlock');
    g.toggleOverclock(pick(random, config.actions).id);
  } else if (roll < 0.56) {
    maybeBuy(g, config, random, 'focusUnlock');
    g.toggleFocus(pick(random, config.actions).id);
  } else if (roll < 0.57) g.useBurnLead('common');
  else if (roll < 0.6) {
    // spend the re-sleeve point the last re-sleeve gave on the tree, then re-sleeve again
    maybeBuy(g, config, random, 'actionXpReductionFromSleeveLevel');
    maybeBuy(g, config, random, 'synthSleeves');
    g.resleeve();
  } else if (roll < 0.63) state.credits = num(10 ** randomInt(random, 40));
  else if (roll < 0.68) state.network = num(randomInt(random, 5_000));
  else if (roll < 0.72)
    state.heat = randomInt(random, 300) / (1 + randomInt(random, 4)); // whole and fractional heat
  else if (roll < 0.74) state.legend = randomInt(random, 5);
  else if (roll < 0.78) {
    // automation: points come with the buyable, then random unlocks and settings (all of them refuse what is not allowed)
    maybeBuy(g, config, random, 'automationPoints');
    const auto = g.automation();
    const feature = pick(random, AUTOMATION_FEATURES);
    const r = random();
    if (r < 0.3) auto.unlock(feature);
    else if (r < 0.5) auto.setAutoBurn(random() < 0.7);
    else if (r < 0.6) auto.setAutoBurnCeiling(randomInt(random, 120) / 2);
    else if (r < 0.7) auto.setAutosale(pick(random, config.items.rarities).id, random() < 0.7);
    else if (r < 0.8) auto.setDispersal(pick(random, config.actions).id, randomInt(random, 120));
    else {
      // some stock for the automation to work on
      const item = pick(random, config.items.definitions);
      const rarity = pick(random, config.items.rarities);
      const stack = (state.inventory[item.id] ??= {});
      stack[rarity.id] = (stack[rarity.id] ?? 0) + randomInt(random, 50);
    }
  } else g.tick(pick(random, TICKS));
}

describe.each(contents)('random play on %s', (_name, config) => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))('seed %i: every invariant holds after every step', (seed) => {
    const random = seededRandom(seed);
    const g = createGame({ config, random: seededRandom(seed + 5_000) }); // drops are seeded too, so a failure reproduces
    for (let step = 0; step < 150; step++) {
      randomStep(g, config, random);
      expect(findInvariantViolations(g.getState(), config), `seed ${seed}, step ${step}`).toEqual([]);
    }
  });

  it.each(Array.from({ length: 12 }, (_, i) => i + 100))('seed %i: saving and loading gives back the same content', (seed) => {
    const random = seededRandom(seed);
    const g = createGame({ config, random: seededRandom(seed + 5_000) });
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
      const g = createGame({ config: richTestConfig, random: seededRandom(seed + 5_000) });
      const state = g.getState() as unknown as Mutable;
      state.credits = num(10 ** (3 + randomInt(random, 6)));
      state.network = num(randomInt(random, 3_000));
      for (const b of richTestConfig.buyables) if (random() < 0.5) g.activateBuyable(b.id);
      for (const a of richTestConfig.actions) if (random() < 0.7) g.startAction(a.id);
      for (const a of richTestConfig.actions) if (random() < 0.6) g.toggleOverclock(a.id);
      for (const a of richTestConfig.actions) if (random() < 0.6) g.toggleFocus(a.id);
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
    expect(a.legend).toBe(b.legend);
    for (const action of richTestConfig.actions) close(a.actions[action.id]!.xp, b.actions[action.id]!.xp, `${action.id} xp`);
  });
});
