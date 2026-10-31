/** Automation-context dispersal display tests. Called by: Vitest. Calls: dispersalPanelGame, buildDispersalView. */
import { describe, expect, it } from 'vitest';
import { dispersalPanelGame } from '../testing/dispersalPanelKit';
import { uiText } from './uiText';
import { buildDispersalView } from './view/dispersalView';

describe('dispersal protocol view', () => {
  it('asks for a target, exposes owner capacity and hides unseen permits', () => {
    const { game, config } = dispersalPanelGame();
    const view = buildDispersalView(game, config, uiText.automation.dispersal);
    expect(view).toMatchObject({ active: false, used: 0, slots: 1, count: '0/1', fullSlotsNote: '', permits: [] });
    expect(view.word).toBe('STANDBY');
    expect(view.summary).toBe('pick an action below');
    expect(view.actions.filter((action) => action.visible).map((action) => action.id)).toEqual(['a', 'b']);
    expect(view.actions.find((action) => action.id === 'locked')!.visible).toBe(false);
  });
  it('counts known permitted rarities and disables only unticked targets when full', () => {
    const { game, config } = dispersalPanelGame();
    (game.getState().wallet.seenItems as Record<string, Record<string, true>>)['schem'] = { common: true, rare: true };
    game.automation().setDispersalTarget('b', true);
    const view = buildDispersalView(game, config, uiText.automation.dispersal);
    expect(view).toMatchObject({ active: true, word: 'DISPERSING', used: 1, slots: 1, count: '1/1' });
    expect(view.summary).toBe('1 rarity over 1 action');
    expect(view.fullSlotsNote).toBe('all 1 slots used: untick one to pick another');
    expect(view.permits.map((rarity) => rarity.id)).toEqual(['common']);
    expect(view.actions.find((action) => action.id === 'a')!.disabled).toBe(true);
    expect(view.actions.find((action) => action.id === 'b')).toMatchObject({ selected: true, disabled: false });
  });
});
