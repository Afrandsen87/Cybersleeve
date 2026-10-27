/**
 * The reach lane of the REAL re-sleeve skills (Deep Conditioning, Clearance Escalation): the outcomes the design asks for.
 */

import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { openResleeving } from '../testing/sleeveLevelsKit';
import { setCredits } from '../testing/testConfig';
import {
  ACCESS_UPGRADE,
  FASTER_CONDITIONING,
  SKILL_CLEARANCE_ESCALATION,
  SKILL_DEEP_CONDITIONING,
  SKILL_SLEEVE_EUPHORIA,
} from './gameConfig';

/** A real game with the re-sleeve skills reached by re-sleeving `points` times and buying the given skills in order. */
function gameWith(skills: string[], points: number): ReturnType<typeof createGame> {
  const g = createGame();
  openResleeving(g);
  for (let i = 0; i < points; i++) g.resleeve();
  for (const id of skills) expect(g.buy(id), id).toBe('purchased');
  setCredits(g, num('1e300'));
  return g;
}

describe('Clearance Escalation', () => {
  it('lets Access upgrade be bought 4 times (access level 5), and a 5th time only with the skill', () => {
    const without = gameWith([], 0);
    for (let i = 0; i < 4; i++) expect(without.buy(ACCESS_UPGRADE)).toBe('purchased');
    expect(without.sleeveStats().accessLevel).toBe(5);
    expect(without.buy(ACCESS_UPGRADE)).toBe('max-reached');

    const withSkill = gameWith([SKILL_SLEEVE_EUPHORIA, SKILL_DEEP_CONDITIONING, SKILL_CLEARANCE_ESCALATION], 6);
    for (let i = 0; i < 5; i++) expect(withSkill.buy(ACCESS_UPGRADE)).toBe('purchased');
    expect(withSkill.sleeveStats().accessLevel).toBe(6);
    expect(withSkill.buy(ACCESS_UPGRADE)).toBe('max-reached');
  });
});

describe('Deep Conditioning', () => {
  it('takes a batch of sleeve XP down to 5 runs with 95 copies, where 90 copies stop at 10', () => {
    const without = gameWith([], 0);
    for (let i = 0; i < 90; i++) expect(without.buy(FASTER_CONDITIONING)).toBe('purchased');
    expect(without.runsPerSleeveXp()).toBe(10);
    expect(without.buy(FASTER_CONDITIONING)).toBe('max-reached');

    const withSkill = gameWith([SKILL_SLEEVE_EUPHORIA, SKILL_DEEP_CONDITIONING], 3);
    for (let i = 0; i < 90; i++) expect(withSkill.buy(FASTER_CONDITIONING)).toBe('purchased');
    expect(withSkill.runsPerSleeveXp()).toBe(10);
    for (let i = 0; i < 5; i++) expect(withSkill.buy(FASTER_CONDITIONING)).toBe('purchased');
    expect(withSkill.runsPerSleeveXp()).toBe(5);
    expect(withSkill.buy(FASTER_CONDITIONING)).toBe('max-reached');
  });
});
