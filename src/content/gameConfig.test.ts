/**
 * Guards for the REAL game content. These check invariants that must hold whatever the tuning is (a valid
 * configuration, nothing unreachable, every purchase works), not the tuning numbers themselves, so retuning
 * `gameConfig.ts` does not break them. Exact behaviour is tested against `testing/testConfig.ts` elsewhere.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { SPEED_FACTOR_IDS, shiftWeights, validateConfig } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from '../ui/viewModel';
import {
  ACCESS_UPGRADE,
  AUGMENT_SCHEMATIC,
  GROW_NETWORK,
  INDUSTRIAL_ESPIONAGE,
  gameConfig,
  KOMPROMAT,
  KOMPROMAT_HARVEST,
  MALWARE_AUTO_RUN,
  MALWARE_OUTPUT,
  PRACTICE_HACKING,
  PUSH_MALWARE,
  SKILLS,
  SKILL_BACK_CHANNEL,
  RARITY_REFINEMENT,
} from './gameConfig';

describe('real game content (src/content/gameConfig.ts)', () => {
  it('is a valid configuration', () => {
    expect(validateConfig(gameConfig)).toEqual([]);
  });

  it('can start: the first action is available without any purchase', () => {
    const first = gameConfig.actions[0]!;
    expect(first.requiredAccessLevel ?? 1).toBeLessThanOrEqual(gameConfig.sleeve.baseAccessLevel);
  });

  it('every action is reachable: its required access level is the base level plus what the access buyables can grant', () => {
    const granted =
      gameConfig.sleeve.baseAccessLevel +
      gameConfig.buyables.reduce((sum, b) => (b.effect.kind === 'accessLevel' ? sum + b.effect.amount * (b.maxPurchases ?? 1) : sum), 0);
    for (const a of gameConfig.actions) {
      expect(a.requiredAccessLevel ?? 1, `${a.id} needs an unreachable access level`).toBeLessThanOrEqual(granted);
    }
  });

  it('access levels form a ladder with no gaps: every level an action needs is reached one purchase at a time', () => {
    const needed = [...new Set(gameConfig.actions.map((a) => a.requiredAccessLevel ?? 1))].sort((x, y) => x - y);
    for (let i = 1; i < needed.length; i++) expect(needed[i]! - needed[i - 1]!, 'a level is skipped').toBe(1);
    expect(needed[0]).toBe(gameConfig.sleeve.baseAccessLevel);
  });

  it('buying access upgrades one at a time opens the actions in order of their required level', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    const byLevel = [...gameConfig.actions].sort((x, y) => (x.requiredAccessLevel ?? 1) - (y.requiredAccessLevel ?? 1));
    for (const a of byLevel) {
      while (!g.isUnlocked(a.id)) expect(g.buy(ACCESS_UPGRADE), `${a.id} could not be unlocked`).toBe('purchased');
      const open = gameConfig.actions.filter((x) => g.isUnlocked(x.id)).map((x) => x.requiredAccessLevel ?? 1);
      expect(Math.max(...open)).toBeLessThanOrEqual(g.sleeveStats().accessLevel);
    }
  });

  it('every action has an auto-run buyable that really restarts it, also when starting costs nodes', () => {
    for (const a of gameConfig.actions) {
      const auto = gameConfig.buyables.find((b) => b.actionId === a.id && b.effect.kind === 'autoRun');
      if (!auto) continue;
      const g = createGame();
      setCredits(g, num('1e100'));
      (g.getState() as { network: unknown }).network = num('1e100');
      while (!g.isUnlocked(a.id)) expect(g.buy(ACCESS_UPGRADE)).toBe('purchased');
      expect(g.buy(auto.id), `${auto.id} could not be bought`).toBe('purchased');
      expect(g.isAutoRun(a.id)).toBe(true);
      g.startAction(a.id);
      const oneRun = g.currentDurationMs(a.id);
      g.tick(oneRun * 3.5);
      expect(g.getState().actions[a.id]!.xp.gte(num(3)), `${a.id} did not restart itself`).toBe(true);
    }
  });

  it("Push malware's auto-run is the first buyable on its card", () => {
    const card = buildViewModel(createGame()).actions.find((x) => x.id === PUSH_MALWARE)!;
    expect(card.buyables[0]!.toggleable).toBe(true);
  });

  it('every buyable can be bought once enough credits are available (no dead gates)', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    (g.getState() as { network: unknown }).network = num('1e100'); // some buyables are paid in network nodes
    // Buy in config order, repeating until nothing more can be bought once (a gate may be listed after what it unlocks).
    // Skills are paid in skill points, not credits: they have their own test below.
    const bought = gameConfig.buyables.filter((b) => b.currency !== 'skillPoints');
    for (let pass = 0; pass < bought.length; pass++) {
      for (const b of bought) if (g.canBuy(b.id)) expect(g.buy(b.id)).toBe('purchased');
    }
    for (const b of bought) expect(g.ownedCount(b.id), `${b.id} was never purchasable`).toBeGreaterThan(0);
  });

  it('a new game has no skill point, the first comes when an action reaches level 1, and every skill can be bought with it', () => {
    expect(createGame().skillPoints()).toBe(0);
    for (const id of SKILLS) {
      const g = createGame();
      expect(g.canBuy(id), `${id} can be bought without a point`).toBe(false);
      (g.getState().actions[gameConfig.actions[0]!.id] as { xp: unknown }).xp = num(10); // the first action reaches level 1
      expect(g.actionLevel(gameConfig.actions[0]!.id)).toBe(1);
      expect(g.skillPoints()).toBe(1);
      expect(g.canBuy(id), `${id} cannot be bought with the first point`).toBe(true);
      expect(g.buy(id)).toBe('purchased');
      expect(g.skillPoints()).toBe(0);
    }
  });

  it('there is one skill for each of the eight in the design, all costing 1 point and none belonging to an action', () => {
    const skills = gameConfig.buyables.filter((b) => b.currency === 'skillPoints');
    expect(skills.map((b) => b.id)).toEqual([...SKILLS]);
    expect(skills).toHaveLength(8);
    for (const b of skills) {
      expect(b.cost.eq(num(1)), b.id).toBe(true);
      expect(b.actionId, b.id).toBeUndefined();
    }
  });

  it('every action can be unlocked by playing (no action is permanently locked)', () => {
    const g = createGame();
    setCredits(g, num('1e100'));
    (g.getState() as { network: unknown }).network = num('1e100');
    for (let pass = 0; pass < gameConfig.buyables.length; pass++) {
      for (const b of gameConfig.buyables) if (g.canBuy(b.id)) g.buy(b.id);
    }
    g.tick(1);
    for (const a of gameConfig.actions) expect(g.isUnlocked(a.id), `${a.id} stays locked`).toBe(true);
  });

  it('a fresh game runs: starting the first action eventually pays credits, network nodes or interface speed', () => {
    const g = createGame();
    const first = gameConfig.actions[0]!;
    g.startAction(first.id);
    g.tick(g.currentDurationMs(first.id) + 1);
    const s = g.getState();
    expect(s.actions[first.id]!.xp.isZero()).toBe(false);
    expect(s.credits.isZero() && s.network.isZero() && s.hackingProficiency.isZero()).toBe(false);
  });

  it('every item a buyable can drop exists, and the harvest is the second purchase on the Practice Hacking card', () => {
    const itemIds = new Set(gameConfig.items.definitions.map((i) => i.id));
    for (const b of gameConfig.buyables) if (b.effect.kind === 'itemDrop') expect(itemIds.has(b.effect.drop.itemId), b.id).toBe(true);
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PRACTICE_HACKING)!;
    expect(card.buyables[1]!.id).toBe(KOMPROMAT_HARVEST);
  });

  it('a harvested file can be sold for credits, end to end', () => {
    const g = createGame({ random: () => 0 }); // every roll succeeds: every run drops the most common file
    setCredits(g, num(1000));
    while (!g.isUnlocked(PRACTICE_HACKING)) g.buy(ACCESS_UPGRADE);
    expect(g.buy(KOMPROMAT_HARVEST)).toBe('purchased');
    g.startAction(PRACTICE_HACKING);
    g.tick(g.currentDurationMs(PRACTICE_HACKING) + 1);
    const common = g.getState().inventory[KOMPROMAT]!['common']!;
    expect(common).toBeGreaterThanOrEqual(1);
    const before = g.getState().credits;
    expect(g.sellItems(KOMPROMAT, 'common', 'all')).toBe(common);
    expect(
      g
        .getState()
        .credits.sub(before)
        .eq(num(10 * common)),
    ).toBe(true);
  });

  it('the view model builds for the real content', () => {
    const vm = buildViewModel(createGame());
    expect(vm.actions.map((a) => a.id)).toEqual(gameConfig.actions.map((a) => a.id));
    for (const b of gameConfig.buyables) {
      const owner =
        b.currency === 'skillPoints'
          ? vm.skills.buyables
          : b.actionId === undefined
            ? vm.sleeve.buyables
            : vm.actions.find((a) => a.id === b.actionId)!.buyables;
      expect(owner.map((v) => v.id)).toContain(b.id);
    }
  });

  it('the player is never charged a negative or non-finite price', () => {
    const g = createGame();
    for (const b of gameConfig.buyables) {
      const price = g.costOf(b.id);
      expect(price.isFinite() && !price.isNegative()).toBe(true);
    }
  });
});

describe('Rarity refinement (real content)', () => {
  it('is on the Practice Hacking card after the harvest, needs the harvest and costs 150,000', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PRACTICE_HACKING)!;
    expect(card.buyables.map((b) => b.id).slice(0, 3)).toEqual([expect.any(String), KOMPROMAT_HARVEST, RARITY_REFINEMENT]);
    const def = gameConfig.buyables.find((b) => b.id === RARITY_REFINEMENT)!;
    expect(def.requires).toEqual([KOMPROMAT_HARVEST]);
    expect(def.cost.eq(num(150_000))).toBe(true);
  });

  it('first order of magnitude leaves the last rarity at 0, the second lets it drop', () => {
    const rule = gameConfig.buyables.find((b) => b.id === KOMPROMAT_HARVEST)!.effect;
    if (rule.kind !== 'itemDrop') throw new Error('not a drop');
    const ids = gameConfig.items.rarities.map((r) => r.id);
    const weights = ids.map((id) => rule.drop.rarityWeights[id] ?? 0);
    expect(shiftWeights(weights, 1, 0.01).at(-1)).toBe(0);
    expect(shiftWeights(weights, 2, 0.01).at(-1)).toBeGreaterThan(0);
  });

  it('the tooltip shows the formula, the proficiency and how many shifts apply', () => {
    const g = createGame();
    (g.getState() as { hackingProficiency: unknown }).hackingProficiency = num(250);
    const tip = buildViewModel(g)
      .actions.find((a) => a.id === PRACTICE_HACKING)!
      .buyables.find((b) => b.id === RARITY_REFINEMENT)!.tip;
    expect(tip).toContain('Shifts = floor(log10(Hacking Proficiency))');
    expect(tip).toContain('Hacking Proficiency = 250');
    expect(tip).toContain('Shifts = 2');
  });
});

describe('levels start at 0 (real content)', () => {
  it('a new game has every action level and sleeve level at 0, and level 0 is worth exactly 1 of speed', () => {
    const g = createGame();
    for (const a of gameConfig.actions) {
      expect(g.actionLevel(a.id), a.id).toBe(0);
      expect(g.sleeveLevel(a.id), a.id).toBe(0);
      const factors = g.speedFactors(a.id);
      expect(factors.find((f) => f.id === SPEED_FACTOR_IDS.actionLevel)?.factor, a.id).toBe(1);
      expect(factors.find((f) => f.id === SPEED_FACTOR_IDS.sleeveLevel)?.factor, a.id).toBe(1);
    }
  });

  it('each level is worth +5% of the base speed: level 1 is 1.05, level 2 is 1.1', () => {
    const g = createGame();
    const id = gameConfig.actions[0]!.id;
    const setXp = (xp: number) => ((g.getState().actions[id] as { xp: unknown }).xp = num(xp));
    const actionFactor = () => g.speedFactors(id).find((f) => f.id === SPEED_FACTOR_IDS.actionLevel)!.factor;
    setXp(10); // the first level-up
    expect(g.actionLevel(id)).toBe(1);
    expect(actionFactor()).toBeCloseTo(1.05, 10);
    setXp(110);
    expect(g.actionLevel(id)).toBe(2);
    expect(actionFactor()).toBeCloseTo(1.1, 10);
  });
});

describe('Malware payload (real content)', () => {
  it('is second on the Push malware card, after the auto-run, rebuyable with a 10,000x price per copy', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PUSH_MALWARE)!;
    expect(card.buyables.map((b) => b.id)).toEqual([MALWARE_AUTO_RUN, MALWARE_OUTPUT]);
    const g = createGame();
    setCredits(g, num('1e100'));
    expect(g.costOf(MALWARE_OUTPUT).eq(num(50_000))).toBe(true);
    g.buy(MALWARE_OUTPUT);
    expect(g.costOf(MALWARE_OUTPUT).eq(num(500_000_000))).toBe(true);
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

describe('Industrial Espionage and the Augment button (real content)', () => {
  it('costs 10,000 credits, belongs to Grow network and drops Augment schematics', () => {
    const def = gameConfig.buyables.find((b) => b.id === INDUSTRIAL_ESPIONAGE)!;
    expect(def.cost.eq(num(10_000))).toBe(true);
    expect(def.actionId).toBe(GROW_NETWORK);
    expect(def.effect.kind === 'itemDrop' && def.effect.drop.itemId).toBe(AUGMENT_SCHEMATIC);
    expect(
      buildViewModel(createGame())
        .actions.find((a) => a.id === GROW_NETWORK)!
        .buyables.map((b) => b.id),
    ).toContain(INDUSTRIAL_ESPIONAGE);
  });

  it('a schematic can be applied to any action: +1% action XP, nothing for the sleeve level', () => {
    const g = createGame({ random: () => 0 }); // every drop succeeds, always the most common rarity
    setCredits(g, num(100_000));
    g.buy(INDUSTRIAL_ESPIONAGE);
    g.startAction(GROW_NETWORK);
    g.tick(g.currentDurationMs(GROW_NETWORK) + 1);
    const held = g.getState().inventory[AUGMENT_SCHEMATIC]!['common']!;
    expect(held).toBeGreaterThanOrEqual(1);
    const target = PRACTICE_HACKING;
    expect(g.xpPerRun(target).toNumber()).toBe(1);
    expect(g.augmentAction(target)).toBe(true);
    expect(g.xpPerRun(target).toNumber()).toBeCloseTo(1.01, 12);
    expect(g.getState().inventory[AUGMENT_SCHEMATIC]!['common']).toBe(held - 1);
  });

  it('every action card has the button, and the Augment schematic is a normal item in the Inventory', () => {
    const vm = buildViewModel(createGame());
    for (const a of vm.actions) expect(a.augment, a.id).not.toBeNull();
    expect(gameConfig.items.definitions.map((d) => d.id)).toContain(AUGMENT_SCHEMATIC);
    expect(gameConfig.items.augment).toEqual({ itemId: AUGMENT_SCHEMATIC, xpBonusPerItem: 0.01 });
  });
});

describe('Augment schematics are applied, never paid out (real content)', () => {
  it('cannot be sold, while Kompromat files can', () => {
    const g = createGame();
    (g.getState() as unknown as { inventory: unknown }).inventory = {
      [AUGMENT_SCHEMATIC]: { common: 4 },
      [KOMPROMAT]: { common: 4 },
    };
    expect(g.sellItems(AUGMENT_SCHEMATIC, 'common', 'all')).toBe(0);
    expect(g.getState().inventory[AUGMENT_SCHEMATIC]!['common']).toBe(4);
    expect(g.sellItems(KOMPROMAT, 'common', 'all')).toBe(4);
  });

  it('the rarities multiply: 3 common, 3 uncommon and 3 rare give 1.03 x 1.03 x 1.03', () => {
    const g = createGame();
    (g.getState() as unknown as { inventory: unknown }).inventory = { [AUGMENT_SCHEMATIC]: { common: 3, uncommon: 3, rare: 3 } };
    for (let i = 0; i < 9; i++) expect(g.augmentAction(PRACTICE_HACKING)).toBe(true);
    expect(g.getState().actions[PRACTICE_HACKING]!.augments).toEqual({ common: 3, uncommon: 3, rare: 3 });
    expect(g.xpPerRun(PRACTICE_HACKING).toNumber()).toBeCloseTo(1.03 ** 3, 12);
  });

  it('every common one has to be used before an uncommon one', () => {
    const g = createGame();
    (g.getState() as unknown as { inventory: unknown }).inventory = { [AUGMENT_SCHEMATIC]: { common: 2, uncommon: 5 } };
    for (let i = 0; i < 3; i++) g.augmentAction(PRACTICE_HACKING);
    expect(g.getState().actions[PRACTICE_HACKING]!.augments).toEqual({ common: 2, uncommon: 1 });
  });
});

describe('Back Channel Deals (real content)', () => {
  it('Moles make heat cool 200% faster: three times the pace, one Mole per point of heat', () => {
    const g = createGame();
    (g.getState().actions[gameConfig.actions[0]!.id] as { xp: unknown }).xp = num(10);
    expect(g.buy(SKILL_BACK_CHANNEL)).toBe('purchased');
    (g.getState() as unknown as { heat: number; moles: number }).heat = 20;
    (g.getState() as unknown as { heat: number; moles: number }).moles = 5;
    g.tick(gameConfig.sleeve.heatCooldownMs / 3); // a third of a normal cycle: one boosted cycle at 3x
    expect(g.getState().heat).toBe(19);
    expect(g.getState().moles).toBe(4);
  });
});
