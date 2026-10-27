/**
 * Guards for the REAL content: items, rarity refinement, Augment schematics and the Back Channel. Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { shiftWeights } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { buildViewModel } from '../ui/viewModel';
import {
  AUGMENT_SCHEMATIC,
  BURN_LEAD,
  BURN_LEADS,
  GROW_NETWORK,
  INDUSTRIAL_ESPIONAGE,
  gameConfig,
  KOMPROMAT,
  KOMPROMAT_HARVEST,
  PRACTICE_HACKING,
  SKILL_BACK_CHANNEL,
  SKILL_MUSCLE_MEMORY,
  SKILL_NOSE_FOR_SECRETS,
  RARITY_REFINEMENT,
} from './gameConfig';

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
    (g.getState().purchased as Record<string, number>)[KOMPROMAT_HARVEST] = 1;
    expect(g.buy(SKILL_BACK_CHANNEL)).toBe('purchased');
    (g.getState() as unknown as { heat: number; moles: number }).heat = 20;
    (g.getState() as unknown as { heat: number; moles: number }).moles = 5;
    g.tick(gameConfig.sleeve.heatCooldownMs / 3); // a third of a normal cycle: one boosted cycle at 3x
    expect(g.getState().heat).toBe(19);
    expect(g.getState().moles).toBe(4);
  });
});
