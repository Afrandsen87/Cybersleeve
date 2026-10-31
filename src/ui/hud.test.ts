/**
 * @module ui
 * HUD reveal, authoritative income and shared heat-layout tests.
 * Called by: Vitest. Calls: `game`, `flat`, `buildViewModel`.
 */
import { describe, expect, it } from 'vitest';
import { num } from '../numbers';
import { flat } from '../testing/flatState';
import { game } from '../testing/gameKit';
import { buildViewModel } from './viewModel';
import { uiText } from './uiText';

describe('HUD', () => {
  it('shows the wallet balance and hides income and heat before they matter', () => {
    const g = game();
    flat<{ credits: unknown }>(g).credits = num('1e15');
    expect(buildViewModel(g).hud).toEqual({
      creditsLabel: 'CREDITS',
      creditsText: '1Qa',
      rateText: null,
      heat: null,
    });
  });

  it('shows the total income query with a sign and per-second unit', () => {
    const g = game();
    flat<{ network: unknown }>(g).network = num(40);
    expect(buildViewModel(g).hud.rateText).toBe('+2/s');
  });

  it('shares the gauge reveal state and exact strip fill, including overflow', () => {
    const g = game();
    for (const heat of [10, 652.3491]) {
      flat<{ heat: number }>(g).heat = heat;
      const vm = buildViewModel(g);
      expect(vm.hud.heat).toEqual({
        valueText: vm.sleeve.heatGauge!.valueText,
        taxText: uiText.mainScreen.taxValue(heat === 10 ? '10' : '100'),
        fillPercent: vm.sleeve.heatGauge!.strip.fillPercent,
      });
      expect(vm.sleeve.stats.find((row) => row.id === 'heat')!.hidden).toBe(false);
    }
  });

  it('uses the injected HUD wording', () => {
    const g = game();
    flat<{ network: unknown; heat: number }>(g).network = num(40);
    flat<{ heat: number }>(g).heat = 10;
    const text = {
      ...uiText,
      mainScreen: {
        ...uiText.mainScreen,
        creditsLabel: 'BALANCE',
        rate: (amount: string) => `RATE ${amount}`,
        heatValue: (amount: string) => `HOT ${amount}`,
        taxValue: (percent: string) => `TAXED ${percent}`,
      },
    };
    expect(buildViewModel(g, undefined, text).hud).toMatchObject({
      creditsLabel: 'BALANCE',
      rateText: 'RATE 1.8',
      heat: { valueText: 'HOT 10', taxText: 'TAXED 10' },
    });
  });
});
