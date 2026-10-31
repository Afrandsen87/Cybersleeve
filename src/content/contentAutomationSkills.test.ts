/**
 * Guards for the REAL content: the three automation lanes (skills paid in automation points, drawn in the Automation tab). The first
 * skill of each lane unlocks the automation; autosale forks into per-rarity permissions. Invariants only.
 */
import { describe, expect, it } from 'vitest';
import { AUTOMATION_ART_ICONS, AUTOMATION_ART_GRIDS } from './automationSkillIcons';
import { createGame } from '../app/createGame';
import { AUTOMATION_FEATURES, AUTO_BURN_STEPS } from '../core';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { gameConfig } from './gameConfig';
import { autosaleSkills } from './buyables/skillBranches/autosaleLane';
import { dispersalSkills } from './buyables/skillBranches/dispersalLane';
import {
  AUTOMATION_CORE,
  AUTOMATION_LINE_LENGTH,
  AUTOMATION_SKILLS,
  AUTO_BURN_EMPTY_SLOTS,
  KOMPROMAT_HARVEST,
  automationSkillId,
} from './ids';

const inLane = (feature: string) => gameConfig.buyables.filter((b) => b.branch === feature && b.currency === 'automationPoints');

describe('the automation skill lanes (real content)', () => {
  it('the Auto Burn steps are each granted by exactly one skill, in the order of AUTO_BURN_STEPS, and their names and descriptions are filled in', () => {
    const steps = inLane('autoBurn').flatMap((b) => (b.effect.kind === 'autoBurnStep' ? [b.effect.step] : []));
    expect(steps).toEqual([...AUTO_BURN_STEPS]);
    for (const b of inLane('autoBurn')) {
      expect(b.name, b.id).not.toMatch(/Auto Burn d/);
      expect(b.description.length, b.id).toBeGreaterThan(10);
    }
  });

  it('the lower threshold starts below the upper one', () => {
    const { autoBurnCeiling, autoBurnUpper } = gameConfig.automation!;
    expect(autoBurnCeiling).toBeGreaterThanOrEqual(0);
    expect(autoBurnUpper).toBeGreaterThan(autoBurnCeiling);
  });

  it('there is one lane per automation feature, each as long as its slots, costing 1 automation point, belonging to no action', () => {
    for (const feature of AUTOMATION_FEATURES) {
      const skills = inLane(feature);
      expect(skills, feature).toHaveLength(
        AUTOMATION_LINE_LENGTH - (feature === 'autoBurn' ? AUTO_BURN_EMPTY_SLOTS.length : feature === 'autosale' ? 2 : 1),
      );
      for (const b of skills) {
        expect(b.cost.eq(num(1)), b.id).toBe(true);
        expect(b.actionId, b.id).toBeUndefined();
      }
    }
    expect(gameConfig.buyables.filter((b) => b.currency === 'automationPoints').map((b) => b.id)).toEqual([...AUTOMATION_SKILLS]);
  });

  it('the unchanged lanes remain chains, with only the first skill unlocking the feature', () => {
    for (const feature of AUTOMATION_FEATURES) {
      if (feature === 'autosale') continue; // fork and permissions are checked separately below
      const slots = Array.from({ length: AUTOMATION_LINE_LENGTH }, (_, i) => i + 1).filter(
        (slot) =>
          (feature !== 'autoBurn' || !AUTO_BURN_EMPTY_SLOTS.includes(slot)) && (feature !== 'dispersal' || slot < AUTOMATION_LINE_LENGTH),
      );
      inLane(feature).forEach((b, i) => {
        expect(b.id, feature).toBe(automationSkillId(feature, slots[i] ?? 0));
        expect(b.parents ?? [], b.id).toEqual(i === 0 ? [] : [automationSkillId(feature, slots[i - 1] ?? 0)]);
        if (i === 0) expect(b.effect.kind, b.id).toBe('unlocksAutomation');
        else if (feature === 'autoBurn') expect(b.effect.kind, b.id).toBe('autoBurnStep');
        else expect(['dispersalSlots', 'allowsDispersal']).toContain(b.effect.kind);
      });
    }
  });

  it('removing Pick Targets kept the later Auto Burn skill ids: Tune Thresholds is slot 9 with slot 7 as its parent', () => {
    const tune = gameConfig.buyables.find((b) => b.effect.kind === 'autoBurnStep' && b.effect.step === 'thresholds');
    expect(tune?.id).toBe(automationSkillId('autoBurn', 9));
    expect(tune?.parents).toEqual([automationSkillId('autoBurn', 7)]);
    expect(gameConfig.buyables.some((b) => b.id === automationSkillId('autoBurn', 8))).toBe(false);
  });

  it('the lanes are not in the Skills tab: no skill point pays for them', () => {
    const g = createGame();
    const skillTabIds = g
      .getConfig()
      .buyables.filter((b) => b.currency === 'skillPoints')
      .map((b) => b.id);
    for (const id of AUTOMATION_SKILLS) expect(skillTabIds).not.toContain(id);
  });

  it('with automation points a lane is climbed in order: step 1 unlocks the feature, step 2 needs step 1', () => {
    for (const feature of AUTOMATION_FEATURES) {
      const g = createGame();
      setCredits(g, num(1e12));
      for (let i = 0; i < 3; i++) expect(g.buy(AUTOMATION_CORE)).toBe('purchased');
      expect(g.canBuy(automationSkillId(feature, 2)), feature).toBe(false);
      expect(g.automation().isUnlocked(feature)).toBe(false);
      if (feature === 'autosale') g.buy(KOMPROMAT_HARVEST);
      expect(g.buy(automationSkillId(feature, 1))).toBe('purchased');
      expect(g.automation().isUnlocked(feature)).toBe(true);
      expect(g.canBuy(automationSkillId(feature, 2)), feature).toBe(true);
    }
  });
});

/** Automation context: stable fork edges, distinct art and exact rarity coverage. */
describe('the Kompromat automation tree', () => {
  it('forks only after slot 3 with all parents in the same branch', () => {
    const skills = inLane('autosale');
    const id = (slot: number) => automationSkillId('autosale', slot);
    const parents = [0, 1, 2, 3, 4, 5, 3, 7];
    skills.forEach((b, i) => {
      expect(b.parents ?? []).toEqual(parents[i] ? [id(parents[i]!)] : []);
    });
    for (const b of skills) for (const parent of b.parents ?? []) expect(skills.some((p) => p.id === parent)).toBe(true);
    const grids = skills.map((b) => AUTOMATION_ART_GRIDS[AUTOMATION_ART_ICONS[b.id]!]!.join(''));
    expect(new Set(grids).size).toBe(skills.length);
  });
  it('covers each autosale rarity once and only common/uncommon/rare Back Channel', () => {
    const sale = inLane('autosale').flatMap((b) =>
      b.effect.kind === 'unlocksAutomation' ? [b.effect.allowsAutosale] : b.effect.kind === 'allowsAutosale' ? [b.effect.rarity] : [],
    );
    const channel = inLane('autosale').flatMap((b) => (b.effect.kind === 'allowsAutoBackchannel' ? [b.effect.rarity] : []));
    expect(sale.sort()).toEqual(gameConfig.items.rarities.map((r) => r.id).sort());
    expect(channel).toEqual(['common', 'uncommon', 'rare']);
  });

  it('autosale lane skills carry no requires gate, so Daemon Persistence keeps them through a re-sleeve', () => {
    for (const b of autosaleSkills) expect(b.requires, b.id).toBeUndefined();
  });
});

/** Automation context: the real dispersal chain has distinct art and one owner for each rarity permission. */
describe('the Augment dispersal tree', () => {
  it('keeps nine stable chained nodes with distinct icons and no persistent purchase gates', () => {
    expect(dispersalSkills).toHaveLength(9);
    dispersalSkills.forEach((b, i) => {
      expect(b.id).toBe(automationSkillId('dispersal', i + 1));
      expect(b.parents ?? []).toEqual(i ? [dispersalSkills[i - 1]!.id] : []);
      expect(b.requires, b.id).toBeUndefined();
    });
    const grids = dispersalSkills.map((b) => AUTOMATION_ART_GRIDS[AUTOMATION_ART_ICONS[b.id]!]!.join(''));
    expect(new Set(grids).size).toBe(dispersalSkills.length);
  });
  it('grants each supported rarity once and six selection slots in total', () => {
    const rarities = dispersalSkills.flatMap(({ effect: e }) =>
      e.kind === 'allowsDispersal' ? [e.rarity] : e.kind === 'unlocksAutomation' ? [e.allowsDispersal] : [],
    );
    expect(rarities).toEqual(['common', 'uncommon', 'rare', 'legendary']);
    const slots = dispersalSkills.reduce(
      (n, { effect: e }) => n + (e.kind === 'dispersalSlots' ? e.count : e.kind === 'unlocksAutomation' ? (e.dispersalSlots ?? 0) : 0),
      0,
    );
    expect(slots).toBe(6);
    expect(new Set(rarities).size).toBe(rarities.length);
  });
});
