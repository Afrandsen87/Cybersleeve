/**
 * Guards for the shape of the REAL re-sleeve skill tree: four lanes, each with its own root, prices that never fall down a lane. They
 * check the structure the design asks for, not any effect tuning.
 */

import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import {
  BRANCH_SLEEVE_UP,
  SKILL_SLEEVE_UP,
  BRANCH_CORPORATION,
  BRANCH_REACH,
  BRANCH_RETENTION,
  BRANCH_SYNTHETICS,
  RESLEEVE_SKILLS,
  SKILL_INCORPORATION,
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
  it('has the listed skills in the listed order, none belonging to an action', () => {
    expect(skills.map((b) => b.id)).toEqual([...RESLEEVE_SKILLS]);
    expect(skills).toHaveLength(RESLEEVE_SKILLS.length);
    for (const b of skills) expect(b.actionId, b.id).toBeUndefined();
  });

  it('has an ungated trunk parenting the four lane roots', () => {
    const roots = skills.filter((b) => (b.parents ?? []).length === 0);
    expect(roots.map((b) => b.id)).toEqual([SKILL_SLEEVE_UP]);
    expect(new Set(skills.map((b) => b.branch))).toEqual(
      new Set([BRANCH_SLEEVE_UP, BRANCH_RETENTION, BRANCH_REACH, BRANCH_SYNTHETICS, BRANCH_CORPORATION]),
    );
    expect(roots[0]!.requires).toBeUndefined();
    expect(roots[0]!.requiresSleeveSkills).toBeUndefined();
    expect(skills.filter((b) => b.branch === BRANCH_SLEEVE_UP)).toHaveLength(1);
    for (const id of [SKILL_REFLEX_ARCHIVE, SKILL_SLEEVE_EUPHORIA, SKILL_SYNTHETIC_SLEEVES, SKILL_INCORPORATION]) {
      expect(byId.get(id)!.parents).toEqual([SKILL_SLEEVE_UP]);
    }
    for (const b of skills) for (const p of b.parents ?? []) if (p !== SKILL_SLEEVE_UP) expect(byId.get(p)?.branch).toBe(b.branch);
  });

  it('costs one re-sleeve point for every skill, so depth in the tree is the only price', () => {
    for (const b of skills) {
      expect(b.cost.eq(num(1)), b.id).toBe(true);
      expect(b.costGrowth, b.id).toBeUndefined();
    }
  });

  it('puts Residual Firewall further down the cheapest route than Residual Proficiency, which is not a root', () => {
    const cheapestRoute = (id: string): number => {
      const b = byId.get(id)!;
      return Number(b.cost.toNumber()) + (b.parents ?? []).reduce((sum, p) => sum + cheapestRoute(p), 0);
    };
    expect(cheapestRoute(SKILL_RESIDUAL_PROFICIENCY)).toBeGreaterThan(1);
    expect(cheapestRoute(SKILL_RESIDUAL_FIREWALL)).toBeGreaterThan(cheapestRoute(SKILL_RESIDUAL_PROFICIENCY));
  });
});
