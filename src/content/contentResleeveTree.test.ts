/**
 * Guards for the shape of the REAL re-sleeve skill tree: four lanes, each with its own root, prices that never fall down a lane. They
 * check the structure the design asks for, not any effect tuning.
 */

import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import {
  BRANCH_CORPORATION,
  BRANCH_REACH,
  BRANCH_RETENTION,
  BRANCH_SYNTHETICS,
  RESLEEVE_SKILLS,
  SKILL_INCORPORATION,
  SKILL_PERFECT_COPIES,
  SKILL_REFLEX_ARCHIVE,
  SKILL_RESIDUAL_FIREWALL,
  SKILL_RESIDUAL_PROFICIENCY,
  SKILL_SLEEVE_EUPHORIA,
  SKILL_SYNTHETIC_SLEEVES,
  gameConfig,
} from './gameConfig';

const skills = gameConfig.buyables.filter((b) => b.currency === 'resleevePoints');
const byId = new Map(skills.map((b) => [b.id, b]));

describe('the real re-sleeve skill tree', () => {
  it('has 16 skills in the listed order, none belonging to an action', () => {
    expect(skills.map((b) => b.id)).toEqual([...RESLEEVE_SKILLS]);
    expect(skills).toHaveLength(16);
    for (const b of skills) expect(b.actionId, b.id).toBeUndefined();
  });

  it('has four lanes, each with exactly one root that is bought without needing another lane', () => {
    const roots = skills.filter((b) => (b.parents ?? []).length === 0);
    expect(roots.map((b) => b.id)).toEqual([SKILL_REFLEX_ARCHIVE, SKILL_SLEEVE_EUPHORIA, SKILL_SYNTHETIC_SLEEVES, SKILL_INCORPORATION]);
    expect(new Set(skills.map((b) => b.branch))).toEqual(new Set([BRANCH_RETENTION, BRANCH_REACH, BRANCH_SYNTHETICS, BRANCH_CORPORATION]));
    for (const b of skills) for (const p of b.parents ?? []) expect(byId.get(p)?.branch, `${b.id} parent`).toBe(b.branch);
  });

  it('never costs less than its parent, and Perfect Copies, the end of the synthetics lane, costs 5', () => {
    for (const b of skills) for (const p of b.parents ?? []) expect(b.cost.gte(byId.get(p)!.cost), `${b.id} vs ${p}`).toBe(true);
    expect(byId.get(SKILL_PERFECT_COPIES)!.cost.eq(num(5))).toBe(true);
  });

  it('puts Residual Proficiency at the 6th re-sleeve point of the cheapest route, so it is not an early skill', () => {
    const cheapestRoute = (id: string): number => {
      const b = byId.get(id)!;
      return Number(b.cost.toNumber()) + (b.parents ?? []).reduce((sum, p) => sum + cheapestRoute(p), 0);
    };
    expect(cheapestRoute(SKILL_RESIDUAL_PROFICIENCY)).toBe(6);
    expect(cheapestRoute(SKILL_RESIDUAL_FIREWALL)).toBe(10);
  });
});
