/** Pure panel reveal and owner pass-through tests. Called by: Vitest. Calls: burnGame, autoBurnView. */
import { describe, expect, it, vi } from 'vitest';
import { allOn, blockCooling, burnConfig, burnGame } from '../testing/autoBurnKit';
import { autoBurnView } from './view/autoBurnView';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

describe('Auto Burn panel reveal', () => {
  it.each(Array.from({ length: 10 }, (_, i) => i))('reveals exactly what lane step %s owns', (step) => {
    const v = buildViewModel(burnGame(step, 5, 100)).automation.autoBurn;
    expect(v.status.visible).toBe(step >= 1);
    expect(v.strip.visible).toBe(step >= 2);
    expect(v.strip.floor.visible).toBe(step >= 2);
    expect(v.strip.redline.visible).toBe(step >= 3);
    expect(v.strip.layout.zones[2]!.visible).toBe(step >= 3);
    expect(v.rows.map((r) => r.visible)).toEqual([step >= 3, step >= 2, step >= 4, step >= 6]);
    expect(v.rows[2]!.chips.map((c) => c.id)).toEqual(step >= 5 ? ['offOverclocks', 'offActions'] : ['offOverclocks']);
    expect(v.rows[3]!.subrows.map((s) => s.visible)).toEqual([step >= 6, step >= 7]);
    expect(v.strip.floor.editable).toBe(step >= 8);
    expect(v.strip.redline.editable).toBe(step >= 8);
    expect(v.reserve.visible).toBe(step >= 9);
  });
  it('captions each row with the content names of its owned skills', () => {
    const skillName = (step: string): string =>
      burnConfig.buyables.find((b) => b.effect.kind === 'autoBurnStep' && b.effect.step === step)?.name ?? '?';
    const early = buildViewModel(burnGame(4, 5, 100)).automation.autoBurn;
    expect(early.rows[2]!.caption).toBe(skillName('offOverclocks'));
    const full = buildViewModel(burnGame(9, 5, 100)).automation.autoBurn;
    expect(full.rows.map((r) => r.caption)).toEqual([
      skillName('upper'),
      skillName('hold'),
      [skillName('offOverclocks'), skillName('offActions')].join(uiText.automation.autoBurn.captionJoin),
      [skillName('onActions'), skillName('onOverclocks')].join(uiText.automation.autoBurn.captionJoin),
    ]);
  });
  it('formats the fixed notch numbers like the condition text', () => {
    const game = burnGame(8, 10, 20);
    game.automation().autoBurn().setThresholds(1234567, 98765432);
    const v = buildViewModel(game).automation.autoBurn;
    expect(v.rows[1]!.condition).toContain(v.strip.floor.text);
    expect(v.rows[0]!.condition).toContain(v.strip.redline.text);
  });
  it('shows live Floor and Redline condition values and fixes them until Tune Thresholds', () => {
    const game = burnGame(8, 10, 20);
    game.automation().autoBurn().setThresholds(17, 83);
    const v = buildViewModel(game).automation.autoBurn;
    expect(v.rows[0]!.condition).toContain('83');
    for (const row of v.rows.slice(1)) expect(row.condition).toContain('17');
  });
  it.each([
    [8, 7],
    [9, 8],
    [10, 9],
  ])('preserves reveal at real lane slot %s (slot 8 is empty)', (slot, skills) => {
    // The shared kit numbers purchases consecutively; real content retains the removed slot.
    const v = buildViewModel(burnGame(skills!, 5, 100)).automation.autoBurn;
    expect(v.strip.floor.editable).toBe(slot! >= 9);
    expect(v.reserve.visible).toBe(slot! >= 10);
  });
  it('passes through every owner firing flag without deriving conditions', () => {
    const game = burnGame(9, 5, 0);
    const burn = game.automation().autoBurn();
    const status = burn.status();
    vi.spyOn(burn, 'status').mockReturnValue({ ...status, firing: { trigger: true, throttle: true, failsafe: true, restart: true } });
    const v = autoBurnView(burn, game, burnConfig, new Map(), uiText);
    expect(v.rows.every((r) => r.firing)).toBe(true);
    expect(v.status.word).toBe('STANDBY');
  });
  it('formats blocked status from its owner while work is on', () => {
    const game = burnGame(9, 5, 100);
    allOn(game);
    blockCooling(game);
    game.toggleBurnLead();
    expect(buildViewModel(game).automation.autoBurn.status).toMatchObject({ activity: 'blocked', word: 'BLOCKED' });
  });
  it('uses distinct action names for Auto-runs and keeps empty restart groups visible', () => {
    const game = burnGame(7, 5, 10);
    const config = { ...burnConfig, actions: burnConfig.actions.map((a) => (a.id === 'warm' ? { ...a, heatPerRun: 1 } : a)) };
    const views = new Map(
      buildViewModel(game)
        .actions.flatMap((a) => a.buyables)
        .map((b) => [b.id, b]),
    );
    // Ownership is injected directly; action-card buyable lists may omit square controls.
    const ownedViews = new Map(views);
    const template = views.values().next().value;
    if (template) for (const id of ['auto-hot', 'auto-warm']) ownedViews.set(id, { ...template, id, name: 'Auto-run', owned: 1 });
    const v = autoBurnView(game.automation().autoBurn(), game, config, ownedViews, uiText);
    expect(v.rows[3]!.subrows[0]!.chips.map((c) => c.name)).toEqual(['hot', 'warm']);
    expect(v.rows[3]!.subrows[0]!.chips.every((c) => !c.locked && c.tip === undefined)).toBe(true);
    const unowned = autoBurnView(
      game.automation().autoBurn(),
      { overclockStatus: () => null, isUnlocked: () => true },
      config,
      new Map(),
      uiText,
    );
    for (const sub of unowned.rows[3]!.subrows) {
      expect(sub.visible).toBe(true);
      expect(sub.chips.length).toBeGreaterThan(0);
      expect(sub.chips.every((c) => c.locked && c.tip === uiText.automation.autoBurn.lockedTip)).toBe(true);
    }
  });
  it('lists no resume chip for an action the player cannot reach yet', () => {
    const game = burnGame(7, 5, 10);
    const v = autoBurnView(
      game.automation().autoBurn(),
      { overclockStatus: () => null, isUnlocked: () => false },
      burnConfig,
      new Map(),
      uiText,
    );
    expect(v.rows[3]!.subrows.every((s) => s.visible && s.chips.length === 0 && s.empty.length > 0)).toBe(true);
  });
});
