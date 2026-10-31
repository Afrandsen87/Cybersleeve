/** Pure automation protocol tests. Called by: Vitest. Calls: shared Kompromat kit, buildViewModel. */
import { describe, expect, it } from 'vitest';
import { kompromatGame } from '../testing/kompromatKit';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

describe('Kompromat protocol view', () => {
  it('lists permission-owned rarities, held counts and channel before sale', () => {
    const view = buildViewModel(kompromatGame()).automation.kompromat;
    expect(view.rows.map((row) => row.id)).toEqual(['backchannel', 'autosale']);
    expect(view.rows.map((row) => row.condition)).toEqual([uiText.automation.kompromat.onDrop, uiText.automation.kompromat.thenCondition]);
    expect(view.rows[0]!.chips.filter((chip) => chip.visible).map((chip) => [chip.id, chip.disabled])).toEqual([['common', true]]);
    expect(view.rows[1]!.chips.filter((chip) => chip.visible).map((chip) => chip.heldText)).toEqual([
      uiText.automation.kompromat.held('41'),
      uiText.automation.kompromat.held('7'),
    ]);
    expect(view.active).toBe(false);
  });
  it('masks the dependency name exactly while its Firmware node is masked', () => {
    const game = kompromatGame();
    const masked = buildViewModel(game).automation.kompromat.rows[0]!.note;
    expect(masked).toBe(uiText.automation.kompromat.needsMasked);
    expect(masked).not.toContain('Secret channel');
    game.buy('auto');
    expect(buildViewModel(game).automation.kompromat.rows[0]!.note).toBe(
      uiText.automation.kompromat.needs('Secret channel', uiText.skills.branches['leverage']!),
    );
  });
  it('counts enabled sale and supported Back Channel rarities', () => {
    const game = kompromatGame(true);
    game.automation().setAutosale('rare', true);
    game.automation().setAutoBackchannel('common', true);
    const view = buildViewModel(game).automation.kompromat;
    expect(view.active).toBe(true);
    expect(view.summary).toBe(uiText.automation.kompromat.status(1, 2, 1));
    expect(view.rows[0]!.dimmed).toBe(false);
    expect(view.rows[0]!.note).toBe('');
  });
});
