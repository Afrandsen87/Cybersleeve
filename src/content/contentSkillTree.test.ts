import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGame } from '../app/createGame';
import { skillViews } from '../testing/skillViews';
import { uiText } from '../ui/uiText';
import { buildViewModel } from '../ui/viewModel';
import { gameConfig } from './gameConfig';
import {
  BRANCH_ANONYMITY,
  BRANCH_CYBERNETICS,
  BRANCH_LEVERAGE,
  KOMPROMAT_HARVEST,
  PUSH_MALWARE,
  SKILL_BANDWIDTH,
  SKILL_BACK_CHANNEL,
  SKILL_BLACKOUT,
  SKILL_COLD_TRAIL,
  SKILL_DEEP_COVER,
  SKILL_EXPLOIT_KOMPROMAT,
  SKILL_DEEP_FILES,
  SKILL_DOSSIER,
  SKILL_TIERED_INFORMANTS,
  SKILL_DOUBLE_AGENT,
  SKILL_MUSCLE_MEMORY,
  SKILL_NOSE_FOR_SECRETS,
  SKILL_OBFUSCATION,
  SKILL_OVERCLOCK,
  SKILL_OVERDRIVE_SPIKE,
  SKILL_SIGNAL_AMPLIFIER,
  SLEEVE_LEVELS,
  SKILL_PURGE_PROTOCOL,
  SKILL_QUICK_STUDY,
  SKILL_SCORCHED_EARTH,
  SKILL_SILVER_TONGUE,
  overclockUnlockId,
} from './ids';

const skills = gameConfig.buyables.filter((b) => b.currency === 'skillPoints');
const css = readFileSync(fileURLToPath(new URL('../ui/style.css', import.meta.url)), 'utf8');

describe('the skill tree of the real content', () => {
  it('every skill is in one of the three branches, and a parent is always in the same branch', () => {
    const branches = [BRANCH_CYBERNETICS, BRANCH_ANONYMITY, BRANCH_LEVERAGE];
    for (const b of skills) {
      expect(branches, b.id).toContain(b.branch);
      for (const p of b.parents ?? []) expect(skills.find((s) => s.id === p)?.branch, `${b.id} -> ${p}`).toBe(b.branch);
    }
  });

  it('each branch has one root, which needs no parent, so all three can be started from the first skill point', () => {
    const roots = (branch: string) => skills.filter((b) => b.branch === branch && !(b.parents?.length ?? 0)).map((b) => b.id);
    expect(roots(BRANCH_CYBERNETICS)).toEqual([SKILL_OVERCLOCK]);
    expect(roots(BRANCH_ANONYMITY)).toEqual([SKILL_COLD_TRAIL]);
    expect(roots(BRANCH_LEVERAGE)).toEqual([SKILL_NOSE_FOR_SECRETS]);
  });

  it('every branch has a title in the text table and a colour in the style sheet', () => {
    for (const branch of new Set(skills.map((b) => b.branch))) {
      expect(uiText.skills.branches[branch!], `${branch} has no title`).toBeTruthy();
      expect(css, `${branch} has no lane colour rule`).toContain(`.skill-lane[data-branch="${branch}"]`);
      expect(css, `${branch} has no colour token`).toContain(`--branch-${branch}:`);
    }
  });

  it('the lanes are Cybernetics, Anonymity and Leverage, with every skill drawn from the first frame', () => {
    const lanes = buildViewModel(createGame()).skills.lanes;
    expect(lanes.map((l) => l.title)).toEqual(['Cybernetics', 'Anonymity', 'Leverage']);
    expect(lanes.flatMap((l) => l.nodes.map((n) => n.view.id)).sort()).toEqual(skills.map((b) => b.id).sort());
  });

  it('is laid out sideways: roots in column 0, their children one column further right', () => {
    const lanes = buildViewModel(createGame()).skills.lanes;
    const at = (id: string) => lanes.flatMap((l) => l.nodes).find((n) => n.view.id === id)!;
    for (const root of [SKILL_OVERCLOCK, SKILL_COLD_TRAIL, SKILL_NOSE_FOR_SECRETS]) expect(at(root).col, root).toBe(0);
    for (const kid of [SKILL_BANDWIDTH, SKILL_MUSCLE_MEMORY, SKILL_OBFUSCATION, SKILL_EXPLOIT_KOMPROMAT, SKILL_BACK_CHANNEL])
      expect(at(kid).col, kid).toBe(1);
    expect(at(SKILL_QUICK_STUDY).col).toBe(2);
    expect(at(SKILL_PURGE_PROTOCOL).col).toBe(2);
  });
});

describe('what a new game shows of the skill tree', () => {
  const masked = (g: ReturnType<typeof createGame>): string[] =>
    buildViewModel(g)
      .skills.lanes.flatMap((l) => l.nodes)
      .filter((n) => n.masked)
      .map((n) => n.view.id);

  it('the Cybernetics branch, Cold Trail, Quiet Hours and Undercover read from the start; the rest waits for what makes it useful', () => {
    expect(masked(createGame()).sort()).toEqual(
      [
        SKILL_SIGNAL_AMPLIFIER,
        SKILL_OVERDRIVE_SPIKE,
        SKILL_OBFUSCATION,
        SKILL_PURGE_PROTOCOL,
        SKILL_SCORCHED_EARTH,
        SKILL_SILVER_TONGUE,
        SKILL_DEEP_COVER,
        SKILL_BLACKOUT,
        SKILL_NOSE_FOR_SECRETS,
        SKILL_EXPLOIT_KOMPROMAT,
        SKILL_BACK_CHANNEL,
        SKILL_DEEP_FILES,
        SKILL_DOSSIER,
        SKILL_TIERED_INFORMANTS,
        SKILL_DOUBLE_AGENT,
      ].sort(),
    );
  });

  it('a masked skill says ??? and shows ? on its button, but keeps its place', () => {
    const view = skillViews(buildViewModel(createGame()).skills.lanes).find((v) => v.id === SKILL_NOSE_FOR_SECRETS)!;
    expect([view.name, view.description, view.tip, view.symbol]).toEqual(['???', '???', '???', '?']);
    expect(view.clickable).toBe(false);
  });

  it('owning Kompromat harvest reveals the Leverage branch, except Back channel which also waits for heat', () => {
    const g = createGame();
    (g.getState().purchased as Record<string, number>)[KOMPROMAT_HARVEST] = 1;
    expect(masked(g)).not.toContain(SKILL_NOSE_FOR_SECRETS);
    expect(masked(g)).not.toContain(SKILL_EXPLOIT_KOMPROMAT);
    expect(masked(g)).toContain(SKILL_BACK_CHANNEL); // Moles are heat: it also waits for the Push malware Overclock
    const nose = skillViews(buildViewModel(g).skills.lanes).find((v) => v.id === SKILL_NOSE_FOR_SECRETS)!;
    expect(nose.name).toBe('Nose for Secrets');
  });

  it('owning the Push malware Overclock reveals Obfuscation, and Purge Protocol with it, because its parent now reads', () => {
    const g = createGame();
    (g.getState().purchased as Record<string, number>)[overclockUnlockId(PUSH_MALWARE)] = 1;
    expect(masked(g)).not.toContain(SKILL_OBFUSCATION);
    expect(masked(g)).toContain(SKILL_PURGE_PROTOCOL); // it talks about sleeve levels: it waits for re-sleeving to be unlocked
    (g.getState().purchased as Record<string, number>)[SLEEVE_LEVELS] = 1;
    expect(masked(g)).not.toContain(SKILL_PURGE_PROTOCOL);
  });

  it('a skill that reads but whose parent is not owned is dimmed and cannot be bought yet', () => {
    const g = createGame();
    (g.getState().purchased as Record<string, number>)[overclockUnlockId(PUSH_MALWARE)] = 1;
    const obfuscation = buildViewModel(g)
      .skills.lanes.flatMap((l) => l.nodes)
      .find((n) => n.view.id === SKILL_OBFUSCATION)!;
    expect([obfuscation.masked, obfuscation.locked, obfuscation.view.clickable]).toEqual([false, true, false]);
  });
});
