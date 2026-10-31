/**
 * @module ui
 *
 * The top bar's view (`ui/view/hudView.ts`): the balance, and the income rate that shows once it is first above 0 and then stays.
 *
 * @remarks
 * Called by: Vitest. Calls: `game`, `flat`, `buildViewModel`.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { flat } from '../testing/flatState';
import { game } from '../testing/gameKit';
import { uiText } from './uiText';
import { buildViewModel } from './viewModel';

describe('HUD', () => {
  it('shows the wallet balance and hides the income rate before there is income', () => {
    const g = game();
    flat<{ credits: unknown }>(g).credits = num('1e15');
    expect(buildViewModel(g).hud).toEqual({ creditsLabel: 'CREDITS', creditsText: '1Qa', rateText: null });
  });

  it('shows the total income with a sign and per-second unit', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(40);
    expect(buildViewModel(g).hud.rateText).toBe('+2/s');
  });

  it('keeps the rate once shown, also when the income falls back to 0', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(40);
    const first = buildViewModel(g);
    expect(first.newlyRevealed).toContain('stat:incomeRate');
    g.noteRevealed(first.newlyRevealed);
    flat<{ network: unknown }>(g).network = num(0);
    expect(buildViewModel(g).hud.rateText).toBe('+0/s');
  });

  it('uses the injected HUD wording', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(40);
    const text = { ...uiText, mainScreen: { ...uiText.mainScreen, creditsLabel: 'BALANCE', rate: (amount: string) => `RATE ${amount}` } };
    expect(buildViewModel(g, undefined, text).hud).toMatchObject({ creditsLabel: 'BALANCE', rateText: 'RATE 2' });
  });
});
