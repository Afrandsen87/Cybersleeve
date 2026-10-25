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
  BURN_LEAD,
  BURN_LEADS,
  FASTER_CONDITIONING,
  FOCUS_UPGRADE,
  focusUnlockId,
  GROW_NETWORK,
  INDUSTRIAL_ESPIONAGE,
  gameConfig,
  KOMPROMAT,
  KOMPROMAT_HARVEST,
  MALWARE_AUTO_RUN,
  ICE_RATING_BOOST,
  MALWARE_ICE,
  MALWARE_OUTPUT,
  OVERCLOCK_UPGRADE,
  overclockUnlockId,
  PRACTICE_HACKING,
  PUSH_MALWARE,
  SKILLS,
  SKILL_BACK_CHANNEL,
  SKILL_MUSCLE_MEMORY,
  SKILL_NOSE_FOR_SECRETS,
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

  it("Push malware's auto-run is the button of the square on its card, and not in its row of purchases", () => {
    const card = buildViewModel(createGame()).actions.find((x) => x.id === PUSH_MALWARE)!;
    expect(card.square.locked).toBe(true);
    expect(card.square.cells[0]).toMatchObject({ id: 'autoRun', mode: 'buy', buyableId: MALWARE_AUTO_RUN });
    expect(card.buyables.find((b) => b.id === MALWARE_AUTO_RUN)!.inSquare).toBe(true);
    expect(card.buyables.filter((b) => !b.inSquare).map((b) => b.id)).toEqual([MALWARE_OUTPUT, MALWARE_ICE]);
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
  it('is on the Practice Hacking card after the harvest, needs the harvest and costs 10,000', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PRACTICE_HACKING)!;
    expect(card.buyables.map((b) => b.id).slice(0, 3)).toEqual([expect.any(String), KOMPROMAT_HARVEST, RARITY_REFINEMENT]);
    const def = gameConfig.buyables.find((b) => b.id === RARITY_REFINEMENT)!;
    expect(def.requires).toEqual([KOMPROMAT_HARVEST]);
    expect(def.cost.eq(num(10_000))).toBe(true);
  });

  it('first order of magnitude leaves the last rarity at 0, the second lets it drop', () => {
    const rule = gameConfig.buyables.find((b) => b.id === KOMPROMAT_HARVEST)!.effect;
    if (rule.kind !== 'itemDrop') throw new Error('not a drop');
    const ids = gameConfig.items.rarities.map((r) => r.id);
    const weights = ids.map((id) => rule.drop.rarityWeights?.[id] ?? 0);
    expect(shiftWeights(weights, 1, 0.01).at(-1)).toBe(0);
    expect(shiftWeights(weights, 2, 0.01).at(-1)).toBeGreaterThan(0);
  });

  it('the tooltip just says that it raises the rarity of Kompromat drops with Hacking Proficiency', () => {
    const g = createGame();
    (g.getState() as { hackingProficiency: unknown }).hackingProficiency = num(250);
    const tip = buildViewModel(g)
      .actions.find((a) => a.id === PRACTICE_HACKING)!
      .buyables.find((b) => b.id === RARITY_REFINEMENT)!.tip;
    expect(tip.split('\n').slice(0, 2)).toEqual([
      'Rarity refinement',
      'Increases the rarity of Kompromat drops based on Hacking Proficiency.',
    ]);
    expect(tip).not.toContain('Shifts');
    expect(tip).not.toContain('250');
    expect(tip).not.toMatch(/\b(not|never|no)\b/i);
  });
});

describe('Rarity refinement counts Hacking Proficiency the way the drops do (real content)', () => {
  const uncommonChance = (muscleMemory: boolean): number => {
    const g = createGame();
    const state = g.getState() as unknown as { hackingProficiency: unknown; purchased: Record<string, number> };
    state.hackingProficiency = num(9.6);
    state.purchased[KOMPROMAT_HARVEST] = 1;
    state.purchased[RARITY_REFINEMENT] = 1;
    if (muscleMemory) state.purchased[SKILL_MUSCLE_MEMORY] = 1; // 9.6 x 1.05 = 10.08: one order of magnitude
    return g.dropSources(KOMPROMAT, 'uncommon')[0]!.chance;
  };

  it('the proficiency raised by Muscle Memory moves the drop ratios, as the Sleeve row shows it', () => {
    expect(uncommonChance(false)).toBeCloseTo(0.05 * 0.09, 12); // no shift: 9 of 100
    expect(uncommonChance(true)).toBeCloseTo(0.05 * 0.0981, 12); // one shift: 9.81 of 100
  });
});

describe('item tooltips show the drop chance of the stack (real content)', () => {
  const tip = (g: ReturnType<typeof createGame>, itemId: string, rarityId: string): string =>
    buildViewModel(g).inventory.rows.find((r) => r.itemId === itemId && r.rarityId === rarityId)!.tip;
  const own = (g: ReturnType<typeof createGame>, ...ids: string[]): void => {
    for (const id of ids) (g.getState() as unknown as { purchased: Record<string, number> }).purchased[id] = 1;
  };

  it('is 0% for every item before anything that drops it is bought', () => {
    const g = createGame();
    for (const row of buildViewModel(g).inventory.rows) expect(row.tip, row.label).toContain('Drop Chance = 0%');
  });

  it('Kompromat: the chance of the harvest times the share of each rarity, per Practice Hacking run', () => {
    const g = createGame();
    own(g, KOMPROMAT_HARVEST);
    expect(tip(g, KOMPROMAT, 'common')).toContain('Drop Chance = 4.5% per Practice Hacking run');
    expect(tip(g, KOMPROMAT, 'uncommon')).toContain('Drop Chance = 0.45% per Practice Hacking run');
    expect(tip(g, KOMPROMAT, 'rare')).toContain('Drop Chance = 0.05% per Practice Hacking run');
    expect(tip(g, KOMPROMAT, 'legendary')).toContain('Drop Chance = 0%');
  });

  it('Augment schematics: the same rule on Grow network', () => {
    const g = createGame();
    own(g, INDUSTRIAL_ESPIONAGE);
    expect(tip(g, AUGMENT_SCHEMATIC, 'common')).toContain('Drop Chance = 4.5% per Grow network run');
    expect(tip(g, KOMPROMAT, 'common')).toContain('Drop Chance = 0%'); // the other item is not affected
  });

  it('the Burn lead has no rarity: its whole chance, per Grow network run', () => {
    const g = createGame();
    own(g, BURN_LEADS);
    expect(tip(g, BURN_LEAD, 'common')).toContain('Drop Chance = 5% per Grow network run');
  });

  it('follows the skills that change the chance and the ratios: Nose for Secrets doubles the Kompromat chance', () => {
    const g = createGame();
    own(g, KOMPROMAT_HARVEST, SKILL_NOSE_FOR_SECRETS);
    expect(tip(g, KOMPROMAT, 'common')).toContain('Drop Chance = 9% per Practice Hacking run');
  });
});

describe('the buttons of the panels can be told apart (real content)', () => {
  it('no two purchases share the same symbol, except the repeated auto-run and doubling symbols of different cards', () => {
    const symbols = gameConfig.buyables
      .map((b) => b.symbol)
      .filter((x): x is string => x !== undefined && !['↻', '×2', 'OV', 'FO'].includes(x));
    expect(symbols.filter((x, i) => symbols.indexOf(x) !== i)).toEqual([]);
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
    const { firstLevelXp, growthFactor } = gameConfig.progression.actionLevels;
    setXp(firstLevelXp * (1 + growthFactor)); // the second level-up, whatever the growth
    expect(g.actionLevel(id)).toBe(2);
    expect(actionFactor()).toBeCloseTo(1.1, 10);
  });
});

describe('Malware payload (real content)', () => {
  it('is second on the Push malware card, after the auto-run, rebuyable with a 100x price per copy', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === PUSH_MALWARE)!;
    expect(card.buyables.map((b) => b.id).slice(0, 2)).toEqual([MALWARE_AUTO_RUN, MALWARE_OUTPUT]);
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

describe('Overclock, Focus and Burn leads (real content)', () => {
  const rich = (): ReturnType<typeof createGame> => {
    const g = createGame({ random: () => 0 }); // every roll succeeds
    setCredits(g, num('1e100'));
    return g;
  };

  it('the Overclock upgrade is a sleeve buyable, unlimited, that gets dearer with every copy', () => {
    const b = gameConfig.buyables.find((x) => x.id === OVERCLOCK_UPGRADE)!;
    expect(b.actionId).toBeUndefined();
    expect(b.maxPurchases).toBe(Infinity);
    expect(b.costGrowth ?? 1).toBeGreaterThan(1);
  });

  it('every action with an Overclock effect has an unlock of its own, and no action without one does', () => {
    for (const a of gameConfig.actions) {
      const unlock = gameConfig.buyables.find((b) => b.id === overclockUnlockId(a.id));
      expect(unlock !== undefined, a.id).toBe(a.overclock !== undefined);
      if (unlock) expect(unlock.actionId).toBe(a.id);
    }
  });

  it('Grow network, Practice Hacking and Push malware each have an Overclock effect of their own', () => {
    const rules = [GROW_NETWORK, PRACTICE_HACKING, PUSH_MALWARE].map((id) => gameConfig.actions.find((a) => a.id === id)!.overclock);
    for (const rule of rules) expect(rule).toBeDefined();
    expect(new Set(rules.map((r) => JSON.stringify(r))).size).toBe(3);
  });

  it('the Overclock toggle appears when the action unlocks it, and makes Grow network faster', () => {
    const g = rich();
    expect(buildViewModel(g).actions.every((a) => a.overclock === null)).toBe(true);
    expect(g.buy(OVERCLOCK_UPGRADE)).toBe('purchased');
    expect(buildViewModel(g).actions.every((a) => a.overclock === null)).toBe(true); // the upgrade alone unlocks nothing
    expect(g.buy(overclockUnlockId(GROW_NETWORK))).toBe('purchased');
    expect(
      buildViewModel(g)
        .actions.filter((a) => a.overclock !== null)
        .map((a) => a.id),
    ).toEqual([GROW_NETWORK]);
    const before = g.currentDurationMs(GROW_NETWORK);
    g.toggleOverclock(GROW_NETWORK);
    expect(g.currentDurationMs(GROW_NETWORK)).toBeLessThan(before);
  });

  it('an overclocked Grow network adds heat while it runs, in fractions of a point', () => {
    const g = rich();
    g.buy(overclockUnlockId(GROW_NETWORK));
    g.toggleOverclock(GROW_NETWORK);
    g.startAction(GROW_NETWORK);
    g.tick(Math.min(10_000, g.currentDurationMs(GROW_NETWORK) - 1));
    const heat = g.getState().heat;
    expect(heat).toBeGreaterThan(0);
    expect(heat).toBeLessThan(1);
  });

  it('Grow network adds 2 heat per minute while overclocked', () => {
    expect(gameConfig.actions.find((a) => a.id === GROW_NETWORK)!.overclock!.heatPerMinute).toBe(2);
  });

  it('Practice Hacking overclocked pays 3x and each completed run costs 5 nodes, end to end', () => {
    const g = rich();
    while (!g.isUnlocked(PRACTICE_HACKING)) g.buy(ACCESS_UPGRADE);
    g.buy(overclockUnlockId(PRACTICE_HACKING));
    (g.getState() as unknown as { network: unknown }).network = num(100);
    const run = (): number => {
      g.startAction(PRACTICE_HACKING);
      g.tick(g.currentDurationMs(PRACTICE_HACKING) + 1);
      return g.getState().hackingProficiency.toNumber();
    };
    const plain = run();
    g.toggleOverclock(PRACTICE_HACKING);
    const before = g.getState().network.toNumber();
    const gained = run() - plain;
    expect(gained).toBeCloseTo(plain * 3, 9);
    expect(g.getState().network.toNumber()).toBe(before - 5);
  });

  it('Push malware overclocked pays the nodes of a Grow network run and makes 3x the heat, end to end', () => {
    const g = rich();
    while (!g.isUnlocked(PUSH_MALWARE)) g.buy(ACCESS_UPGRADE);
    g.buy(overclockUnlockId(PUSH_MALWARE));
    const push = gameConfig.actions.find((a) => a.id === PUSH_MALWARE)!;
    const complete = (): void => {
      g.startAction(PUSH_MALWARE);
      g.tick(g.currentDurationMs(PUSH_MALWARE) + 1);
    };
    complete();
    const plainHeat = g.getState().heat;
    expect(plainHeat).toBeCloseTo(push.heatPerRun!, 9);
    expect(g.getState().network.toNumber()).toBe(0);
    (g.getState() as unknown as { heat: number }).heat = 0; // a run takes a minute, so the cooldown would take a point meanwhile
    g.toggleOverclock(PUSH_MALWARE);
    complete();
    expect(g.getState().heat).toBeCloseTo(plainHeat * 3, 9);
    expect(g.getState().network.toNumber()).toBe(g.payoutPerRun(GROW_NETWORK).toNumber());
  });

  it('every action has a Focus unlock of its own', () => {
    for (const a of gameConfig.actions) {
      const unlock = gameConfig.buyables.find((b) => b.id === focusUnlockId(a.id));
      expect(unlock?.actionId, a.id).toBe(a.id);
    }
  });

  it('the Focus upgrade is a sleeve buyable whose cap gives every action a slot, counting the free one', () => {
    const b = gameConfig.buyables.find((x) => x.id === FOCUS_UPGRADE)!;
    expect(b.actionId).toBeUndefined();
    expect(b.effect.kind).toBe('focusSlots');
    const perCopy = b.effect.kind === 'focusSlots' ? b.effect.perCopy : 0;
    expect(gameConfig.focus.baseSlots + (b.maxPurchases as number) * perCopy).toBe(gameConfig.actions.length);
  });

  it('with the unlocks and every slot, all actions can be focused at once, and not before', () => {
    const g = rich();
    for (const a of gameConfig.actions) expect(g.buy(focusUnlockId(a.id))).toBe('purchased');
    expect(g.toggleFocus(gameConfig.actions[0]!.id)).toBe(true);
    expect(g.toggleFocus(gameConfig.actions[1]!.id)).toBe(false); // one free slot only
    const upgrade = gameConfig.buyables.find((x) => x.id === FOCUS_UPGRADE)!;
    for (let i = 0; i < (upgrade.maxPurchases as number); i++) expect(g.buy(FOCUS_UPGRADE)).toBe('purchased');
    expect(g.buy(FOCUS_UPGRADE)).toBe('max-reached');
    for (const a of gameConfig.actions) g.getState().focused[a.id] || g.toggleFocus(a.id);
    expect(gameConfig.actions.every((a) => g.getState().focused[a.id])).toBe(true);
  });

  it('Focus makes the focused action faster', () => {
    const g = rich();
    g.buy(focusUnlockId(GROW_NETWORK));
    const before = g.currentDurationMs(GROW_NETWORK);
    g.toggleFocus(GROW_NETWORK);
    expect(g.currentDurationMs(GROW_NETWORK)).toBeLessThan(before);
  });

  it('the unlocks cost what the sleeve buyables did before they became per action, and the upgrades 1000x that', () => {
    const cost = (id: string): number => gameConfig.buyables.find((b) => b.id === id)!.cost.toNumber();
    for (const a of gameConfig.actions) {
      if (a.overclock) expect(cost(overclockUnlockId(a.id)), a.id).toBe(250);
      expect(cost(focusUnlockId(a.id)), a.id).toBe(1_000);
    }
    expect(cost(OVERCLOCK_UPGRADE)).toBe(250 * 1_000);
    expect(cost(FOCUS_UPGRADE)).toBe(1_000 * 1_000);
  });

  it('the Burn lead has no rarity: one row in the Inventory named "Burn lead", and its drop names no rarity weights', () => {
    expect(gameConfig.items.definitions.find((d) => d.id === BURN_LEAD)!.hasRarity).toBe(false);
    const leads = gameConfig.buyables.find((b) => b.id === BURN_LEADS)!;
    expect(leads.effect.kind === 'itemDrop' && leads.effect.drop.rarityWeights).toBeUndefined();
    const g = rich();
    (g.getState() as unknown as { inventory: Record<string, Record<string, number>> }).inventory[BURN_LEAD] = { common: 2 };
    const rows = buildViewModel(g).inventory.rows.filter((r) => r.itemId === BURN_LEAD);
    expect(rows.map((r) => r.label)).toEqual(['Burn lead']);
    expect(rows[0]!.tip).not.toMatch(/common|uncommon|rare|legendary|crisis/i);
  });

  it('the Burn lead is an item that cannot be sold, and using one is configured', () => {
    const item = gameConfig.items.definitions.find((d) => d.id === BURN_LEAD)!;
    expect(item.sellable).toBe(false);
    expect(gameConfig.items.burnLead?.itemId).toBe(BURN_LEAD);
  });

  it('Burn leads are bought on the Grow network card and make its runs drop leads, end to end', () => {
    const card = buildViewModel(createGame()).actions.find((a) => a.id === GROW_NETWORK)!;
    expect(card.buyables.map((b) => b.id)).toContain(BURN_LEADS);
    const g = rich();
    expect(g.buy(BURN_LEADS)).toBe('purchased');
    g.startAction(GROW_NETWORK);
    g.tick(g.currentDurationMs(GROW_NETWORK) + 1);
    const held = Object.values(g.getState().inventory[BURN_LEAD] ?? {}).reduce((sum, n) => sum + n, 0);
    expect(held).toBeGreaterThanOrEqual(1);
  });

  it('using a Burn lead takes part of the heat away and uses the lead up, end to end', () => {
    const g = rich();
    g.buy(BURN_LEADS);
    g.startAction(GROW_NETWORK);
    g.tick(g.currentDurationMs(GROW_NETWORK) + 1);
    const rarity = Object.keys(g.getState().inventory[BURN_LEAD]!)[0]!;
    const count = g.getState().inventory[BURN_LEAD]![rarity]!;
    (g.getState() as { heat: number }).heat = 40;
    expect(g.useBurnLead(rarity)).toBe(true);
    expect(g.getState().heat).toBeCloseTo(40 * (1 - gameConfig.items.burnLead!.heatFraction), 9);
    expect(g.getState().inventory[BURN_LEAD]![rarity]).toBe(count - 1);
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
