/**
 * Guards for the REAL content: the actions' own buyables (Push malware, Kill servers, Admin keys, Skill shards, ICE Rating). Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from '../ui/viewModel';
import {
  ACCESS_UPGRADE,
  ADMIN_KEY,
  BLACK_BOX_RECORDER,
  CASCADE_FAILURE,
  CREDIT_SIPHON,
  DECOMMISSION_PROTOCOL,
  KILL_CHAIN,
  KILL_SERVERS,
  SKILL_SHARD,
  FASTER_CONDITIONING,
  gameConfig,
  ICE_RATING_BOOST,
  MALWARE_ICE,
  MALWARE_OUTPUT,
  overclockUnlockId,
  PRACTICE_HACKING,
  PUSH_MALWARE,
} from './gameConfig';

describe('Malware payload (real content)', () => {
  it('is the cheapest purchase on the Push malware card (they are sorted by base price), rebuyable with a 100x price per copy', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PUSH_MALWARE)!;
    expect(card.buyables.filter((b) => !b.inSquare)[0]!.id).toBe(MALWARE_OUTPUT);
    const g = createGame();
    setCredits(g, num('1e100'));
    expect(g.costOf(MALWARE_OUTPUT).eq(num(10_000))).toBe(true);
    g.buy(MALWARE_OUTPUT);
    expect(g.costOf(MALWARE_OUTPUT).eq(num(1_000_000))).toBe(true);
    expect(g.isBuyableMaxed(MALWARE_OUTPUT)).toBe(false);
  });

  it('every copy doubles what a run of Push malware adds, and nothing else it does', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    const base = g.rewardPerRun(PUSH_MALWARE).toNumber();
    const xp = g.xpPerRun(PUSH_MALWARE).toNumber();
    g.buy(MALWARE_OUTPUT);
    expect(g.rewardPerRun(PUSH_MALWARE).toNumber()).toBeCloseTo(base * 2, 12);
    g.buy(MALWARE_OUTPUT);
    g.buy(MALWARE_OUTPUT);
    expect(g.rewardPerRun(PUSH_MALWARE).toNumber()).toBeCloseTo(base * 8, 12);
    expect(g.xpPerRun(PUSH_MALWARE).toNumber()).toBe(xp);
  });

  it('does not change the heat a run adds, only the node payout it adds', () => {
    const run = (copies: number) => {
      const g = createGame();
      setCredits(g, num('1e100'));
      while (!g.isUnlocked(PUSH_MALWARE)) g.buy(ACCESS_UPGRADE);
      for (let i = 0; i < copies; i++) g.buy(MALWARE_OUTPUT);
      g.startAction(PUSH_MALWARE);
      g.tick(g.currentDurationMs(PUSH_MALWARE) + 1);
      return g.getState();
    };
    const plain = run(0);
    const doubled = run(2);
    expect(doubled.heat).toBe(plain.heat);
    expect(doubled.heat).toBe(gameConfig.actions.find((a) => a.id === PUSH_MALWARE)!.heatPerRun);
    expect(doubled.nodePayoutBonus.toNumber()).toBeCloseTo(plain.nodePayoutBonus.toNumber() * 4, 15);
  });
});

describe('Faster conditioning (real content)', () => {
  const b = gameConfig.buyables.find((x) => x.id === FASTER_CONDITIONING)!;

  it('is a sleeve buyable whose cap takes the runs per batch exactly down to its floor', () => {
    expect(b.actionId).toBeUndefined();
    if (b.effect.kind !== 'runsPerSleeveXpReduction') throw new Error('wrong effect kind');
    const g = createGame();
    const rich = () => setCredits(g, num(1e300));
    for (let i = 0; i < (b.maxPurchases as number); i++) {
      rich();
      expect(g.buy(FASTER_CONDITIONING)).toBe('purchased');
    }
    rich();
    expect(g.buy(FASTER_CONDITIONING)).toBe('max-reached');
    expect(g.runsPerSleeveXp()).toBe(b.effect.minRuns);
  });
});

describe('Hardened payload and the ICE Rating boost (real content)', () => {
  it('Hardened payload is a Push malware buyable that adds base ICE Rating per level of that action', () => {
    const b = gameConfig.buyables.find((x) => x.id === MALWARE_ICE)!;
    expect(b.actionId).toBe(PUSH_MALWARE);
    expect(b.effect.kind).toBe('iceRatingFromActionLevel');
  });

  it('the ICE Rating boost costs more than Hardened payload, since it has nothing to multiply before it', () => {
    const price = (id: string) => gameConfig.buyables.find((x) => x.id === id)!.cost.toNumber();
    expect(price(ICE_RATING_BOOST)).toBeGreaterThan(price(MALWARE_ICE));
  });
});

describe('Kill servers, Admin keys and Skill shards (real content)', () => {
  const kill = gameConfig.actions.find((a) => a.id === KILL_SERVERS)!;
  const buyable = (id: string) => gameConfig.buyables.find((x) => x.id === id)!;

  it('Kill servers has an Overclock that holds heat in place, a unlock for it, and a Kill chain buyable that adds a chain to it', () => {
    expect(kill.overclock?.stopsHeatCooling).toBe(true);
    expect(buyable(KILL_CHAIN)).toMatchObject({
      actionId: KILL_SERVERS,
      requires: [overclockUnlockId(KILL_SERVERS)],
      effect: { kind: 'overclockChain' },
    });
    expect(kill.startCost).toBeDefined(); // a chain needs runs that come one per batch
    const unlock = buyable(overclockUnlockId(KILL_SERVERS));
    expect(unlock.actionId).toBe(KILL_SERVERS);
    expect(unlock.effect.kind).toBe('overclockUnlock');
  });

  it('its Overclock doubles the ICE Rating it pays: a reward bonus of +100% at strength 1', () => {
    expect(kill.overclock?.rewardBonus).toBe(1);
  });

  it('the Kill servers prices climb in this order: Cascade failure, Credit Siphon, Decommission protocol, Kill chain, Black box recorder', () => {
    const order = [CASCADE_FAILURE, CREDIT_SIPHON, DECOMMISSION_PROTOCOL, KILL_CHAIN, BLACK_BOX_RECORDER].map((id) =>
      buyable(id).cost.toNumber(),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    // they come after the auto-run, like the later buyables of the other actions
    expect(order[0]).toBeGreaterThanOrEqual(buyable('kill-auto-run').cost.toNumber());
  });

  it('the four new buyables belong to Kill servers and use the effects meant for them', () => {
    expect(buyable(DECOMMISSION_PROTOCOL)).toMatchObject({
      actionId: KILL_SERVERS,
      effect: { kind: 'startCostReduction', perLevel: 0.01 },
    });
    expect(buyable(CREDIT_SIPHON)).toMatchObject({ actionId: KILL_SERVERS, effect: { kind: 'creditSiphon', seconds: 10 } });
    expect(buyable(CASCADE_FAILURE)).toMatchObject({ actionId: KILL_SERVERS, effect: { kind: 'rewardMultiplier' } });
    expect(buyable(BLACK_BOX_RECORDER)).toMatchObject({
      actionId: KILL_SERVERS,
      effect: { kind: 'itemDrop', drop: { itemId: ADMIN_KEY } },
    });
  });

  it('Admin keys make Practice Hacking critical, and their critical runs may drop the Skill shard, which is an item without rarity', () => {
    const rule = gameConfig.items.adminKey!;
    expect(rule.actionId).toBe(PRACTICE_HACKING);
    expect(rule.shard?.itemId).toBe(SKILL_SHARD);
    for (const id of [ADMIN_KEY, SKILL_SHARD]) {
      const def = gameConfig.items.definitions.find((d) => d.id === id)!;
      expect(def.sellable).toBe(false);
      expect(def.hasRarity).toBe(false);
    }
    expect(gameConfig.items.skillShard).toEqual({ itemId: SKILL_SHARD, levelsDelayed: 1 });
  });

  it('with the Black box recorder, Kill servers runs drop Admin keys, which can be switched on', () => {
    const g = createGame({ random: () => 0 }); // a draw of 0 is below every chance
    const state = g.getState() as unknown as { network: unknown; inventory: Record<string, Record<string, number>> };
    setCredits(g, num(1e300));
    g.buy(ACCESS_UPGRADE);
    g.buy(ACCESS_UPGRADE);
    g.buy(ACCESS_UPGRADE);
    expect(g.buy(BLACK_BOX_RECORDER)).toBe('purchased');
    state.network = num(100_000);
    expect(g.isUnlocked(KILL_SERVERS)).toBe(true);
    g.startAction(KILL_SERVERS);
    g.tick(g.currentDurationMs(KILL_SERVERS) + 1);
    expect(state.inventory[ADMIN_KEY]?.['common']).toBeGreaterThanOrEqual(1);
    expect(g.canToggleAdminKeys()).toBe(true);
  });
});

describe('the Kill servers Overclock tip (real content)', () => {
  it('shows the chain, what each link adds, and that heat stays in place', () => {
    const g = createGame();
    setCredits(g, num(1e300));
    expect(g.buy(overclockUnlockId(KILL_SERVERS))).toBe('purchased');
    expect(g.buy(KILL_CHAIN)).toBe('purchased');
    const tip = buildViewModel(g).actions.find((a) => a.id === KILL_SERVERS)!.overclock!.tip;
    expect(tip).toContain('Kill chain = 0 / 20 links');
    expect(tip).toContain('Each link adds 10% to the Reward Bonus and 10% to the share of the balance a run takes');
    expect(tip).toContain('Heat stays in place while this action runs');
    expect(tip).toContain('Reward Bonus = 100% (100% x Strength)');
    expect(tip).not.toMatch(/\b(not|never|no)\b/i);
  });
});
