/**
 * The closed-form run loop must give the same outcome whether time passes in one tick or many, also with the newer re-sleeve skills that
 * change the speed or the XP of a run (Neural Mirror, focus stacking). The twin games get the same time, once in a single tick and once in
 * many ticks that are each shorter than a run.
 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { num } from '../numbers';
import { setCredits } from '../testing/testConfig';
import { createConfig } from './index';
import { loose, plainBuyable, resleeveSkill, withBuyables } from './resleeveSkillsKit';

/** XP that puts action 'a' at level 2 in the test configuration (levels cost 10, then 100). */
const LEVEL_2_XP = 110;

const config = createConfig(
  withBuyables([
    resleeveSkill('syn', { kind: 'synthSleeves' }),
    resleeveSkill('mirror', { kind: 'synthXpBoost', factor: 1.25 }),
    resleeveSkill('stack', { kind: 'focusStacking' }),
    plainBuyable('fo-a', { kind: 'focusUnlock' }, { actionId: 'a' }),
    plainBuyable('slot', { kind: 'focusSlots', perCopy: 1 }, { maxPurchases: 2 }),
  ]),
  { network: { creditsPerNodePerSecond: 0 }, sleeve: { heatCooldownMs: 1e15 } },
);

/** A game whose synthetic sleeve reached level 2 on 'a', that has Neural Mirror and three Focus slots on 'a', and runs 'a' by itself. */
function ready(): ReturnType<typeof createGame> {
  const g = createGame({ config });
  for (let i = 0; i < 3; i++) {
    loose(g).actions['a']!.xp = num(LEVEL_2_XP);
    g.resleeve();
  }
  setCredits(g, num(1e6));
  for (const id of ['syn', 'mirror', 'stack', 'auto', 'fo-a', 'slot', 'slot']) expect(g.buy(id), id).toBe('purchased');
  for (let i = 0; i < 3; i++) expect(g.addFocus('a')).toBe(true);
  g.startAction('a');
  return g;
}

describe('the newer re-sleeve skills give the same result in one long tick and in many short ones', () => {
  it('Neural Mirror (XP bonus until the level of the synthetic sleeve) and three stacked Focus slots', () => {
    const once = ready();
    const stepped = ready();
    const total = 40_000_000;
    const steps = 2_000; // 20 s each, shorter than a run (about 51 s)
    once.tick(total);
    for (let i = 0; i < steps; i++) stepped.tick(total / steps);
    const a = once.getState().actions['a']!;
    const b = stepped.getState().actions['a']!;
    expect(once.actionLevel('a'), 'the run crossed the level the bonus ends at').toBeGreaterThanOrEqual(2);
    expect(a.xp.toNumber()).toBeCloseTo(b.xp.toNumber(), 6);
    expect(once.actionLevel('a')).toBe(stepped.actionLevel('a'));
    expect(a.sleeveXp.eq(b.sleeveXp)).toBe(true);
    expect(a.runsTowardSleeveXp).toBe(b.runsTowardSleeveXp);
  });
});
