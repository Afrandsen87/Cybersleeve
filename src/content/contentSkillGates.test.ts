/**
 * The reveal gates of the REAL content: a skill or purchase that talks about a concept (heat, critical successes, sleeve levels, a
 * second sleeve run) must sit behind the purchase or state that introduces that concept, so the player never reads about something that
 * does not exist for them yet. Invariants only, never tuning numbers.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import type { BuyableDefinition } from '../core';
import { skillViews } from '../testing/skillViews';
import { BRANCH_REVEAL_STAT } from '../ui/view/branchGates';
import { buildViewModel } from '../ui/viewModel';
import {
  CRITICAL_SUCCESS,
  FASTER_CONDITIONING,
  SKILL_BACK_CHANNEL,
  SKILL_SIGNAL_AMPLIFIER,
  SKILL_TRANSFER,
  SLEEVE_LEVELS,
  gameConfig,
} from './gameConfig';

const byId = new Map(gameConfig.buyables.map((b) => [b.id, b]));

/** The buyable itself plus everything its gate chain (`requires` and `parents`, all the way up) needs. */
function chain(b: BuyableDefinition, seen = new Set<string>()): BuyableDefinition[] {
  if (seen.has(b.id)) return [];
  seen.add(b.id);
  const upstream = [...(b.requires ?? []), ...(b.parents ?? [])].flatMap((id) => {
    const up = byId.get(id);
    return up ? chain(up, seen) : [];
  });
  return [b, ...upstream];
}

/** Effect kinds by the concept they only make sense with. */
const CRIT_KINDS = ['criticalExtraChance', 'criticalRewardMultiplier', 'criticalBoost', 'criticalLink'];
const HEAT_KINDS = [
  'heatCooldownSpeed',
  'overclockHeatFactor',
  'burnLeadFlatHeat',
  'idleHeatCooldown',
  'idleHeatCooldownAction',
  'heatTaxCap',
  'heatCooldownAmountFromSleeveLevel',
  'backChannel',
  'backChannelRarityScaling',
  'backChannelMultiplier',
  'moleAggregation',
];
const SLEEVE_LEVEL_KINDS = ['heatCooldownAmountFromSleeveLevel', 'levelBonusFromSleeveLevel', 'sleeveXpReduction'];

/** The purchases outside the re-sleeve tree (that tree is hidden as a whole until re-sleeving is unlocked). */
const everyday = gameConfig.buyables.filter((b) => b.currency !== 'resleevePoints');

describe('the lists of effect kinds name real effects', () => {
  it('every kind listed is used by some buyable (a typo would silently skip the checks)', () => {
    const used = new Set(gameConfig.buyables.map((b) => b.effect.kind));
    for (const kind of [...CRIT_KINDS, ...HEAT_KINDS, ...SLEEVE_LEVEL_KINDS]) expect(used.has(kind as never), kind).toBe(true);
  });
});

describe('critical successes', () => {
  it('everything about critical successes is behind the Critical success purchase', () => {
    for (const b of everyday.filter((x) => CRIT_KINDS.includes(x.effect.kind)))
      expect(
        chain(b).some((c) => c.id === CRITICAL_SUCCESS),
        b.id,
      ).toBe(true);
  });

  it('a new game masks the critical-success skills', () => {
    const view = skillViews(buildViewModel(createGame()).skills.lanes).find((v) => v.id === SKILL_SIGNAL_AMPLIFIER)!;
    expect(view.name).toBe('???');
  });
});

describe('heat', () => {
  it('every heat skill is in a branch that waits for heat to be revealed, or behind an Overclock unlock (the thing that makes heat)', () => {
    for (const b of everyday.filter((x) => HEAT_KINDS.includes(x.effect.kind))) {
      const inHeatBranch = b.branch !== undefined && BRANCH_REVEAL_STAT[b.branch] === 'heat';
      const behindOverclock = chain(b).some((c) => c.effect.kind === 'overclockUnlock');
      expect(inHeatBranch || behindOverclock, b.id).toBe(true);
    }
  });

  it('the Moles skills (heat outside the heat branch) wait for an Overclock unlock', () => {
    expect(chain(byId.get(SKILL_BACK_CHANNEL)!).some((c) => c.effect.kind === 'overclockUnlock')).toBe(true);
  });
});

describe('sleeve levels and re-sleeving', () => {
  it('everything about sleeve levels is behind the unlock of sleeve levels, or from the second sleeve run on', () => {
    for (const b of everyday.filter((x) => SLEEVE_LEVEL_KINDS.includes(x.effect.kind)))
      expect(
        chain(b).some((c) => c.id === SLEEVE_LEVELS || (c.revealAfterResleeves ?? 0) >= 1),
        b.id,
      ).toBe(true);
  });

  it('no purchase outside the re-sleeve tree mentions sleeve levels or sleeve XP unless it is gated the same way', () => {
    for (const b of everyday.filter((x) => x.id !== SLEEVE_LEVELS && /sleeve (level|xp)/i.test(x.description)))
      expect(
        chain(b).some((c) => c.id === SLEEVE_LEVELS || (c.revealAfterResleeves ?? 0) >= 1),
        b.id,
      ).toBe(true);
  });

  it('Faster conditioning and Skill transfer wait for the second sleeve run', () => {
    for (const id of [FASTER_CONDITIONING, SKILL_TRANSFER]) expect(byId.get(id)!.revealAfterResleeves, id).toBe(1);
  });

  it('they are unavailable in a new game and available after one finished sleeve-run', () => {
    const g = createGame();
    for (const id of [FASTER_CONDITIONING, SKILL_TRANSFER]) expect(g.isBuyableAvailable(id), id).toBe(false);
    (g.getState().runs as { creditsPerSecond: unknown; actionLevelsTotal: number }[]).push({ creditsPerSecond: 0, actionLevelsTotal: 0 });
    for (const id of [FASTER_CONDITIONING, SKILL_TRANSFER]) expect(g.isBuyableAvailable(id), id).toBe(true);
  });
});

describe('the action speed tip', () => {
  const tip = (g: ReturnType<typeof createGame>): string => buildViewModel(g).actions[0]!.speedTip;
  it('does not mention the sleeve level before sleeve levels are unlocked, and does after', () => {
    const g = createGame();
    expect(tip(g)).not.toMatch(/sleeve/i);
    (g.getState().purchased as Record<string, number>)[SLEEVE_LEVELS] = 1;
    expect(tip(g)).toMatch(/Sleeve Level/);
  });
});
