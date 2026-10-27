import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { skillViews } from '../testing/skillViews';
import { buildViewModel } from '../ui/viewModel';
import { gameConfig } from './gameConfig';
import {
  BURN_LEAD,
  BURN_LEADS,
  GROW_NETWORK,
  SKILL_BLACKOUT,
  SKILL_COLD_TRAIL,
  SKILL_DEEP_COVER,
  SKILL_OBFUSCATION,
  SKILL_PURGE_PROTOCOL,
  SKILL_QUIET_HOURS,
  SKILL_SCORCHED_EARTH,
  SKILL_SILVER_TONGUE,
  SKILL_UNDERCOVER,
} from './ids';

const skill = (id: string) => gameConfig.buyables.find((b) => b.id === id)!;
const nodeOf = (g: ReturnType<typeof createGame>, id: string) =>
  buildViewModel(g)
    .skills.lanes.flatMap((l) => l.nodes)
    .find((n) => n.view.id === id)!;

describe('the anonymity skill tree: shape', () => {
  it('Cold Trail splits into the cooling, Burn lead and idle paths', () => {
    for (const id of [SKILL_OBFUSCATION, SKILL_SCORCHED_EARTH, SKILL_QUIET_HOURS]) {
      expect(skill(id).parents, id).toEqual([SKILL_COLD_TRAIL]);
    }
    expect(skill(SKILL_PURGE_PROTOCOL).parents).toEqual([SKILL_OBFUSCATION]);
    expect(skill(SKILL_SILVER_TONGUE).parents).toEqual([SKILL_SCORCHED_EARTH]);
    expect(skill(SKILL_UNDERCOVER).parents).toEqual([SKILL_QUIET_HOURS]);
  });

  it('Blackout is the end of the cooling lane, and nothing needs it; Deep Cover is not an anonymity skill', () => {
    expect(skill(SKILL_BLACKOUT).parents).toEqual([SKILL_PURGE_PROTOCOL]);
    expect(gameConfig.buyables.filter((b) => b.parents?.includes(SKILL_BLACKOUT))).toEqual([]);
    expect(skill(SKILL_DEEP_COVER).branch).not.toBe(skill(SKILL_COLD_TRAIL).branch);
  });

  it('three straight lanes on their own rows, with the root centred on them', () => {
    const g = createGame();
    const at = (id: string): [number, number] => [nodeOf(g, id).col, nodeOf(g, id).row];
    expect(at(SKILL_OBFUSCATION)).toEqual([1, 0]);
    expect(at(SKILL_PURGE_PROTOCOL)).toEqual([2, 0]);
    expect(at(SKILL_BLACKOUT)).toEqual([3, 0]);
    expect(at(SKILL_SCORCHED_EARTH)).toEqual([1, 1]);
    expect(at(SKILL_SILVER_TONGUE)).toEqual([2, 1]);
    expect(at(SKILL_QUIET_HOURS)).toEqual([1, 2]);
    expect(at(SKILL_UNDERCOVER)).toEqual([2, 2]);
    expect(at(SKILL_COLD_TRAIL)).toEqual([0, 1]);
  });

  it('every anonymity skill still costs one point', () => {
    for (const id of [SKILL_SCORCHED_EARTH, SKILL_SILVER_TONGUE, SKILL_QUIET_HOURS, SKILL_UNDERCOVER, SKILL_BLACKOUT]) {
      expect(skill(id).cost.eq(skill(SKILL_COLD_TRAIL).cost), id).toBe(true);
    }
  });
});

describe('the anonymity skill tree: effects name what they scale', () => {
  it('Scorched Earth and Silver Tongue act on the Burn lead, and Undercover on Grow network', () => {
    expect(skill(SKILL_SCORCHED_EARTH).effect.kind).toBe('burnLeadFlatHeat');
    expect(skill(SKILL_SILVER_TONGUE).effect).toMatchObject({ kind: 'itemDropChanceMultiplier', itemId: BURN_LEAD });
    expect(skill(SKILL_UNDERCOVER).effect).toEqual({ kind: 'idleHeatCooldownAction', actionId: GROW_NETWORK });
  });

  it('Quiet Hours and Blackout have their own effect kinds', () => {
    expect(skill(SKILL_QUIET_HOURS).effect.kind).toBe('idleHeatCooldown');
    expect(skill(SKILL_BLACKOUT).effect.kind).toBe('heatTaxCap');
  });
});

describe('the anonymity skill tree: what a new game shows', () => {
  it('Quiet Hours and Undercover read from the start, since heat is there from the start', () => {
    const g = createGame();
    expect(nodeOf(g, SKILL_QUIET_HOURS).masked).toBe(false);
    expect(nodeOf(g, SKILL_UNDERCOVER).masked).toBe(false);
  });

  it('Scorched Earth and Silver Tongue wait for the Burn leads purchase', () => {
    const g = createGame();
    expect(nodeOf(g, SKILL_SCORCHED_EARTH).masked).toBe(true);
    expect(nodeOf(g, SKILL_SILVER_TONGUE).masked).toBe(true);
    (g.getState().purchased as Record<string, number>)[BURN_LEADS] = 1;
    expect(nodeOf(g, SKILL_SCORCHED_EARTH).masked).toBe(false);
    expect(nodeOf(g, SKILL_SILVER_TONGUE).masked).toBe(false);
  });

  it('Blackout stays hidden until Purge Protocol is readable', () => {
    const g = createGame();
    expect(nodeOf(g, SKILL_BLACKOUT).masked).toBe(true);
    const views = skillViews(buildViewModel(g).skills.lanes);
    expect(views.find((v) => v.id === SKILL_BLACKOUT)!.name).toBe('???');
  });
});
